const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'arshian22',
      database: process.env.DB_NAME || 'fitness_buddy',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Helper for running queries
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
