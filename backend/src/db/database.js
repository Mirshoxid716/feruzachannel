const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config();

let pool = null;
let sqliteDb = null;
let useSQLite = false;

// Determine database type
if (process.env.DATABASE_URL) {
  console.log('PostgreSQL configuration detected.');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PG client', err);
  });
} else {
  console.log('No DATABASE_URL found. Using SQLite.');
  useSQLite = true;
  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening SQLite database:', err.message);
    else console.log('Connected to local SQLite database.');
  });
}

/**
 * Unified query function that handles both PG ($1, $2) and SQLite
 * Automatically converts $n to ? for SQLite
 */
async function query(text, params = []) {
  if (!useSQLite) {
    if (!pool) throw new Error('PostgreSQL pool not initialized');
    return pool.query(text, params);
  } else {
    return new Promise((resolve, reject) => {
      // Convert $1, $2... to ? for SQLite
      const sqliteQuery = text.replace(/\$\d+/g, '?');

      const isSelect = text.trim().toUpperCase().startsWith('SELECT');
      const method = isSelect ? 'all' : 'run';

      sqliteDb[method](sqliteQuery, params, function (err, result) {
        if (err) return reject(err);
        if (isSelect) {
          resolve({ rows: result, rowCount: result.length });
        } else {
          resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
        }
      });
    });
  }
}

async function initializeSchema() {
  try {
    // Users Table
    await query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`.replace('SERIAL PRIMARY KEY', useSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY'));

    // Admins Table
    await query(`CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )`.replace('SERIAL PRIMARY KEY', useSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY'));

    // Lessons Table
    await query(`CREATE TABLE IF NOT EXISTS lessons (
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
    await query(`CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      lesson_id TEXT NOT NULL REFERENCES lessons(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, lesson_id)
    )`.replace('SERIAL PRIMARY KEY', useSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY'));

    // Verification Tokens Table
    await query(`CREATE TABLE IF NOT EXISTS verification_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      lesson_id TEXT REFERENCES lessons(id),
      expires_at TIMESTAMP NOT NULL,
      used INTEGER DEFAULT 0
    )`);

    // Contact Messages Table
    await query(`CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`.replace('SERIAL PRIMARY KEY', useSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY'));

    // Seed Superuser if not exists
    const adminUsername = 'feruzachanel';
    const adminEmail = 'admin@feruza.uz';
    const hashedPassword = await bcrypt.hash('admin123', 10);

    if (useSQLite) {
      await query(`
        INSERT OR IGNORE INTO admins (username, email, password_hash, role, permissions) 
        VALUES ($1, $2, $3, $4, $5)
      `, [adminUsername, adminEmail, hashedPassword, 'superuser', JSON.stringify({ all: true })]);
    } else {
      await query(`
        INSERT INTO admins (username, email, password_hash, role, permissions) 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT (email) 
        DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash
      `, [adminUsername, adminEmail, hashedPassword, 'superuser', JSON.stringify({ all: true })]);
    }

    console.log('Database initialized and seeded successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Initialize on load
initializeSchema();

module.exports = {
  query,
  pool,
  sqliteDb
};
