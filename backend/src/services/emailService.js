const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send an email with basic retry logic
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {Array} attachments - Optional attachments
 */
const sendEmail = async (to, subject, html, attachments = [], retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const info = await transporter.sendMail({
                from: `"Feruza Channel" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html,
                attachments,
            });
            console.log('Email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed sending email to ${to}:`, error.message);
            if (i === retries - 1) {
                const logger = require('../utils/logger');
                logger.error(`SMTP delivery failed after ${retries} attempts to ${to}`, error, { critical: true });
                throw error;
            }
            // Wait before retry
            await new Promise(res => setTimeout(res, 2000 * (i + 1)));
        }
    }
};

module.exports = {
    sendEmail,
};
