const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/?authSource=admin';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'farmaya' });
  console.log('Connected.');

  const PharmacySchema = new mongoose.Schema({}, { strict: false });
  const Pharmacy = mongoose.model('Pharmacy', PharmacySchema);

  const startOf14 = new Date('2026-05-14T00:00:00Z');
  const endOf14 = new Date('2026-05-14T23:59:59Z');

  const pharmacies = await Pharmacy.find({
    dutyFrom: { $gte: startOf14, $lte: endOf14 }
  });

  console.log(`Found ${pharmacies.length} pharmacies starting on May 14th.`);

  for (const p of pharmacies) {
    const raw = p.toObject();
    const oldFrom = raw.dutyFrom;
    const oldUntil = raw.dutyUntil;

    if (!oldFrom || !oldUntil) continue;

    const newFrom = new Date(oldFrom);
    newFrom.setUTCDate(newFrom.getUTCDate() - 1);
    
    const newUntil = new Date(oldUntil);
    newUntil.setUTCDate(newUntil.getUTCDate() - 1);

    console.log(`Updating ${raw.name}: ${oldFrom.toISOString()} -> ${newFrom.toISOString()}`);

    await Pharmacy.updateOne(
      { _id: raw._id },
      { $set: { dutyFrom: newFrom, dutyUntil: newUntil } }
    );
  }

  console.log('Update complete.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
