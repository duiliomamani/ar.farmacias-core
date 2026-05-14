const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/?authSource=admin';

async function run() {
  console.log('Connecting to MongoDB...');
  const conn = await mongoose.createConnection(MONGODB_URI, { dbName: 'farmaya' }).asPromise();
  console.log('Connected.');

  const collections = await conn.db.listCollections().toArray();
  for (const coll of collections) {
    const count = await conn.db.collection(coll.name).countDocuments();
    console.log(`Collection: ${coll.name}, Count: ${count}`);
  }

  await conn.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
