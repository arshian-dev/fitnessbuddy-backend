const { Client } = require('pg');

async function testConnection() {
  const user = 'postgres';
  const password = 'arshian22';
  const host = 'localhost';
  const port = 5432;

  console.log('Testing PostgreSQL connection with Fitness Buddy database credentials...');
  
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log(`\n SUCCESS! Connected using avataros credentials.`);
    
    // Check if fitness_buddy database exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='fitness_buddy'");
    if (res.rowCount === 0) {
      console.log("Database 'fitness_buddy' does not exist. Creating it...");
      await client.query("CREATE DATABASE fitness_buddy");
      console.log("Database 'fitness_buddy' created successfully!");
    } else {
      console.log("Database 'fitness_buddy' already exists.");
    }
    
    await client.end();
    return { success: true };
  } catch (err) {
    console.log(`Failed to connect. Error: ${err.message}`);
    return { success: false };
  }
}

testConnection();
