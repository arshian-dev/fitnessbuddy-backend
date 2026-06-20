const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'arshian22';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;
const dbName = process.env.DB_NAME || 'fitness_buddy';

async function initDatabase() {
  // 1. Connect to default 'postgres' database to check/create the target database
  console.log(`Connecting to default 'postgres' database on ${dbHost}:${dbPort}...`);
  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to admin database.');

    // Check if fitness_buddy database exists
    const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database '${dbName}' does not exist. Creating it...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created successfully.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  } catch (err) {
    console.error('Error checking or creating database:', err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the target 'fitness_buddy' database and run schema.sql
  console.log(`\nConnecting to target database '${dbName}'...`);
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    await client.connect();
    console.log(`Connected to '${dbName}' database.`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Reading schema from ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(schemaSql);
    console.log('Schema executed successfully. All tables initialized!');

  } catch (err) {
    console.error('Error running schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDatabase();
