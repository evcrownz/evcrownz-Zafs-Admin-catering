const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-1-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.mkcuuneodccwtoxrjwui',
    password: 'zafs_kitchen123',
    ssl: { rejectUnauthorized: false }
});

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to Supabase PostgreSQL!');
    client.release();
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
  });

module.exports = pool;