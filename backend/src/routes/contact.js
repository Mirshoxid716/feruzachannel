const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendEmail } = require('../services/emailService');

// Contact Form Submission
router.post('/', (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Ism, Email va Xabar bo\'lishi shart' });
    }

    db.run(
        'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
        [name, email, subject, message],
        async function (err) {
            if (err) return res.status(500).json({ error: err.message });

            try {
                // Notify Admin
                await sendEmail(
                    process.env.SMTP_USER, // Send to admin
                    `Yangi kontakt xabari: ${subject || 'Mavzusiz'}`,
                    `<p><strong>Ism:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Xabar:</strong> ${message}</p>`
                );

                res.json({ message: 'Xabaringiz yuborildi. Rahmat!' });
            } catch (sendErr) {
                // Even if email fails, message is saved in DB
                res.json({ message: 'Xabaringiz saqlandi, lekin adminni xabardor qilishda xatolik yuz berdi.' });
            }
        }
    );
});

module.exports = router;
