const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function main() {
  const conn = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!conn) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: conn });
  try {
    await client.connect();
    const res = await client.query(`SELECT * FROM email_logs ORDER BY "createdAt" DESC LIMIT 200`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Query error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
