const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

router.post('/register', async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
    }

    const hashedPassword = hashPassword(password);

    try {
        const result = await db.query(
            'INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3) RETURNING id',
            [full_name, email, hashedPassword]
        );

        res.status(201).json({
            message: "Muvaffaqiyatli ro'yxatdan o'tdingiz",
            user: { id: result.rows[0].id, full_name, email }
        });
    } catch (err) {
        if (err.code === '23505') { // Postgres UNIQUE violation
            return res.status(400).json({ error: "Bu email orqali allaqachon ro'yxatdan o'tilgan." });
        }
        res.status(500).json({ error: "Serverda xatolik yuz berdi" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email va parolni kiriting." });
    }

    const hashedPassword = hashPassword(password);

    try {
        const { rows } = await db.query(
            'SELECT id, full_name, email FROM users WHERE email = $1 AND password = $2',
            [email, hashedPassword]
        );
        const user = rows[0];

        if (!user) return res.status(401).json({ error: "Email yoki parol noto'g'ri." });

        // Update last_login
        await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.json({
            message: "Tizimga kirdingiz",
            token: Buffer.from(`${user.id}:${user.email}`).toString('base64'),
            user
        });
    } catch (err) {
        res.status(500).json({ error: "Serverda xatolik yuz berdi" });
    }
});

module.exports = router;

module.exports = router;
