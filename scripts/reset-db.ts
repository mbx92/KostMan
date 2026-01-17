import { Client } from 'pg';

async function resetDatabase() {
  const dbConfig = {
    user: 'mbx',
    password: 'nopassword123!',
    host: '10.100.10.5',
    port: 5432,
    database: 'postgres', // Connect to default DB to manage other DBs
  };

  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Connected to postgres database.');

    // Terminate existing connections
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'kostMan_dev'
      AND pid <> pg_backend_pid();
    `);
    console.log('Terminated existing connections.');

    // Drop database
    await client.query(`DROP DATABASE IF EXISTS "kostMan_dev";`);
    console.log('Dropped database kostMan_dev.');

    // Create database
    await client.query(`CREATE DATABASE "kostMan_dev";`);
    console.log('Created database kostMan_dev.');

  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    await client.end();
  }
}

resetDatabase();
