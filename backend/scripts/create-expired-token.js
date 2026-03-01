const db = require('../db/database');

const expiredToken = 'expired-test-token-123';
const expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

db.run(
    'INSERT INTO verification_tokens (token, email, lesson_id, expires_at) VALUES (?, ?, ?, ?)',
    [expiredToken, 'test@example.com', 'lesson1', expiresAt],
    (err) => {
        if (err) console.error('Error inserting expired token:', err);
        else console.log('Inserted expired token:', expiredToken);
        process.exit(0);
    }
);
