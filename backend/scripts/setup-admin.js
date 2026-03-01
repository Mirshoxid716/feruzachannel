const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables first
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        permissions TEXT DEFAULT '{}',
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER
    )`, (err) => {
        if (err) console.error('Table error:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lesson_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (lesson_id) REFERENCES lessons(id),
        UNIQUE(user_id, lesson_id)
    )`, (err) => {
        if (err) console.error('Ratings table error:', err.message);
    });

    // Add columns to users if not exist
    db.run(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`, () => { });
    db.run(`ALTER TABLE users ADD COLUMN last_login DATETIME`, () => { });
});

// Create superuser
async function createSuperuser() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        const perms = JSON.stringify({
            manage_lessons: true,
            manage_users: true,
            manage_admins: true,
            view_ratings: true,
            export_data: true
        });

        db.run(
            'INSERT OR IGNORE INTO admins (username, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)',
            ['SuperAdmin', 'admin@feruza.uz', hash, 'superuser', perms],
            function (err) {
                if (err) {
                    console.error('Error:', err.message);
                } else {
                    console.log('✅ Superuser yaratildi!');
                    console.log('   Email: admin@feruza.uz');
                    console.log('   Parol: admin123');
                }
                db.close();
            }
        );
    } catch (err) {
        console.error('Hash error:', err);
        db.close();
    }
}

setTimeout(createSuperuser, 500);
