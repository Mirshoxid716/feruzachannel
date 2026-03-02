const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'feruza_admin_secret_key_2026';

// Generate JWT for admin
function generateAdminToken(admin) {
    return jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Verify admin JWT token
async function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Token topilmadi. Iltimos, tizimga kiring.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify admin still exists in DB
        const { rows } = await db.query('SELECT id, username, email, role, permissions FROM admins WHERE id = $1', [decoded.id]);
        const admin = rows[0];

        if (!admin) return res.status(401).json({ error: 'Admin topilmadi' });

        req.admin = admin;
        // permissions is JSONB, so it's already an object
        req.admin.permissions = admin.permissions || {};
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }
}

// Only superuser can access
function requireSuperuser(req, res, next) {
    if (req.admin.role !== 'superuser') {
        return res.status(403).json({ error: 'Faqat superuser uchun ruxsat berilgan' });
    }
    next();
}

// Check specific permission
function requirePermission(permission) {
    return (req, res, next) => {
        if (req.admin.role === 'superuser') return next(); // superuser has all permissions

        const perms = req.admin.permissions || {};
        if (!perms[permission]) {
            return res.status(403).json({ error: `"${permission}" ruxsati sizga berilmagan` });
        }
        next();
    };
}

module.exports = { generateAdminToken, verifyAdminToken, requireSuperuser, requirePermission, JWT_SECRET };
