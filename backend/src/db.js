const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URL);
let _db = null;

async function connect() {
  await client.connect();
  _db = client.db(process.env.DB_NAME);
  return _db;
}
function db() {
  return _db;
}
function col(name) {
  return _db.collection(name);
}

module.exports = { connect, db, col, client };
