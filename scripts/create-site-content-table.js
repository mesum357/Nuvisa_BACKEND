/**
 * Script to create site_content table manually
 * Run with: node scripts/create-site-content-table.js
 * 
 * Make sure to set your database connection details in .env file
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
  }
);

async function createTable() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    console.log('Creating site_content table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(255)
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS site_content_key_unique ON site_content(key);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS site_content_updated_at_idx ON site_content(updated_at);
    `);

    console.log('✓ site_content table created successfully!');
    
    // Verify table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count FROM site_content;
    `);
    console.log('✓ Table verification:', results);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating table:', error);
    await sequelize.close();
    process.exit(1);
  }
}

createTable();

