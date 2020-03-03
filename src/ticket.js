const util = require('util');
let QRCode = require('qrcode');
let Jimp = require('jimp');
let fs = require('fs');
let path = require('path');
let imageToPDF = require('images-to-pdf');

const plainTicketPath = 'ticket-images/plain-ticket-alt-b.png'

const foregroundColor = '#FFF'
const backgroundColor = '#0000'

const X = 1385
const Y = 35

const scale = 3

let generateQRCode = async (customerInfo) => {
    let data = generateCode(customerInfo);
    let qrFile = `qr-codes/qr-code-${data}.png`;

    const toFile = util.promisify(QRCode.toFile);
    try {
      await toFile(qrFile, data, {
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        }
      });
      console.log(`QR Code Generated For ${data}`);
      
      return { qrFile, data };
    }
    catch (err) {
      throw err;
    }
}

let generateTicketUsingQRCode = async (customerInfo) => {
    try {
      let image = await Jimp.read(plainTicketPath);
      let { qrFile: qrCodePath, data } = await generateQRCode(customerInfo);
      console.log(qrCodePath);
      let qrImage = await Jimp.read(qrCodePath);
      let id = Math.random().toString(36).substring(2, 6).toUpperCase();
      let ticketImagePath = `tickets/ticket-with-qr-code-${data}-${id}.png`;
      let ticketPDFPath = `tickets/ticket-with-qr-code-${data}-${id}.pdf`;
      const unlink = util.promisify(fs.unlink);

      qrImage.scale(scale);
      image.composite(qrImage, X, Y);
      image.write(ticketImagePath);
      
      console.log(`QR Code added to Ticket ${data}`);
      await unlink(qrCodePath);

      console.log(ticketImagePath, ticketPDFPath);
      
      await imageToPDF([ticketImagePath], ticketPDFPath);
      await unlink(ticketImagePath);

      return ticketPDFPath;
    }
    catch (err) {
      throw err;
    }
}

let generateCode = (data) => {
  data = data || Math.random().toString(36).substring(2, 12).toUpperCase();
  return `Levit8Spaces-${data}`;
}

const generate = async ({ firstName, lastName }) => {
  console.log(`Generating ticket for ${firstName} ${lastName}`);
  let path = await generateTicketUsingQRCode(`${firstName}-${lastName}`);
  return {
    filename: `${firstName} ${lastName}'s Ticket.pdf`,
    path
  };
}

module.exports = {
  generate
};