const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const BACKUP_DIR = path.join(__dirname, '../backups');
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const DB_FILE = path.join(__dirname, '../database.sqlite');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 10);
const fileName = `backup-${timestamp}.zip`;
const output = fs.createWriteStream(path.join(BACKUP_DIR, fileName));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`Backup completed successfully: ${fileName} (${archive.pointer()} bytes)`);
    cleanOldBackups();
});

archive.on('error', (err) => {
    console.error('Archive error:', err);
    process.exit(1);
});

archive.pipe(output);

// Append database file
if (fs.existsSync(DB_FILE)) {
    archive.file(DB_FILE, { name: 'database.sqlite' });
}

// Append uploads folder
if (fs.existsSync(UPLOADS_DIR)) {
    archive.directory(UPLOADS_DIR, 'uploads');
}

archive.finalize();

function cleanOldBackups() {
    const RETENTION_DAYS = 7;
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(filePath);
            const now = new Date().getTime();
            const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            if (ageInDays > RETENTION_DAYS) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old backup: ${file}`);
            }
        });
    });
}
