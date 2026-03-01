const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateAdminToken, verifyAdminToken, requireSuperuser } = require('../middleware/adminAuth');

// ======= Admin Login =======
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email va parolni kiriting' });
    }

    db.get('SELECT * FROM admins WHERE email = ?', [email], async (err, admin) => {
        if (err) return res.status(500).json({ error: 'Server xatosi' });
        if (!admin) return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });

        const token = generateAdminToken(admin);

        res.json({
            message: 'Muvaffaqiyatli kirdingiz',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                permissions: JSON.parse(admin.permissions || '{}'),
                avatar_url: admin.avatar_url
            }
        });
    });
});

// ======= Get Current Admin Profile =======
router.get('/profile', verifyAdminToken, (req, res) => {
    db.get('SELECT id, username, email, role, permissions, avatar_url, created_at FROM admins WHERE id = ?', [req.admin.id], (err, admin) => {
        if (err) return res.status(500).json({ error: 'Server xatosi' });
        if (!admin) return res.status(404).json({ error: 'Admin topilmadi' });

        admin.permissions = JSON.parse(admin.permissions || '{}');
        res.json(admin);
    });
});

// ======= Update Current Admin Profile =======
router.put('/profile', verifyAdminToken, async (req, res) => {
    const { username, email, current_password, new_password } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: 'Username va email majburiy' });
    }

    // If changing password, verify current password
    if (new_password) {
        if (!current_password) {
            return res.status(400).json({ error: 'Joriy parolni kiriting' });
        }

        const admin = await new Promise((resolve, reject) => {
            db.get('SELECT password_hash FROM admins WHERE id = ?', [req.admin.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const isMatch = await bcrypt.compare(current_password, admin.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' });

        const hashedPassword = await bcrypt.hash(new_password, 10);
        db.run('UPDATE admins SET username = ?, email = ?, password_hash = ? WHERE id = ?',
            [username, email, hashedPassword, req.admin.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Profil muvaffaqiyatli yangilandi' });
            }
        );
    } else {
        db.run('UPDATE admins SET username = ?, email = ? WHERE id = ?',
            [username, email, req.admin.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Profil muvaffaqiyatli yangilandi' });
            }
        );
    }
});

// ======= List All Admins (Superuser Only) =======
router.get('/admins', verifyAdminToken, requireSuperuser, (req, res) => {
    db.all('SELECT id, username, email, role, permissions, avatar_url, created_at FROM admins ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows.forEach(r => r.permissions = JSON.parse(r.permissions || '{}'));
        res.json(rows);
    });
});

// ======= Create New Admin (Superuser Only) =======
router.post('/admins', verifyAdminToken, requireSuperuser, async (req, res) => {
    const { username, email, password, role, permissions } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email va parol majburiy' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const perms = JSON.stringify(permissions || {});

        db.run(
            'INSERT INTO admins (username, email, password_hash, role, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, role || 'admin', perms, req.admin.id],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Bu email allaqachon mavjud' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ id: this.lastID, message: 'Admin muvaffaqiyatli qo\'shildi' });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Server xatosi' });
    }
});

// ======= Update Admin (Superuser Only) =======
router.put('/admins/:id', verifyAdminToken, requireSuperuser, async (req, res) => {
    const { id } = req.params;
    const { username, email, password, role, permissions } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: 'Username va email majburiy' });
    }

    const perms = JSON.stringify(permissions || {});

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'UPDATE admins SET username = ?, email = ?, password_hash = ?, role = ?, permissions = ? WHERE id = ?',
            [username, email, hashedPassword, role || 'admin', perms, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Admin topilmadi' });
                res.json({ message: 'Admin muvaffaqiyatli yangilandi' });
            }
        );
    } else {
        db.run(
            'UPDATE admins SET username = ?, email = ?, role = ?, permissions = ? WHERE id = ?',
            [username, email, role || 'admin', perms, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Admin topilmadi' });
                res.json({ message: 'Admin muvaffaqiyatli yangilandi' });
            }
        );
    }
});

// ======= Delete Admin (Superuser Only) =======
router.delete('/admins/:id', verifyAdminToken, requireSuperuser, (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.admin.id) {
        return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
    }

    db.run('DELETE FROM admins WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Admin topilmadi' });
        res.json({ message: 'Admin o\'chirildi' });
    });
});

module.exports = router;
