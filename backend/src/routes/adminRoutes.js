const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateAdminToken, verifyAdminToken, requireSuperuser } = require('../middleware/adminAuth');

// ======= Admin Login =======
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username va parolni kiriting' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
        const admin = rows[0];

        if (!admin) return res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });

        const token = generateAdminToken(admin);

        res.json({
            message: 'Muvaffaqiyatli kirdingiz',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions || {},
                avatar_url: admin.avatar_url
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server xatosi' });
    }
});

// ======= Get Current Admin Profile =======
router.get('/profile', verifyAdminToken, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, username, email, role, permissions, avatar_url, created_at FROM admins WHERE id = $1', [req.admin.id]);
        const admin = rows[0];

        if (!admin) return res.status(404).json({ error: 'Admin topilmadi' });

        res.json(admin);
    } catch (err) {
        res.status(500).json({ error: 'Server xatosi' });
    }
});

// ======= Update Current Admin Profile =======
router.put('/profile', verifyAdminToken, async (req, res) => {
    const { username, email, current_password, new_password } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: 'Username va email majburiy' });
    }

    try {
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ error: 'Joriy parolni kiriting' });
            }

            const { rows } = await db.query('SELECT password_hash FROM admins WHERE id = $1', [req.admin.id]);
            const admin = rows[0];

            const isMatch = await bcrypt.compare(current_password, admin.password_hash);
            if (!isMatch) return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' });

            const hashedPassword = await bcrypt.hash(new_password, 10);
            await db.query('UPDATE admins SET username = $1, email = $2, password_hash = $3 WHERE id = $4',
                [username, email, hashedPassword, req.admin.id]
            );
            res.json({ message: 'Profil muvaffaqiyatli yangilandi' });
        } else {
            await db.query('UPDATE admins SET username = $1, email = $2 WHERE id = $3',
                [username, email, req.admin.id]
            );
            res.json({ message: 'Profil muvaffaqiyatli yangilandi' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= List All Admins (Superuser Only) =======
router.get('/admins', verifyAdminToken, requireSuperuser, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, username, email, role, permissions, avatar_url, created_at FROM admins ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= Create New Admin (Superuser Only) =======
router.post('/admins', verifyAdminToken, requireSuperuser, async (req, res) => {
    const { username, email, password, role, permissions } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email va parol majburiy' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const perms = permissions || {};

        const result = await db.query(
            'INSERT INTO admins (username, email, password_hash, role, permissions, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [username, email, hashedPassword, role || 'admin', perms, req.admin.id]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Admin muvaffaqiyatli qo\'shildi' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Bu email allaqachon mavjud' });
        }
        res.status(500).json({ error: err.message });
    }
});

// ======= Update Admin (Superuser Only) =======
router.put('/admins/:id', verifyAdminToken, requireSuperuser, async (req, res) => {
    const { id } = req.params;
    const { username, email, password, role, permissions } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: 'Username va email majburiy' });
    }

    try {
        const perms = permissions || {};

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await db.query(
                'UPDATE admins SET username = $1, email = $2, password_hash = $3, role = $4, permissions = $5 WHERE id = $6',
                [username, email, hashedPassword, role || 'admin', perms, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Admin topilmadi' });
            res.json({ message: 'Admin muvaffaqiyatli yangilandi' });
        } else {
            const result = await db.query(
                'UPDATE admins SET username = $1, email = $2, role = $3, permissions = $4 WHERE id = $5',
                [username, email, role || 'admin', perms, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Admin topilmadi' });
            res.json({ message: 'Admin muvaffaqiyatli yangilandi' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======= Delete Admin (Superuser Only) =======
router.delete('/admins/:id', verifyAdminToken, requireSuperuser, async (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.admin.id) {
        return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
    }

    try {
        const result = await db.query('DELETE FROM admins WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Admin topilmadi' });
        res.json({ message: 'Admin o\'chirildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

module.exports = router;
