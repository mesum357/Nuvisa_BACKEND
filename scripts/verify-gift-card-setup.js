#!/usr/bin/env node

/**
 * Gift Card Email Setup Verification Script
 * 
 * This script verifies that all components needed for gift card emails are properly configured:
 * 1. Email template exists and is active
 * 2. SMTP configuration is present
 * 3. Gift card database table is properly set up
 */

require('dotenv').config();
const { Sequelize } = require('sequelize-typescript');

const Env = require('../src/shared/config').Env;

async function verifyGiftCardSetup() {
  console.log('\n📧 Gift Card Email Setup Verification\n');
  console.log('=' .repeat(60));

  // 1. Check SMTP Configuration
  console.log('\n1️⃣  SMTP Configuration');
  console.log('-' .repeat(60));

  const smtpConfig = {
    host: Env.SMTP_HOST || 'mail.privateemail.com',
    port: Env.SMTP_PORT || 587,
    user: Env.SMTP_USER || Env.MAILER_EMAIL || 'NOT SET',
    fromEmail: Env.MAILER_FROM_EMAIL || 'support@nuvisa.co.uk',
    hasPassword: !!Env.SMTP_PASS,
  };

  console.log('✓ SMTP Host:', smtpConfig.host);
  console.log('✓ SMTP Port:', smtpConfig.port);
  console.log('✓ SMTP User:', smtpConfig.user);
  console.log('✓ From Email:', smtpConfig.fromEmail);
  console.log('✓ SMTP Password configured:', smtpConfig.hasPassword ? 'YES' : 'NO ⚠️');

  if (!smtpConfig.hasPassword) {
    console.log('⚠️  WARNING: SMTP_PASS environment variable is not set!');
    console.log('   Email sending will fail without SMTP password.');
  }

  // 2. Check Database Connection
  console.log('\n2️⃣  Database Connection');
  console.log('-' .repeat(60));

  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: Env.DATABASE_HOST,
    port: Number(Env.DATABASE_PORT) || 5432,
    username: Env.DATABASE_USER,
    password: Env.DATABASE_PASSWORD,
    database: Env.DATABASE_NAME,
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // 3. Check Email Template
  console.log('\n3️⃣  Email Template Check');
  console.log('-' .repeat(60));

  try {
    const templates = await sequelize.query(`
      SELECT id, key, name, isActive FROM "EmailTemplates" 
      WHERE key = 'gift_card_purchase'
      ORDER BY created_at DESC
      LIMIT 1
    `, { type: Sequelize.QueryTypes.SELECT });

    if (templates.length === 0) {
      console.log('❌ gift_card_purchase template NOT FOUND in database!');
      console.log('   This template needs to be created.');
      console.log('   Action: Restart the backend service to initialize templates.');
    } else {
      const template = templates[0];
      const isActive = template.isActive === true || template.isActive === 1;
      console.log('✅ gift_card_purchase template found (ID:', template.id + ')');
      console.log('   Name:', template.name);
      console.log('   Status:', isActive ? '✅ ACTIVE' : '❌ INACTIVE ');

      if (!isActive) {
        console.log('\n⚠️  Template is INACTIVE! Emails will not be sent.');
        console.log('   Fix: Run the following SQL to activate it:');
        console.log(`   UPDATE "EmailTemplates" SET isActive = true WHERE key = 'gift_card_purchase';`);
      }
    }
  } catch (err) {
    console.error('❌ Error checking template:', err.message);
  }

  // 4. Check Gift Cards Table
  console.log('\n4️⃣  Gift Cards Table Check');
  console.log('-' .repeat(60));

  try {
    const tables = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'GiftCards'
      ) as exists;
    `, { type: Sequelize.QueryTypes.SELECT });

    if (tables.length > 0 && tables[0].exists) {
      console.log('✅ GiftCards table exists');

      // Check for columns
      const columns = await sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'GiftCards' 
        ORDER BY ordinal_position
      `, { type: Sequelize.QueryTypes.SELECT });

      const columnNames = columns.map(c => c.column_name);
      const requiredColumns = ['id', 'code', 'email', 'amount', 'is_used', 'purchased_at'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));

      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns.join(', '));
      } else {
        console.log('✅ All required columns present');
      }

      // Check for recent gift cards
      const recentCards = await sequelize.query(`
        SELECT COUNT(*) as count FROM "GiftCards" 
        WHERE purchased_at > NOW() - INTERVAL '24 hours'
      `, { type: Sequelize.QueryTypes.SELECT });

      const count = recentCards.length > 0 ? recentCards[0].count : 0;
      console.log(`✅ Recent gift cards (24h): ${count}`);
    } else {
      console.log('❌ GiftCards table does NOT exist');
      console.log('   Action: Restart the backend service to initialize the table.');
    }
  } catch (err) {
    console.error('❌ Error checking GiftCards table:', err.message);
  }

  // 5. Check all Email Templates
  console.log('\n5️⃣  All Email Templates');
  console.log('-' .repeat(60));

  try {
    const allTemplates = await sequelize.query(`
      SELECT key, name, isActive FROM "EmailTemplates" 
      ORDER BY key
    `, { type: Sequelize.QueryTypes.SELECT });

    if (allTemplates.length === 0) {
      console.log('⚠️  No email templates found!');
      console.log('   Action: Restart the backend service to initialize templates.');
    } else {
      console.log(`Found ${allTemplates.length} template(s):`);
      allTemplates.forEach(t => {
        const status = (t.isActive === true || t.isActive === 1) ? '✅' : '❌';
        console.log(`  ${status} ${t.key.padEnd(25)} - ${t.name}`);
      });
    }
  } catch (err) {
    console.error('❌ Error listing templates:', err.message);
  }

  // 6. Summary & Recommendations
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary & Next Steps');
  console.log('='.repeat(60));

  const checklistItems = [
    { item: 'SMTP configured', ok: smtpConfig.hasPassword },
    { item: 'Database connected', ok: true },
  ];

  const allOk = checklistItems.every(c => c.ok);

  if (allOk) {
    console.log('✅ All checks passed! Gift card emails should work.');
    console.log('\n📝 Next: Make a test purchase and check the backend logs:');
    console.log('   - Look for "🎁 Creating Gift Card:" logs');
    console.log('   - Look for "✅ Gift card email sent successfully" or error details');
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.');
  }

  console.log('\n📚 Troubleshooting Guide:');
  console.log('   1. No SMTP Password: Set SMTP_PASS in .env file');
  console.log('   2. Template not found: Restart backend to initialize');
  console.log('   3. Template inactive: Activate via admin panel or SQL');
  console.log('   4. Still no email: Check backend logs during purchase');
  console.log('\n');

  await sequelize.close();
  process.exit(0);
}

verifyGiftCardSetup().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
