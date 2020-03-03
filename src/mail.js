const util = require('util');
const fs = require('fs');

const ms = require('ms');
const prettyMs = require('pretty-ms');
const moment = require('moment');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com", // hostname
  secureConnection: false, // TLS requires secureConnection to be false
  port: 587, // port for secure SMTP
  tls: {
    ciphers:'SSLv3'
  },
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

const sendMail = (transporter.sendMail);

const sendWithAttachment = async (emailAddr, attachment, { firstName, paidAt, webhookBody }) => {
  var _paidAt = moment(paidAt, "YYYY-MM-DD'T'HH:mm:ss:SSSZ");
  var now = moment();
  var diff = moment.duration(_paidAt.diff(now));
  diff = Math.abs(diff);
  // var hh = parseInt(moment.utc(diff).format("HH")); // .format("HH:mm:ss:SSS");
  // var mm = parseInt(moment.utc(diff).format("mm"));
  // var ss = moment.utc(diff).format("ss.SSS");

  const paymentAgoDesc = `Payment was made ${prettyMs(diff)} ago`;
  console.log(paymentAgoDesc);

  const timeLimit = '1.5 hours';
  const paymentTooLongAgo = diff > ms(timeLimit);
  let mailOptions;
  if (paymentTooLongAgo) {
    console.log(`Payment was made longer than ${timeLimit} ago. Notifying admin`);
    // setup e-mail data, even with unicode symbols
    mailOptions = {
      from: '"Mike Ogezi" <okibeogezi@outlook.com>',
      to: process.env.EMAIL,
      subject: `Admin Notification`,
      text: paymentAgoDesc + '\n\n' + JSON.stringify(webhookBody, null, 4),
    };
  }
  else {
    mailOptions = {
      from: '"Mike Ogezi" <okibeogezi@outlook.com>',
      to: [emailAddr, process.env.EMAIL],
      subject: `Here\'s your ticket ${firstName}`,
      text: 'Thanks for your purchase. Please find attached your PDF ticket.',
      html: '<b>Thank you for your purchase.</b><br>Please find attached your PDF ticket.',
      attachments: [
        attachment
      ]
    };
  }

  // send mail with defined transport object
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info);
    await util.promisify(fs.unlink)(attachment.path);
    return info;
  }
  catch (err) {
    throw err;
  }
}

const notifyAdminOfError = async (email, err) => {
  const mailOptions = {
    from: '"Mike Ogezi" <okibeogezi@outlook.com>',
    to: email,
    subject: `Admin Error Notification`,
    text: `${err.toString()}\n\n${err.stack}`,
  };

  // send mail with defined transport object
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info);
    return info;
  }
  catch (err) {
    console.error('Failed to send admin error notification email');
    console.error(err);
  }
}

module.exports = {
  sendWithAttachment,
  notifyAdminOfError
};