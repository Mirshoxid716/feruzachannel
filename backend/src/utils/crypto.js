const crypto = require('crypto');

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string (default 32)
 * @returns {string}
 */
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generate a magic link for a lesson
 * @param {string} lessonId - The lesson ID
 * @returns {string}
 */
const generateMagicLink = (lessonId) => {
    // In a real app, this would be a full URL
    return `/lesson/${lessonId}`;
};

module.exports = {
    generateRandomString,
    generateMagicLink,
};
