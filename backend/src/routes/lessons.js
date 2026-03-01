const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db/database');
const { generateRandomString } = require('../utils/crypto');
const { sendEmail } = require('../services/emailService');

// Get all active lessons
router.get('/', (req, res) => {
    db.all('SELECT id, title, description, category, duration, youtube_url, video_path, thumbnail_path FROM lessons WHERE is_active = 1', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get a specific lesson by ID (Magic Link)
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM lessons WHERE id = ? AND is_active = 1', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Lesson not found' });
        res.json(row);
    });
});

// Direct send PDF to user's email
router.post('/:id/send-to-email', async (req, res) => {
    const { id } = req.params;
    // Tizimga kirish tokenni Header-dan olamiz. Biz authentication uchun base64 token qildik.
    const token = req.headers['authorization'];

    if (!token) return res.status(401).json({ error: 'Tizimga kirmagansiz' });

    try {
        const decoded = Buffer.from(token.split(' ')[1] || token, 'base64').toString('ascii');
        const [userId, userEmail] = decoded.split(':');

        if (!userEmail) return res.status(401).json({ error: "Noto'g'ri token" });

        // Darsni topamiz
        db.get('SELECT * FROM lessons WHERE id = ? AND is_active = 1', [id], async (err, lesson) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

            try {
                // Email yuborish
                await sendEmail(
                    userEmail,
                    `${lesson.title} - Dars materiali`,
                    `<p>Siz so'ragan <b>${lesson.title}</b> darsi bo'yicha material biriktirildi. O'qishlaringizda omad!</p>`,
                    [{ filename: path.basename(lesson.file_path), path: lesson.file_path }]
                );

                res.json({ message: "PDF pochta manzilingizga muvaffaqiyatli jo'natildi!" });
            } catch (sendErr) {
                console.error("Email send error:", sendErr);
                res.status(500).json({ error: "Email yuborishda xatolik yuz berdi" });
            }
        });
    } catch (error) {
        res.status(401).json({ error: 'Token xatosi' });
    }
});

// Verify token and send material
router.get('/verify/:token', (req, res) => {
    const { token } = req.params;

    db.get(
        'SELECT vt.*, l.title, l.file_path FROM verification_tokens vt JOIN lessons l ON vt.lesson_id = l.id WHERE vt.token = ? AND vt.used = 0 AND vt.expires_at > ?',
        [token, new Date().toISOString()],
        async (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(400).json({ error: 'Yaroqsiz yoki muddati o\'tgan token.' });

            try {
                // Mark token as used
                db.run('UPDATE verification_tokens SET used = 1 WHERE token = ?', [token]);

                // Send file via SMTP
                await sendEmail(
                    row.email,
                    `${row.title} - Dars materiali`,
                    `<p>Tabriklaymiz! Mana siz so'ragan dars materiali.</p>`,
                    [{ filename: path.basename(row.file_path), path: row.file_path }]
                );

                res.json({ message: 'Material pochtangizga yuborildi!' });
            } catch (sendErr) {
                res.status(500).json({ error: 'Materialni yuborishda xatolik yuz berdi.' });
            }
        }
    );
});

// ======= Rate a Lesson =======
router.post('/:id/rate', (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const token = req.headers['authorization'];

    if (!token) return res.status(401).json({ error: 'Tizimga kirmagansiz' });

    try {
        const decoded = Buffer.from(token.split(' ')[1] || token, 'base64').toString('ascii');
        const [userId] = decoded.split(':');

        if (!userId) return res.status(401).json({ error: "Noto'g'ri token" });
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Reyting 1 dan 5 gacha bo\'lishi kerak' });
        }

        // Check if lesson exists
        db.get('SELECT id FROM lessons WHERE id = ? AND is_active = 1', [id], (err, lesson) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

            // Insert or update rating (UNIQUE constraint on user_id + lesson_id)
            db.run(
                `INSERT INTO ratings (user_id, lesson_id, rating, comment) VALUES (?, ?, ?, ?)
                 ON CONFLICT(user_id, lesson_id) DO UPDATE SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP`,
                [userId, id, rating, comment || '', rating, comment || ''],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Reyting muvaffaqiyatli saqlandi', id: this.lastID });
                }
            );
        });
    } catch (error) {
        res.status(401).json({ error: 'Token xatosi' });
    }
});

// ======= Get Ratings for a Lesson =======
router.get('/:id/ratings', (req, res) => {
    const { id } = req.params;

    db.all(
        `SELECT r.rating, r.comment, r.created_at, u.full_name
         FROM ratings r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.lesson_id = ? ORDER BY r.created_at DESC`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            // Calculate average
            const avg = rows.length > 0
                ? (rows.reduce((sum, r) => sum + r.rating, 0) / rows.length).toFixed(1)
                : '0.0';

            res.json({ ratings: rows, average: parseFloat(avg), total: rows.length });
        }
    );
});

module.exports = router;
