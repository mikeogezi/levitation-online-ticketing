const { DB_USER, DB_PASSWORD, MONGO_URL } = process.env;

const mongoAddress = `mongodb://${DB_USER}:${DB_PASSWORD}@${MONGO_URL}`;
const mongoose = require('mongoose');

module.exports.connect = async () => {
  try {
    await mongoose.connect(mongoAddress, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      useFindAndModify: false
    });
    console.log('Successfully connected to mongodb instance');
  }
  catch (err) {
    console.error('Error connecting to mongodb instance');
    console.error(err);
  }
}