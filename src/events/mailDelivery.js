const TicketPayment = require('../models/ticketPayment');

module.exports.isDelivered = async (reference) => {
  const ticketPayment = await TicketPayment.findOne({ reference });

  if (ticketPayment != null) {
    const delivered = ticketPayment.mailDelivered;
    
    console.log('Ticket payment record found:', ticketPayment);
    console.log('Delivery status:', delivered);

    return delivered;
  }
  else {
    console.log('Ticket payment record not found');
    return null;
  }
}

