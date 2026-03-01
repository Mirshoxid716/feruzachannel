const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

// Boshlang'ich JWT tushunchasi o'rniga hozircha oddiy token ishlatamiz (yoki proyektda JWT bo'lsa uni qo'shish mumkin)
// Foydalanuvchilar qulayligi uchun xavfsiz heshlash standartlari (masalan bcrypt o'rniga crypto bilan oddiy hesh, sababi bcrypt yo'q)
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Vaqtinchalik xotira (DB ga token saqlashni qo'shmagunimizcha)
// Original production loyihada token DB da yoki JWT bilan saqlanadi.
// Hozirgi `users` tableda token column yo'q. Biz oddiy ishlashi uchun JWT ishlatishimiz yoki tokenni shu faylda map ko'rinishida saqlashimiz mumkin. 
// Lekin ma'lumotlar bazasiga `token` degan column qo'shilmagan. SHuning uchun oddiygina email qaytaramiz (demo uchun) yoki to'liq xavfsiz JWT kutubxonasini qo'shish kerak. 
// JWT siz, eng oddiy yechimni qilamiz: User bazadan topilsa, uning ma'lumotlarini qaytaramiz. Frontend esa buni eslab qoladi. (Haqiqiy loyihada xavfsiz emas).

router.post('/register', (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
    }

    const hashedPassword = hashPassword(password);

    db.run(
        'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
        [full_name, email, hashedPassword],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: "Bu email orqali allaqachon ro'yxatdan o'tilgan." });
                }
                return res.status(500).json({ error: "Serverda xatolik yuz berdi" });
            }

            // Muvaffaqiyatli!
            res.status(201).json({
                message: "Muvaffaqiyatli ro'yxatdan o'tdingiz",
                user: { id: this.lastID, full_name, email }
            });
        }
    );
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email va parolni kiriting." });
    }

    const hashedPassword = hashPassword(password);

    db.get('SELECT id, full_name, email FROM users WHERE email = ? AND password = ?', [email, hashedPassword], (err, user) => {
        if (err) return res.status(500).json({ error: "Serverda xatolik yuz berdi" });
        if (!user) return res.status(401).json({ error: "Email yoki parol noto'g'ri." });

        // Update last_login
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        res.json({
            message: "Tizimga kirdingiz",
            token: Buffer.from(`${user.id}:${user.email}`).toString('base64'),
            user
        });
    });
});

module.exports = router;
