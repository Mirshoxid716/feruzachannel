const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database (Supabase).');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initializeSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users Table
    await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Admins Table
    await client.query(`CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions JSONB DEFAULT '{}',
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )`);

    // Lessons Table
    await client.query(`CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      duration TEXT,
      youtube_url TEXT,
      video_path TEXT,
      thumbnail_path TEXT,
      file_path TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ratings Table
    await client.query(`CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      lesson_id TEXT NOT NULL REFERENCES lessons(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, lesson_id)
    )`);

    // Verification Tokens Table
    await client.query(`CREATE TABLE IF NOT EXISTS verification_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      lesson_id TEXT REFERENCES lessons(id),
      expires_at TIMESTAMP NOT NULL,
      used INTEGER DEFAULT 0
    )`);

    // Contact Messages Table
    await client.query(`CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed Superuser if not exists
    const adminEmail = 'admin@feruza.uz';
    const { rows } = await client.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);

    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO admins (username, email, password_hash, role, permissions) VALUES ($1, $2, $3, $4, $5)',
        ['Super Admin', adminEmail, hashedPassword, 'superuser', JSON.stringify({ all: true })]
      );
      console.log('Default superuser created: admin@feruza.uz / admin123');
    }

    await client.query('COMMIT');
    console.log('Database schema initialized and seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing schema:', err);
  } finally {
    client.release();
  }
}

// Initialize schema on load
initializeSchema();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};
