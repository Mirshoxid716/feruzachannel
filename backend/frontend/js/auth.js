const AUTH_API = `${window.APP_CONFIG.API_URL}/auth`;

function saveAuthData(token, user) {
    localStorage.setItem('user_token', token);
    localStorage.setItem('user_info', JSON.stringify(user));
}

function getAuthToken() {
    return localStorage.getItem('user_token');
}

function getUserInfo() {
    const data = localStorage.getItem('user_info');
    return data ? JSON.parse(data) : null;
}

function logout() {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_info');
    window.location.href = 'index.html';
}

function requireAuth() {
    if (!getAuthToken()) {
        // Logindan keyin qayerga qaytishni eslab qolish
        sessionStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function redirectAfterLogin() {
    const target = sessionStorage.getItem('redirect_after_login') || 'profile.html';
    sessionStorage.removeItem('redirect_after_login');
    window.location.href = target;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.innerText = 'Yuklanmoqda...';

    try {
        const res = await fetch(`${AUTH_API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            saveAuthData(data.token, data.user);
            redirectAfterLogin();
        } else {
            errorEl.innerText = data.error || 'Autentifikatsiya xatosi';
        }
    } catch (err) {
        errorEl.innerText = 'Serverga ulanib bo\'lmadi';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const full_name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');

    errorEl.innerText = 'Yuklanmoqda...';

    if (password.length < 6) {
        errorEl.innerText = 'Parol kamida 6 belgi bo\'lishi kerak';
        return;
    }

    try {
        const res = await fetch(`${AUTH_API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            // Log in the user immediately after registration
            const loginRes = await fetch(`${AUTH_API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const loginData = await loginRes.json();
            if (loginRes.ok) saveAuthData(loginData.token, loginData.user);

            redirectAfterLogin();
        } else {
            errorEl.innerText = data.error || 'Ro\'yxatdan o\'tishda xatolik';
        }
    } catch (err) {
        errorEl.innerText = 'Serverga ulanib bo\'lmadi';
    }
}
