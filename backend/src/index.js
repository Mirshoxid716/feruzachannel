console.log('--- SERVER STARTING vFINAL ---');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');
require('./db/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://img.youtube.com"],
            frameSrc: ["'self'", "https://www.youtube.com"],
            connectSrc: ["'self'", "http://localhost:5000", "https://feruzachannel.onrender.com"],
        }
    }
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-admin-password', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // Limit each IP to 500 requests per hour
    message: { error: 'Too many requests from this IP, please try again after an hour.' }
});
app.use('/api/', limiter);

// More generous rate limiter for admin routes
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { error: 'Admin so\'rovlar limiti tugadi. 15 daqiqadan keyin urinib ko\'ring.' }
});
app.use('/api/admin', adminLimiter);
app.use('/api/admin-auth', adminLimiter);

// Logging
app.use(morgan('combined'));

// Essential Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching for admin related files
app.use((req, res, next) => {
    if (req.url.includes('/admin') || req.url.includes('.js')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// HTML Routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
});
app.get('/courses', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/courses.html'));
});
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/contact.html'));
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin-auth', require('./routes/adminRoutes'));
app.use('/api/contact', require('./routes/contact'));

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(`Critical Server Error at ${req.method} ${req.url}`, err, { critical: true, url: req.url });
    res.status(500).json({ error: 'Serverda ichki xatolik yuz berdi.' });
});

app.get('/', (req, res) => {
    res.json({ message: 'Feruza Channel Backend API is running' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Process Error Handlers
process.on('uncaughtException', (error) => {
    logger.error('CRITICAL: Uncaught Exception', error, { critical: true });
    // Give some time for the email to be sent before exiting
    setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection', reason instanceof Error ? reason : new Error(reason), { critical: true });
});
