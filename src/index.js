const config = require('dotenv').config();
if (!config.error) {
  console.log('Successfully imported environment variables:', Object.keys(config.parsed))
}
const express = require('express');
const bodyParser = require('body-parser');
const nodeCron = require('node-cron');

const ticket = require('./ticket');
const mail = require('./mail');
const bootstrap = require('./bootstrap');
const models = require('./models');

const mailDelivery = require('./events/mailDelivery');

const TicketPayment = require('./models/ticketPayment');

bootstrap.createDirs();

const app = express();
app.use(bodyParser.json());

let shouldRunCronErrorCheck = true;

const { EMAIL, PASSWORD, DB_USER, DB_PASSWORD, MONGO_URL, TICKET_PRICE } = process.env;
if (!EMAIL || !PASSWORD) {
  throw new Error(`"EMAIL", "PASSWORD" environment variables are currently undefined. They must be set`);
}

if (!DB_USER || !DB_PASSWORD || !MONGO_URL) {
  throw new Error(`"DB_USER", "DB_PASSWORD", "MONGO_URL" environment variables are currently undefined. They must be set`);
}

const whitelistedIPs = [
  '52.31.139.75', 
  '52.49.173.169', 
  '52.214.14.220'
];

app.get('/', (req, res, next) => {
  res.send('The Levitation Online Ticketing API is up and running');
});

app.post('/ticketPayments/callback', async (req, res, next) => {
  console.log('Callback:', req.body);
  res.end();
});

app.post('/ticketPayments/webhook', async (req, res, next) => {
  console.log('Webhook:', req.body);
  const { data, event } = req.body;
  const amount = data.amount / 100;

  const reference = data.reference;
  const isDelivered = await mailDelivery.isDelivered(reference);
  console.log(`isDelivered = ${isDelivered}`);
  if (isDelivered === true) {
    console.log(`Ticket for reference=${reference} has already been delivered`);
    console.log('System will stop here');
    return res.sendStatus(200);
  }
  else if (isDelivered === false) {
    // Resend the ticket to the customer
    console.log('Ticket payment was recorded but ticket was not delivered');
    console.log('System will deliver the ticket');
  }
  else if (isDelivered === null) {
    // Record the ticket payment then send the mail
    console.log('Ticket payment was not recorded');
    console.log('System will record ticket payment then deliver the ticket');
  }

  const success = data.status === 'success';
  if (!success) {
    console.log('Transaction failed');
    return res.status(200).send('Transaction failed');
  }

  if (event !== 'charge.success' || amount != TICKET_PRICE) {
    console.log(`Invalid transaction type, event=${event}, amount=${amount}`);
    return res.sendStatus(403);
  }

  const { first_name: firstName, last_name: lastName, email } = data.customer;
  const { paidAt } = data;

  try {
    await generateSendAndRecordTicket({ firstName, lastName, isDelivered, reference, req, email, paidAt });

    return res.sendStatus(200);
  }
  catch (err) {
    shouldRunCronErrorCheck = true;
    await mail.notifyAdminOfError(process.env.EMAIL, err);
    console.error('Error generating or mailing the ticket');
    console.error(err);
    
    return res.status(500).send('Error generating or mailing the ticket');
  }
});

let generateSendAndRecordTicket = async ({ firstName, lastName, isDelivered, reference, req, email, paidAt }) => {
  let ticketPDF = await ticket.generate({
    firstName,
    lastName
  });
  console.log('Successfully generated the ticket');
  // console.log(`paidAt = ${paidAt}, currentTime = ${new Date().toJSON()}`);

  if (isDelivered === null) {
    const ticketPayment = new TicketPayment({ reference, metadata: req.body });
    const ticketPaymentDoc = await ticketPayment.save();
    console.log('Ticket payment record saved: ', ticketPaymentDoc);
  }

  let mailInfo = await mail.sendWithAttachment(email, ticketPDF, { firstName, paidAt, webhookBody: req.body });
  console.log('Successfully mailed the ticket');
  const ticketPaymentDoc = await TicketPayment.findOneAndUpdate({ reference }, 
    { mailDelivered: true }, 
    { new: true });
  console.log('Ticket payment record updated:', ticketPaymentDoc);
}

/**
 * Every 15 minutes, 
 * Check for tickets that haven't yet been sent even thought they have been paid for
 * Then attempt to send them again
 */
nodeCron.schedule('*/15 * * * *', async () => {
  console.log('Deciding whether to run cron job');
  if (!shouldRunCronErrorCheck) {
    console.log('Skipping job. No errors to rectify');
    return;
  }

  console.log('Running cron job to check for errors to rectify');
  const ticketPaymentDocs = await TicketPayment.find({ mailDelivered: false });
  if (ticketPaymentDocs.length > 0) {
    ticketPaymentDocs.forEach(async ({ metadata }) => {
      const { data } = metadata;
      const { first_name: firstName, last_name: lastName, email } = data.customer;
      const { paidAt, reference } = data;
      const req = { body: metadata }
      await generateSendAndRecordTicket({ 
        firstName, lastName, isDelivered: false,
        reference, req, email, paidAt 
      });
    });
  }
  else {
    console.log('No errors to rectify');
    shouldRunCronErrorCheck = false;
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await models.connect();
  console.log(`Server listening on port ${PORT}`);
});