const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateRandomString } = require('../utils/crypto');
const { verifyAdminToken, requirePermission } = require('../middleware/adminAuth');
const path = require('path');
const fs = require('fs');

const multer = require('multer');

// Configure multer storage
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
router.get('/stats', verifyAdminToken, (req, res) => {
    const stats = {};

    db.get('SELECT COUNT(*) as count FROM lessons', [], (err, row) => {
        stats.lessons_count = row ? row.count : 0;

        db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
            stats.users_count = row ? row.count : 0;

            db.get('SELECT COUNT(*) as count FROM ratings', [], (err, row) => {
                stats.ratings_count = row ? row.count : 0;

                db.get('SELECT AVG(rating) as avg FROM ratings', [], (err, row) => {
                    stats.avg_rating = row && row.avg ? parseFloat(row.avg).toFixed(1) : '0.0';

                    db.get(`SELECT COUNT(*) as count FROM users WHERE last_login >= date('now', '-1 day')`, [], (err, row) => {
                        stats.today_active = row ? row.count : 0;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// ======= Lessons CRUD =======

// Add Lesson
router.post('/lessons', verifyAdminToken, requirePermission('manage_lessons'), upload.fields([
    { name: 'lesson_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 },
    { name: 'thumbnail_file', maxCount: 1 }
]), (req, res) => {
    const { title, description, category, duration, youtube_url } = req.body;

    if (!title || !req.files || !req.files['lesson_file']) {
        return res.status(400).json({ error: "Sarlavha va material fayli (PDF/ZIP) majburiy." });
    }

    const file_path = req.files['lesson_file'][0].path.replace(/\\/g, '/');
    const video_path = req.files['video_file'] ? req.files['video_file'][0].path.replace(/\\/g, '/') : null;
    const thumbnail_path = req.files['thumbnail_file'] ? req.files['thumbnail_file'][0].path.replace(/\\/g, '/') : null;

    const id = generateRandomString(16);

    db.run(
        'INSERT INTO lessons (id, title, description, category, duration, youtube_url, video_path, thumbnail_path, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, title, description, category, duration, youtube_url, video_path, thumbnail_path, file_path],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, title, message: 'Dars muvaffaqiyatli qo\'shildi' });
        }
    );
});

// List all lessons
router.get('/lessons', verifyAdminToken, (req, res) => {
    db.all('SELECT * FROM lessons ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Toggle Lesson Activity
router.patch('/lessons/:id/toggle', verifyAdminToken, requirePermission('manage_lessons'), (req, res) => {
    const { id } = req.params;
    db.get('SELECT is_active FROM lessons WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        const newStatus = row.is_active === 1 ? 0 : 1;
        db.run('UPDATE lessons SET is_active = ? WHERE id = ?', [newStatus, id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ id, is_active: newStatus });
        });
    });
});

// Update Lesson
router.put('/lessons/:id', verifyAdminToken, requirePermission('manage_lessons'), upload.fields([
    { name: 'lesson_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 },
    { name: 'thumbnail_file', maxCount: 1 }
]), (req, res) => {
    const { id } = req.params;
    const { title, description, category, duration, youtube_url } = req.body;

    if (!title) {
        return res.status(400).json({ error: "Sarlavha kiritilishi majburiy." });
    }

    db.get('SELECT file_path, video_path, thumbnail_path FROM lessons WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
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
                req.body.youtube_url = '';
            }
            if (req.files['thumbnail_file']) {
                if (thumbnail_path && fs.existsSync(thumbnail_path)) fs.unlinkSync(thumbnail_path);
                thumbnail_path = req.files['thumbnail_file'][0].path.replace(/\\/g, '/');
            }
        }

        if (req.body.youtube_url && req.body.youtube_url.trim() !== '' && (!req.files || !req.files['video_file'])) {
            if (video_path && fs.existsSync(video_path)) {
                fs.unlinkSync(video_path);
            }
            video_path = null;
        }

        const final_youtube = req.body.youtube_url || '';

        db.run(
            'UPDATE lessons SET title = ?, description = ?, category = ?, duration = ?, youtube_url = ?, video_path = ?, thumbnail_path = ?, file_path = ? WHERE id = ?',
            [title, description, category, duration, final_youtube, video_path, thumbnail_path, file_path, id],
            function (updateErr) {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ message: 'Dars muvaffaqiyatli yangilandi' });
            }
        );
    });
});

// Quick PDF Upload for a lesson
router.patch('/lessons/:id/upload-pdf', verifyAdminToken, requirePermission('manage_lessons'), upload.single('pdf_file'), (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: "PDF fayl tanlanmagan." });
    }

    db.get('SELECT file_path FROM lessons WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        // Delete old file
        if (row.file_path && fs.existsSync(row.file_path)) {
            try { fs.unlinkSync(row.file_path); } catch (e) { }
        }

        const newPath = req.file.path.replace(/\\/g, '/');

        db.run('UPDATE lessons SET file_path = ? WHERE id = ?', [newPath, id], function (updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ message: 'PDF muvaffaqiyatli yuklandi', file_path: newPath });
        });
    });
});

// Delete Lesson
router.delete('/lessons/:id', verifyAdminToken, requirePermission('manage_lessons'), (req, res) => {
    const { id } = req.params;

    db.get('SELECT file_path, video_path FROM lessons WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Dars topilmadi' });

        try {
            if (row.file_path && fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
            if (row.video_path && fs.existsSync(row.video_path)) fs.unlinkSync(row.video_path);
        } catch (fsErr) {
            console.error("Faylni o'chirishda xatolik:", fsErr);
        }

        db.run('DELETE FROM lessons WHERE id = ?', [id], function (delErr) {
            if (delErr) return res.status(500).json({ error: delErr.message });
            db.run('DELETE FROM verification_tokens WHERE lesson_id = ?', [id]);
            res.json({ message: "Dars muvaffaqiyatli o'chirildi" });
        });
    });
});

// Export Email Requests (CSV)
router.get('/export-emails', verifyAdminToken, requirePermission('export_data'), (req, res) => {
    db.all('SELECT email, lesson_id, expires_at, used FROM verification_tokens ORDER BY expires_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const csvHeader = 'Email,LessonID,ExpiresAt,Used\n';
        const csvRows = rows.map(r => `${r.email},${r.lesson_id},${r.expires_at},${r.used}`).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email_requests.csv');
        res.status(200).send(csvHeader + csvRows);
    });
});

// ======= Users List =======
router.get('/users', verifyAdminToken, requirePermission('manage_users'), (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let query = 'SELECT id, full_name, email, is_active, last_login, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    let params = [];
    let countParams = [];

    if (search) {
        query += ' WHERE full_name LIKE ? OR email LIKE ?';
        countQuery += ' WHERE full_name LIKE ? OR email LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.get(countQuery, countParams, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                users: rows,
                total: countRow.total,
                page,
                totalPages: Math.ceil(countRow.total / limit)
            });
        });
    });
});

// ======= Ratings List =======
router.get('/ratings', verifyAdminToken, requirePermission('view_ratings'), (req, res) => {
    db.all(`
        SELECT r.*, u.full_name, u.email, l.title as lesson_title
        FROM ratings r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN lessons l ON r.lesson_id = l.id
        ORDER BY r.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
