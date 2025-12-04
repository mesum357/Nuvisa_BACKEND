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
    logging: false,
    dialectOptions: process.env.DATABASE_SSL === "true" ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
  }
);

async function checkGiftCard() {
  try {
    const giftCardCode = 'NU-VISA-KGCGFP';
    
    console.log('🔍 Checking gift card code:', giftCardCode);
    console.log('Connecting to database...');
    
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');
    
    // Query the gift card
    const results = await sequelize.query(`
      SELECT 
        id,
        code,
        email,
        amount,
        is_used,
        purchased_at,
        used_at,
        used_by_email,
        stripe_session_id,
        stripe_payment_intent_id,
        "createdAt",
        "updatedAt"
      FROM gift_cards 
      WHERE code = :code
    `, {
      replacements: { code: giftCardCode },
      type: Sequelize.QueryTypes.SELECT
    });
    
    if (!results || results.length === 0) {
      console.log('❌ Gift card NOT FOUND in database');
      console.log('   Code:', giftCardCode);
      console.log('\n   Status: INVALID - Code does not exist');
    } else {
      const giftCard = results[0];
      console.log('✅ Gift card FOUND in database');
      console.log('\n📋 Gift Card Details:');
      console.log('   Code:', giftCard.code);
      console.log('   Email:', giftCard.email);
      console.log('   Amount:', giftCard.amount);
      console.log('   Purchased At:', giftCard.purchased_at);
      console.log('   Is Used:', giftCard.is_used);
      
      if (giftCard.is_used) {
        console.log('   Used At:', giftCard.used_at);
        console.log('   Used By Email:', giftCard.used_by_email || 'N/A');
        console.log('\n   Status: ❌ INVALID - Already used');
      } else {
        console.log('\n   Status: ✅ VALID - Available for redemption');
        console.log('   Benefits: 1 free traveler + 1 free insurance');
      }
      
      console.log('\n   Additional Info:');
      console.log('   ID:', giftCard.id);
      if (giftCard.stripe_session_id) {
        console.log('   Stripe Session ID:', giftCard.stripe_session_id);
      }
      if (giftCard.stripe_payment_intent_id) {
        console.log('   Stripe Payment Intent ID:', giftCard.stripe_payment_intent_id);
      }
      console.log('   Created At:', giftCard.createdAt);
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error checking gift card:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

checkGiftCard();

