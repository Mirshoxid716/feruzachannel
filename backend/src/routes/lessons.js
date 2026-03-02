const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db/database');
const { sendEmail } = require('../services/emailService');

// Get all active lessons
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, title, description, category, duration, youtube_url, video_path, thumbnail_path FROM lessons WHERE is_active = 1');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a specific lesson by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query('SELECT * FROM lessons WHERE id = $1 AND is_active = 1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Direct send PDF to user's email
router.post('/:id/send-to-email', async (req, res) => {
    const { id } = req.params;
    const authHeader = req.headers['authorization'];

    if (!authHeader) return res.status(401).json({ error: 'Tizimga kirmagansiz' });

    try {
        const token = authHeader.split(' ')[1] || authHeader;
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [userId, userEmail] = decoded.split(':');

        if (!userEmail) return res.status(401).json({ error: "Noto'g'ri token" });

        const { rows } = await db.query('SELECT * FROM lessons WHERE id = $1 AND is_active = 1', [id]);
        const lesson = rows[0];

        if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

        await sendEmail(
            userEmail,
            `${lesson.title} - Dars materiali`,
            `<p>Siz so'ragan <b>${lesson.title}</b> darsi bo'yicha material biriktirildi. O'qishlaringizda omad!</p>`,
            [{ filename: path.basename(lesson.file_path), path: lesson.file_path }]
        );

        res.json({ message: "PDF pochta manzilingizga muvaffaqiyatli jo'natildi!" });
    } catch (error) {
        console.error("Email send error:", error);
        res.status(500).json({ error: "Xatolik yuz berdi" });
    }
});

// Verify token and send material
router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const { rows } = await db.query(
            'SELECT vt.*, l.title, l.file_path FROM verification_tokens vt JOIN lessons l ON vt.lesson_id = l.id WHERE vt.token = $1 AND vt.used = 0 AND vt.expires_at > NOW()',
            [token]
        );
        const row = rows[0];

        if (!row) return res.status(400).json({ error: 'Yaroqsiz yoki muddati o\'tgan token.' });

        await db.query('UPDATE verification_tokens SET used = 1 WHERE token = $1', [token]);

        await sendEmail(
            row.email,
            `${row.title} - Dars materiali`,
            `<p>Tabriklaymiz! Mana siz so'ragan dars materiali.</p>`,
            [{ filename: path.basename(row.file_path), path: row.file_path }]
        );

        res.json({ message: 'Material pochtangizga yuborildi!' });
    } catch (err) {
        res.status(500).json({ error: 'Materialni yuborishda xatolik yuz berdi.' });
    }
});

// ======= Rate a Lesson =======
router.post('/:id/rate', async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const authHeader = req.headers['authorization'];

    if (!authHeader) return res.status(401).json({ error: 'Tizimga kirmagansiz' });

    try {
        const token = authHeader.split(' ')[1] || authHeader;
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [userId] = decoded.split(':');

        if (!userId) return res.status(401).json({ error: "Noto'g'ri token" });
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Reyting 1 dan 5 gacha bo\'lishi kerak' });
        }

        const lessonCheck = await db.query('SELECT id FROM lessons WHERE id = $1 AND is_active = 1', [id]);
        if (lessonCheck.rows.length === 0) return res.status(404).json({ error: 'Dars topilmadi' });

        await db.query(
            `INSERT INTO ratings (user_id, lesson_id, rating, comment) VALUES ($1, $2, $3, $4)
             ON CONFLICT(user_id, lesson_id) DO UPDATE SET rating = $3, comment = $4, created_at = CURRENT_TIMESTAMP`,
            [userId, id, rating, comment || '']
        );
        res.json({ message: 'Reyting muvaffaqiyatli saqlandi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======= Get Ratings for a Lesson =======
router.get('/:id/ratings', async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query(
            `SELECT r.rating, r.comment, r.created_at, u.full_name
             FROM ratings r LEFT JOIN users u ON r.user_id = u.id
             WHERE r.lesson_id = $1 ORDER BY r.created_at DESC`,
            [id]
        );

        const avg = rows.length > 0
            ? (rows.reduce((sum, r) => sum + r.rating, 0) / rows.length).toFixed(1)
            : '0.0';

        res.json({ ratings: rows, average: parseFloat(avg), total: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

module.exports = router;
