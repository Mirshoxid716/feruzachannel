const API_BASE = window.APP_CONFIG.API_URL;
const ADMIN_API = `${API_BASE}/admin`;
const ADMIN_AUTH_API = `${API_BASE}/admin-auth`;

let adminToken = localStorage.getItem('admin_token') || '';
let currentAdmin = JSON.parse(localStorage.getItem('admin_info') || 'null');
let usersPage = 1;

// ======================================
// INITIALIZATION
// ======================================
document.addEventListener('DOMContentLoaded', () => {
    if (adminToken && currentAdmin) {
        showDashboard();
    }

    // Login Event
    const loginBtn = document.getElementById('admin-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', attemptAdminLogin);

    const usernameInput = document.getElementById('admin-username-input');
    const passInput = document.getElementById('admin-password-input');
    if (usernameInput) usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') passInput.focus(); });
    if (passInput) passInput.addEventListener('keypress', e => { if (e.key === 'Enter') attemptAdminLogin(); });

    // Profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.addEventListener('submit', saveProfile);

    // Add admin form
    const addAdminForm = document.getElementById('add-admin-form');
    if (addAdminForm) addAdminForm.addEventListener('submit', createAdmin);

    // Password Toggle
    const togglePass = document.getElementById('toggle-password');
    if (togglePass) {
        togglePass.addEventListener('click', function () {
            const passInput = document.getElementById('admin-password-input');
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }
});

// ======================================
// AUTH
// ======================================
async function attemptAdminLogin() {
    const username = document.getElementById('admin-username-input').value;
    const password = document.getElementById('admin-password-input').value;
    const error = document.getElementById('login-error');

    if (!username || !password) {
        error.innerText = 'Username va parolni kiriting!';
        return;
    }

    error.innerText = 'Yuklanmoqda...';

    try {
        const res = await fetch(`${ADMIN_AUTH_API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            adminToken = data.token;
            currentAdmin = data.admin;
            localStorage.setItem('admin_token', adminToken);
            localStorage.setItem('admin_info', JSON.stringify(currentAdmin));
            showDashboard();
        } else {
            error.innerText = data.error || 'Login xatosi!';
        }
    } catch (e) {
        error.innerText = 'Serverga ulanib bo\'lmadi';
    }
}

function showDashboard() {
    document.getElementById('admin-login-overlay').style.display = 'none';
    document.querySelector('.dashboard-wrapper').style.display = 'flex';

    // Show admin name in sidebar
    const nameEl = document.getElementById('sidebar-admin-name');
    if (nameEl && currentAdmin) nameEl.innerText = currentAdmin.username;

    // Show admins nav only for superuser
    if (currentAdmin && currentAdmin.role === 'superuser') {
        document.getElementById('nav-admins').style.display = 'flex';
    }

    refreshData();
}

function logoutAdmin() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    adminToken = '';
    currentAdmin = null;
    window.location.reload();
}

function authHeaders(extra = {}) {
    return { 'Authorization': `Bearer ${adminToken}`, ...extra };
}

// ======================================
// TABS
// ======================================
function switchTab(tab, element = null) {
    try {
        document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.admin-nav li').forEach(l => l.classList.remove('active'));

        const targetTab = document.getElementById(`tab-${tab}`);
        if (targetTab) targetTab.style.display = 'block';

        if (element) element.classList.add('active');

        if (tab === 'lessons') loadAdminLessons();
        if (tab === 'users') loadUsers();
        if (tab === 'ratings') loadRatings();
        if (tab === 'admins') loadAdmins();
        if (tab === 'profile') loadProfile();
    } catch (e) {
        console.error('Tab switch xatosi:', e);
    }
}

// ======================================
// STATS
// ======================================
async function fetchStats() {
    try {
        const res = await fetch(`${ADMIN_API}/stats`, {
            headers: authHeaders()
        });
        if (res.ok) {
            const stats = await res.json();
            document.getElementById('stat-lessons-count').innerText = stats.lessons_count;
            document.getElementById('stat-total-students').innerText = stats.users_count;
            document.getElementById('stat-avg-rating').innerText = stats.avg_rating;
            document.getElementById('stat-today-active').innerText = stats.today_active;
            return true;
        }
        if (res.status === 401) {
            logoutAdmin();
        }
        return false;
    } catch (e) {
        return false;
    }
}

function refreshData() {
    fetchStats();
}

// ======================================
// LESSONS
// ======================================
async function loadAdminLessons() {
    try {
        const res = await fetch(`${ADMIN_API}/lessons`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error("Failed to fetch lessons");

        const lessons = await res.json();
        const list = document.getElementById('admin-lessons-list');

        if (lessons.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#999;">Hozircha darslar yo\'q</td></tr>';
            return;
        }

        list.innerHTML = lessons.map(l => {
            const ytPreview = l.youtube_url ? getYoutubeId(l.youtube_url) : null;
            const pdfName = l.file_path ? l.file_path.split('/').pop() : null;
            return `
            <tr>
                <td>
                    <div class="lesson-cell">
                        ${ytPreview ? `<img src="https://img.youtube.com/vi/${ytPreview}/mqdefault.jpg" class="lesson-thumb-mini">` : ''}
                        <strong>${l.title}</strong>
                    </div>
                </td>
                <td>${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="yt-link">▶ YouTube</a>` : '<span class="text-muted">—</span>'}</td>
                <td>
                    ${pdfName
                    ? `<span class="pdf-badge pdf-exists">📄 Mavjud</span>
                           <div class="pdf-filename">${pdfName}</div>`
                    : `<span class="pdf-badge pdf-missing">⚠️ Yo'q</span>`
                }
                    <label class="btn-sm btn-pdf-upload">
                        📎 ${pdfName ? 'Almashtirish' : 'Yuklash'}
                        <input type="file" accept=".pdf,.zip" style="display:none;" onchange="uploadPdf('${l.id}', this)">
                    </label>
                </td>
                <td><span class="status-badge ${l.is_active ? 'active' : 'inactive'}">${l.is_active ? 'Faol' : 'Yashirilgan'}</span></td>
                <td class="actions-cell">
                    <button data-action="toggle" data-id="${l.id}" class="btn-sm ${l.is_active ? 'btn-warn' : 'btn-success'}">${l.is_active ? 'Yashirish' : 'Ko\'rsatish'}</button>
                    <a href="admin-edit-lesson.html?id=${l.id}" class="btn-sm btn-edit">✏️</a>
                    <button data-action="delete" data-id="${l.id}" class="btn-sm btn-danger">🗑️ O'chirish</button>
                </td>
            </tr>
        `}).join('');

        // Event delegation for action buttons
        list.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', function () {
                const action = this.dataset.action;
                const id = this.dataset.id;
                if (action === 'toggle') toggleLesson(id);
                if (action === 'delete') deleteLesson(id);
            });
        });
    } catch (e) {
        console.error("Xatolik: ", e);
        document.getElementById('admin-lessons-list').innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Darslarni yuklashda xatolik.</td></tr>`;
    }
}

async function uploadPdf(lessonId, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf_file', file);

    // Show loading state
    const row = inputEl.closest('tr');
    const pdfCell = row.querySelectorAll('td')[2];
    const origHtml = pdfCell.innerHTML;
    pdfCell.innerHTML = '<span style="color:#6366f1;font-weight:600;">⏳ Yuklanmoqda...</span>';

    try {
        const res = await fetch(`${ADMIN_API}/lessons/${lessonId}/upload-pdf`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            loadAdminLessons(); // Reload the table
        } else {
            alert(data.error || 'PDF yuklashda xatolik');
            pdfCell.innerHTML = origHtml;
        }
    } catch (e) {
        alert('Tarmoq xatosi');
        pdfCell.innerHTML = origHtml;
    }
}

async function toggleLesson(id) {
    const res = await fetch(`${ADMIN_API}/lessons/${id}/toggle`, {
        method: 'PATCH',
        headers: authHeaders()
    });
    if (res.ok) loadAdminLessons();
}

async function deleteLesson(id) {
    if (!confirm('Bu darsni o\'chirmoqchimisiz?')) return;
    const res = await fetch(`${ADMIN_API}/lessons/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    if (res.ok) {
        loadAdminLessons();
        refreshData();
    }
}

// ======================================
// USERS
// ======================================
async function loadUsers(page = 1) {
    usersPage = page;
    const search = document.getElementById('users-search')?.value || '';

    try {
        const res = await fetch(`${ADMIN_API}/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Error');

        const data = await res.json();
        const list = document.getElementById('admin-users-list');

        if (data.users.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#999;">Foydalanuvchilar topilmadi</td></tr>';
            document.getElementById('users-pagination').innerHTML = '';
            return;
        }

        list.innerHTML = data.users.map((u, i) => `
            <tr>
                <td>${(page - 1) * 20 + i + 1}</td>
                <td><strong>${u.full_name}</strong></td>
                <td>${u.email}</td>
                <td>${u.last_login ? formatDate(u.last_login) : '<span class="text-muted">Hech qachon</span>'}</td>
                <td>${formatDate(u.created_at)}</td>
            </tr>
        `).join('');

        // Pagination
        const pagEl = document.getElementById('users-pagination');
        if (data.totalPages > 1) {
            let html = '';
            for (let i = 1; i <= data.totalPages; i++) {
                html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="loadUsers(${i})">${i}</button>`;
            }
            pagEl.innerHTML = html;
        } else {
            pagEl.innerHTML = '';
        }
    } catch (e) {
        document.getElementById('admin-users-list').innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Xatolik</td></tr>';
    }
}

let searchTimeout;
function searchUsers() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(1), 300);
}

// ======================================
// RATINGS
// ======================================
async function loadRatings() {
    try {
        const res = await fetch(`${ADMIN_API}/ratings`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Error');

        const ratings = await res.json();
        const list = document.getElementById('admin-ratings-list');

        if (ratings.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#999;">Hozircha reytinglar yo\'q</td></tr>';
            return;
        }

        list.innerHTML = ratings.map(r => `
            <tr>
                <td><strong>${r.full_name || 'Noma\'lum'}</strong><br><small class="text-muted">${r.email || ''}</small></td>
                <td>${r.lesson_title || r.lesson_id}</td>
                <td>${renderStars(r.rating)}</td>
                <td>${r.comment || '<span class="text-muted">—</span>'}</td>
                <td>${formatDate(r.created_at)}</td>
            </tr>
        `).join('');
    } catch (e) {
        document.getElementById('admin-ratings-list').innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Xatolik</td></tr>';
    }
}

// ======================================
// ADMINS MANAGEMENT
// ======================================
async function loadAdmins() {
    try {
        const res = await fetch(`${ADMIN_AUTH_API}/admins`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Error');

        const admins = await res.json();
        const list = document.getElementById('admin-admins-list');

        list.innerHTML = admins.map(a => {
            const perms = a.permissions || {};
            const permTags = Object.entries(perms)
                .filter(([k, v]) => v)
                .map(([k]) => `<span class="perm-tag">${formatPermName(k)}</span>`)
                .join('');

            return `
            <tr>
                <td><strong>${a.username}</strong></td>
                <td>${a.email}</td>
                <td><span class="role-badge role-${a.role}">${a.role}</span></td>
                <td>${a.role === 'superuser' ? '<span class="text-muted">Barcha ruxsatlar</span>' : (permTags || '<span class="text-muted">—</span>')}</td>
                <td>
                    ${a.id !== currentAdmin.id ? `<button onclick="deleteAdmin(${a.id})" class="btn-sm btn-danger">O'chirish</button>` : '<span class="text-muted">Siz</span>'}
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        document.getElementById('admin-admins-list').innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Xatolik</td></tr>';
    }
}

function openAddAdminModal() { document.getElementById('add-admin-modal').style.display = 'flex'; }
function closeAddAdminModal() { document.getElementById('add-admin-modal').style.display = 'none'; }

async function createAdmin(e) {
    e.preventDefault();

    const permissions = {
        manage_lessons: document.getElementById('perm-manage-lessons').checked,
        manage_users: document.getElementById('perm-manage-users').checked,
        view_ratings: document.getElementById('perm-view-ratings').checked,
        export_data: document.getElementById('perm-export-data').checked,
        manage_admins: document.getElementById('perm-manage-admins').checked
    };

    const body = {
        username: document.getElementById('new-admin-username').value,
        email: document.getElementById('new-admin-email').value,
        password: document.getElementById('new-admin-password').value,
        role: document.getElementById('new-admin-role').value,
        permissions
    };

    try {
        const res = await fetch(`${ADMIN_AUTH_API}/admins`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            closeAddAdminModal();
            loadAdmins();
            document.getElementById('add-admin-form').reset();
            alert('Admin muvaffaqiyatli qo\'shildi!');
        } else {
            alert(data.error || 'Xatolik');
        }
    } catch (e) {
        alert('Server xatosi');
    }
}

async function deleteAdmin(id) {
    if (!confirm('Bu adminni o\'chirmoqchimisiz?')) return;

    const res = await fetch(`${ADMIN_AUTH_API}/admins/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    if (res.ok) {
        loadAdmins();
    } else {
        const data = await res.json();
        alert(data.error || 'Xatolik');
    }
}

// ======================================
// PROFILE
// ======================================
async function loadProfile() {
    try {
        const res = await fetch(`${ADMIN_AUTH_API}/profile`, {
            headers: authHeaders()
        });
        if (!res.ok) return;

        const profile = await res.json();
        document.getElementById('profile-username').value = profile.username;
        document.getElementById('profile-email').value = profile.email;
        document.getElementById('profile-role-badge').innerText = profile.role === 'superuser' ? '🛡️ Superuser' : '👤 Admin';
        document.getElementById('profile-role-badge').className = `profile-role-badge role-${profile.role}`;
    } catch (e) { }
}

async function saveProfile(e) {
    e.preventDefault();
    const msgEl = document.getElementById('profile-message');

    const body = {
        username: document.getElementById('profile-username').value,
        email: document.getElementById('profile-email').value
    };

    const currentPass = document.getElementById('profile-current-password').value;
    const newPass = document.getElementById('profile-new-password').value;

    if (newPass) {
        if (!currentPass) {
            msgEl.innerText = 'Joriy parolni kiriting';
            msgEl.style.color = 'red';
            return;
        }
        body.current_password = currentPass;
        body.new_password = newPass;
    }

    try {
        const res = await fetch(`${ADMIN_AUTH_API}/profile`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            msgEl.innerText = '✅ Muvaffaqiyatli saqlandi!';
            msgEl.style.color = 'green';

            // Update local info
            currentAdmin.username = body.username;
            currentAdmin.email = body.email;
            localStorage.setItem('admin_info', JSON.stringify(currentAdmin));
            document.getElementById('sidebar-admin-name').innerText = body.username;

            // Clear password fields
            document.getElementById('profile-current-password').value = '';
            document.getElementById('profile-new-password').value = '';
        } else {
            msgEl.innerText = data.error || 'Xatolik';
            msgEl.style.color = 'red';
        }
    } catch (e) {
        msgEl.innerText = 'Server xatosi';
        msgEl.style.color = 'red';
    }

    setTimeout(() => msgEl.innerText = '', 3000);
}

// ======================================
// HELPERS
// ======================================
function getYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match ? match[1] : null;
}

function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? '⭐' : '☆';
    }
    return `<span class="star-display">${stars}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function formatPermName(key) {
    const names = {
        manage_lessons: 'Darslar',
        manage_users: 'Foydalanuvchilar',
        view_ratings: 'Reytinglar',
        export_data: 'Eksport',
        manage_admins: 'Adminlar'
    };
    return names[key] || key;
}

function exportEmailData() {
    window.open(`${ADMIN_API}/export-emails`, '_blank');
}
