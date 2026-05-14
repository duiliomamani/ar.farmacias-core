const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/?authSource=admin';

async function run() {
  console.log('Connecting to MongoDB...');
  const connection = await mongoose.createConnection(MONGODB_URI).asPromise();
  console.log('Connected.');

  const admin = connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log('Databases:', dbs.databases.map(db => db.name));

  await connection.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
