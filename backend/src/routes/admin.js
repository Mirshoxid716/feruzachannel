const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateRandomString } = require('../utils/crypto');
const { verifyAdminToken, requirePermission } = require('../middleware/adminAuth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// ======= Stats =======
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const stats = {};

        const lessonsCountRes = await db.query('SELECT COUNT(*) as count FROM lessons');
        stats.lessons_count = lessonsCountRes.rows[0].count;

        const usersCountRes = await db.query('SELECT COUNT(*) as count FROM users');
        stats.users_count = usersCountRes.rows[0].count;

        const ratingsCountRes = await db.query('SELECT COUNT(*) as count FROM ratings');
        stats.ratings_count = ratingsCountRes.rows[0].count;

        const avgRatingRes = await db.query('SELECT AVG(rating) as avg FROM ratings');
        stats.avg_rating = avgRatingRes.rows[0].avg ? parseFloat(avgRatingRes.rows[0].avg).toFixed(1) : '0.0';

        const activeTodayRes = await db.query("SELECT COUNT(*) as count FROM users WHERE last_login >= NOW() - INTERVAL '1 day'");
        stats.today_active = activeTodayRes.rows[0].count;

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= Lessons CRUD =======

// Add Lesson
router.post('/lessons', verifyAdminToken, requirePermission('manage_lessons'), upload.fields([
    { name: 'lesson_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 },
    { name: 'thumbnail_file', maxCount: 1 }
]), async (req, res) => {
    const { title, description, category, duration, youtube_url } = req.body;

    if (!title || !req.files || !req.files['lesson_file']) {
        return res.status(400).json({ error: "Sarlavha va material fayli (PDF/ZIP) majburiy." });
    }

    const file_path = req.files['lesson_file'][0].path.replace(/\\/g, '/');
    const video_path = req.files['video_file'] ? req.files['video_file'][0].path.replace(/\\/g, '/') : null;
    const thumbnail_path = req.files['thumbnail_file'] ? req.files['thumbnail_file'][0].path.replace(/\\/g, '/') : null;

    const id = generateRandomString(16);

    try {
        await db.query(
            'INSERT INTO lessons (id, title, description, category, duration, youtube_url, video_path, thumbnail_path, file_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, title, description, category, duration, youtube_url, video_path, thumbnail_path, file_path]
        );
        res.json({ id, title, message: 'Dars muvaffaqiyatli qo\'shildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all lessons
router.get('/lessons', verifyAdminToken, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM lessons ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Lesson Activity
router.patch('/lessons/:id/toggle', verifyAdminToken, requirePermission('manage_lessons'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query('SELECT is_active FROM lessons WHERE id = $1', [id]);
        const row = rows[0];
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        const newStatus = row.is_active === 1 ? 0 : 1;
        await db.query('UPDATE lessons SET is_active = $1 WHERE id = $2', [newStatus, id]);
        res.json({ id, is_active: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Lesson
router.put('/lessons/:id', verifyAdminToken, requirePermission('manage_lessons'), upload.fields([
    { name: 'lesson_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 },
    { name: 'thumbnail_file', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { title, description, category, duration, youtube_url } = req.body;

    if (!title) {
        return res.status(400).json({ error: "Sarlavha kiritilishi majburiy." });
    }

    try {
        const { rows } = await db.query('SELECT file_path, video_path, thumbnail_path FROM lessons WHERE id = $1', [id]);
        const row = rows[0];
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        let file_path = row.file_path;
        let video_path = row.video_path;
        let thumbnail_path = row.thumbnail_path;

        if (req.files) {
            if (req.files['lesson_file']) {
                if (fs.existsSync(file_path)) fs.unlinkSync(file_path);
                file_path = req.files['lesson_file'][0].path.replace(/\\/g, '/');
            }
            if (req.files['video_file']) {
                if (video_path && fs.existsSync(video_path)) fs.unlinkSync(video_path);
                video_path = req.files['video_file'][0].path.replace(/\\/g, '/');
            }
            if (req.files['thumbnail_file']) {
                if (thumbnail_path && fs.existsSync(thumbnail_path)) fs.unlinkSync(thumbnail_path);
                thumbnail_path = req.files['thumbnail_file'][0].path.replace(/\\/g, '/');
            }
        }

        const final_youtube = youtube_url || '';

        await db.query(
            'UPDATE lessons SET title = $1, description = $2, category = $3, duration = $4, youtube_url = $5, video_path = $6, thumbnail_path = $7, file_path = $8 WHERE id = $9',
            [title, description, category, duration, final_youtube, video_path, thumbnail_path, file_path, id]
        );
        res.json({ message: 'Dars muvaffaqiyatli yangilandi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Quick PDF Upload for a lesson
router.patch('/lessons/:id/upload-pdf', verifyAdminToken, requirePermission('manage_lessons'), upload.single('pdf_file'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: "PDF fayl tanlanmagan." });
    }

    try {
        const { rows } = await db.query('SELECT file_path FROM lessons WHERE id = $1', [id]);
        const row = rows[0];
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        if (row.file_path && fs.existsSync(row.file_path)) {
            try { fs.unlinkSync(row.file_path); } catch (e) { }
        }

        const newPath = req.file.path.replace(/\\/g, '/');
        await db.query('UPDATE lessons SET file_path = $1 WHERE id = $2', [newPath, id]);
        res.json({ message: 'PDF muvaffaqiyatli yuklandi', file_path: newPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Lesson
router.delete('/lessons/:id', verifyAdminToken, requirePermission('manage_lessons'), async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query('SELECT file_path, video_path FROM lessons WHERE id = $1', [id]);
        const row = rows[0];
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        try {
            if (row.file_path && fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
            if (row.video_path && fs.existsSync(row.video_path)) fs.unlinkSync(row.video_path);
        } catch (fsErr) {
            console.error("Faylni o'chirishda xatolik:", fsErr);
        }

        await db.query('DELETE FROM lessons WHERE id = $1', [id]);
        await db.query('DELETE FROM verification_tokens WHERE lesson_id = $1', [id]);
        res.json({ message: "Dars muvaffaqiyatli o'chirildi" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export Email Requests (CSV)
router.get('/export-emails', verifyAdminToken, requirePermission('export_data'), async (req, res) => {
    try {
        const { rows } = await db.query('SELECT email, lesson_id, expires_at, used FROM verification_tokens ORDER BY expires_at DESC');
        const csvHeader = 'Email,LessonID,ExpiresAt,Used\n';
        const csvRows = rows.map(r => `${r.email},${r.lesson_id},${r.expires_at},${r.used}`).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email_requests.csv');
        res.status(200).send(csvHeader + csvRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= Users List =======
router.get('/users', verifyAdminToken, requirePermission('manage_users'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    try {
        let query = 'SELECT id, full_name, email, is_active, last_login, created_at FROM users';
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let params = [];
        let countParams = [];

        if (search) {
            query += ' WHERE full_name ILIKE $1 OR email ILIKE $2';
            countQuery += ' WHERE full_name ILIKE $1 OR email ILIKE $2';
            params.push(`%${search}%`, `%${search}%`);
            countParams.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const countRes = await db.query(countQuery, countParams);
        const total = parseInt(countRes.rows[0].total);

        const { rows } = await db.query(query, params);
        res.json({
            users: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= Ratings List =======
router.get('/ratings', verifyAdminToken, requirePermission('view_ratings'), async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT r.*, u.full_name, u.email, l.title as lesson_title
            FROM ratings r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN lessons l ON r.lesson_id = l.id
            ORDER BY r.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

module.exports = router;
