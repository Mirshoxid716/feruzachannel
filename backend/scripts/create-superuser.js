/**
 * Superuser yaratish skripti
 * Ishlatish: node scripts/create-superuser.js
 */
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function createSuperuser() {
    console.log('\n🔑 Superuser yaratish\n');

    // Ensure admins table exists
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
    )`);

    const username = await ask('Username: ');
    const email = await ask('Email: ');
    const password = await ask('Parol: ');

    if (!username || !email || !password) {
        console.error('❌ Barcha maydonlarni to\'ldiring!');
        rl.close();
        db.close();
        return;
    }

    if (password.length < 6) {
        console.error('❌ Parol kamida 6 belgi bo\'lishi kerak!');
        rl.close();
        db.close();
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO admins (username, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, 'superuser', JSON.stringify({
                manage_lessons: true,
                manage_users: true,
                manage_admins: true,
                view_ratings: true,
                export_data: true
            })],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.error('❌ Bu email allaqachon mavjud!');
                    } else {
                        console.error('❌ Xatolik:', err.message);
                    }
                } else {
                    console.log(`\n✅ Superuser muvaffaqiyatli yaratildi!`);
                    console.log(`   ID: ${this.lastID}`);
                    console.log(`   Username: ${username}`);
                    console.log(`   Email: ${email}`);
                    console.log(`   Role: superuser\n`);
                }
                rl.close();
                db.close();
            }
        );
    } catch (err) {
        console.error('❌ Xatolik:', err.message);
        rl.close();
        db.close();
    }
}

createSuperuser();
