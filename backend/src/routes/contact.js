const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendEmail } = require('../services/emailService');

// Contact Form Submission
router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Ism, Email va Xabar bo\'lishi shart' });
    }

    try {
        await db.query(
            'INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)',
            [name, email, subject, message]
        );

        try {
            // Notify Admin
            await sendEmail(
                process.env.SMTP_USER, // Send to admin
                `Yangi kontakt xabari: ${subject || 'Mavzusiz'}`,
                `<p><strong>Ism:</strong> ${name}</p>
                 <p><strong>Email:</strong> ${email}</p>
                 <p><strong>Xabar:</strong> ${message}</p>`
            );
        } catch (sendErr) {
            console.error("Admin notification failed:", sendErr);
        }

        res.json({ message: 'Xabaringiz yuborildi. Rahmat!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

module.exports = router;
