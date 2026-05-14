const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/?authSource=admin';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'farmaya' });
  console.log('Connected.');

  const PharmacySchema = new mongoose.Schema({}, { strict: false, collection: 'pharmacies' });
  const Pharmacy = mongoose.model('Pharmacy', PharmacySchema);

  const count = await Pharmacy.countDocuments();
  console.log('Count via Mongoose:', count);

  const all = await Pharmacy.find({}).limit(10);
  console.log('Sample data:');
  all.forEach(p => {
    const raw = p.toObject();
    console.log(`- ${raw.name}: from ${raw.dutyFrom?.toISOString()} to ${raw.dutyUntil?.toISOString()}`);
  });

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
