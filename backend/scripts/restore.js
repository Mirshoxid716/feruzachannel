const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper'); // Needs install but I'll use a simpler approach or just unzipper

// For simplicity and since unzipper is a common tool, I'll use it.
// I'll need to npm install unzipper.

const zipFile = process.argv[2];
if (!zipFile) {
    console.error('Usage: node scripts/restore.js <path-to-zip>');
    process.exit(1);
}

const restorePath = path.join(__dirname, '../restore_test');

if (!fs.existsSync(restorePath)) {
    fs.mkdirSync(restorePath);
}

console.log(`Starting restore test of ${zipFile} to ${restorePath}...`);

fs.createReadStream(zipFile)
    .pipe(unzipper.Extract({ path: restorePath }))
    .on('close', () => {
        console.log('Restore completed. Verifying contents...');
        const dbExists = fs.existsSync(path.join(restorePath, 'database.sqlite'));
        const uploadsExists = fs.existsSync(path.join(restorePath, 'uploads'));

        if (dbExists && uploadsExists) {
            console.log('✅ Integrity Check Passed: DB and Uploads found.');
        } else {
            console.error('❌ Integrity Check Failed: Missing files.');
        }
    })
    .on('error', (err) => {
        console.error('Restore failed:', err);
    });
