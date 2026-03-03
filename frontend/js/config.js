const CONFIG = {
    // API_URL will be relative if on the same domain, otherwise localhost for dev
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : '/api',
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : window.location.origin
};

// Make it globally available
window.APP_CONFIG = CONFIG;
