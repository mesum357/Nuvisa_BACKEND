require("dotenv").config();
const { Sequelize } = require("sequelize");

const data = [
  { name: "Austria", basePrice: 169, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Belgium", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Bulgaria", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Croatia", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Czechia", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Denmark", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Estonia", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Finland", basePrice: 149, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "France", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Germany", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Greece", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Hungary", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Iceland", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Italy", basePrice: 149, strikeOutPrice: 200, reason: "Due to Global Crisis", showReason: true },
  { name: "Latvia", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Lithuania", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Luxembourg", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Malta", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "NORWAY", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Netherlands", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Poland", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Portugal", basePrice: 149, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Romania", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Slovenia", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Spain", basePrice: 149, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Sweden", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
  { name: "Switzerland", basePrice: 129, strikeOutPrice: 200, reason: "", showReason: false },
];

const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT || 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions:
      process.env.DATABASE_SSL === "true"
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},
  }
);

async function seedVisaPricing() {
  try {
    await sequelize.authenticate();

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS visa_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "strikeOutPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT '',
        "showReason" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    for (const row of data) {
      await sequelize.query(
        `
        INSERT INTO visa_pricing (name, "basePrice", "strikeOutPrice", reason, "showReason", "createdAt", "updatedAt")
        VALUES (:name, :basePrice, :strikeOutPrice, :reason, :showReason, NOW(), NOW())
        ON CONFLICT (name)
        DO UPDATE SET
          "basePrice" = EXCLUDED."basePrice",
          "strikeOutPrice" = EXCLUDED."strikeOutPrice",
          reason = EXCLUDED.reason,
          "showReason" = EXCLUDED."showReason",
          "updatedAt" = NOW();
      `,
        {
          replacements: row,
        }
      );
    }

    console.log(`Seed complete. Upserted ${data.length} visa_pricing records.`);
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed visa_pricing:", error.message);
    await sequelize.close();
    process.exit(1);
  }
}

seedVisaPricing();

