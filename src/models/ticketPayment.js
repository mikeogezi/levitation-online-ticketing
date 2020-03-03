const mongoose = require('mongoose');

const ticketPaymentSchema = new mongoose.Schema({
  reference: String,
  mailDelivered: {
    type: Boolean,
    default: false
  },
  metadata: Object
});

module.exports = mongoose.model('TicketPayment', ticketPaymentSchema);