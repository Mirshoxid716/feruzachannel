const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../services/emailService');

const logFile = path.join(__dirname, '../../logs/error.log');

if (!fs.existsSync(path.dirname(logFile))) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

// Track alerts for rate limiting (1 email per 5 mins per error type)
const alertTracker = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000;

const logger = {
    error: async (message, error, context = {}) => {
        const timestamp = new Date().toISOString();
        const stack = error?.stack || error;
        const logContent = `[${timestamp}] ERROR: ${message}\n${stack}\n\n`;

        fs.appendFileSync(logFile, logContent);
        console.error(logContent);

        // Smart Alerting Logic
        if (context.critical) {
            const now = Date.now();
            const lastAlert = alertTracker.get(message) || 0;

            if (now - lastAlert > ALERT_COOLDOWN) {
                alertTracker.set(message, now);

                const emailHtml = `
                    <h3>🚨 Critical Server Error Alert</h3>
                    <p><strong>Time:</strong> ${timestamp}</p>
                    <p><strong>Message:</strong> ${message}</p>
                    <p><strong>Endpoint:</strong> ${context.url || 'N/A'}</p>
                    <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd;">${stack}</pre>
                `;

                try {
                    // await sendEmail(process.env.SMTP_USER, `[ALERT] ${message}`, emailHtml);
                    console.log('Skipping Alert email to prevent infinite loop for now.');
                } catch (emailErr) {
                    fs.appendFileSync(logFile, `[${timestamp}] FAILED TO SEND ALERT EMAIL: ${emailErr.message}\n`);
                }
            }
        }
    },
    info: (message) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`);
    }
};

module.exports = logger;
