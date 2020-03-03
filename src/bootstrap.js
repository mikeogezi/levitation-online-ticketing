const fs = require('fs');
const util = require('util');

exports.createDirs = async () => {
  const dirs = ['qr-codes', 'tickets'];
  for (let dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
}