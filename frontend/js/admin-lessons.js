const ADMIN_API = window.APP_CONFIG.API_URL + '/admin';

function getAdminToken() {
    return localStorage.getItem('admin_token') || '';
}

function logoutAdmin() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.replace('admin.html');
}

function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
}

async function readErrorBody(res) {
    const text = await res.text().catch(() => '');
    if (!text) return '';
    try {
        const j = JSON.parse(text);
        return j?.error || j?.message || text;
    } catch {
        return text;
    }
}

/**
 * Admin fetch helper:
 * - Bearer token yuboradi
 * - Fallback: x-admin-token ham yuboradi (backend boshqa header kutsa)
 * - 401/403 bo'lsa logout qiladi
 * - res.ok false bo'lsa ham callerga res qaytaradi (caller xabar chiqaradi)
 */
async function adminFetch(path, options = {}) {
    const token = getAdminToken();
    if (!token) {
        alert("Token topilmadi. Qayta kiring.");
        logoutAdmin();
        return null;
    }

    const res = await fetch(`${ADMIN_API}${path}`, {
        ...options,
        headers: {
            'Accept': 'application/json',
            ...(options.headers || {}),
            'Authorization': `Bearer ${token}`,
            'x-admin-token': token, // fallback (ba'zi backendlar shuni kutadi)
        },
    });

    if (res.status === 401 || res.status === 403) {
        const msg = await readErrorBody(res);
        alert(msg || "Sessiya tugagan yoki ruxsat yo‘q. Qayta kiring.");
        logoutAdmin();
        return null;
    }

    return res;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!getAdminToken()) {
        logoutAdmin();
        return;
    }

    const list = document.getElementById('admin-lessons-list');
    if (!list) {
        console.error('[Admin] #admin-lessons-list topilmadi');
        return;
    }

    // Event delegation (onclicksiz)
    list.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        // Agar table/form ichida bo'lsa submit bo'lib ketmasin
        e.preventDefault();
        e.stopPropagation();

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (!action || !id) return;

        if (action === 'toggle') return toggleLesson(id);
        if (action === 'edit') return editLesson(id);
        if (action === 'delete') return deleteLesson(id);
    });

    loadAdminLessons();
});

async function loadAdminLessons() {
    const list = document.getElementById('admin-lessons-list');
    list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">Yuklanmoqda...</td></tr>`;

    try {
        const res = await adminFetch('/lessons');
        if (!res) return;

        if (!res.ok) {
            const msg = await readErrorBody(res);
            throw new Error(msg || ('Server xatosi: ' + res.status));
        }

        const lessons = await res.json().catch(() => []);
        if (!Array.isArray(lessons) || lessons.length === 0) {
            list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#888;">Hali darslar qo'shilmagan.</td></tr>`;
            return;
        }

        list.innerHTML = lessons.map((l) => {
            const title = escapeHtml(l.title || '');
            const isActive = !!l.is_active;

            const ytId = l.youtube_url ? getYoutubeId(l.youtube_url) : null;
            const videoBadge = ytId
                ? `<a href="${escapeHtml(l.youtube_url)}" target="_blank" rel="noopener" class="yt-link">▶ YouTube</a>`
                : l.video_path
                    ? `<span style="color:#16a34a;">📹 Video Fayl</span>`
                    : `<span class="text-muted">—</span>`;

            return `
        <tr>
          <td>
            <div class="lesson-cell">
              ${ytId ? `<img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" class="lesson-thumb-mini">` : ''}
              <strong>${title}</strong>
            </div>
          </td>
          <td>${videoBadge}</td>
          <td>
            <span class="status-badge ${isActive ? 'active' : 'inactive'}">
              ${isActive ? 'Faol' : 'Yashirilgan'}
            </span>
          </td>
          <td class="actions-cell">
            <button type="button" data-action="toggle" data-id="${escapeHtml(l.id)}" class="btn-sm ${isActive ? 'btn-warn' : 'btn-success'}">
              ${isActive ? 'Yashirish' : "Ko'rsatish"}
            </button>
            <button type="button" data-action="edit" data-id="${escapeHtml(l.id)}" class="btn-sm btn-edit">✏️</button>
            <button type="button" data-action="delete" data-id="${escapeHtml(l.id)}" class="btn-sm btn-danger">🗑️</button>
          </td>
        </tr>
      `;
        }).join('');

    } catch (e) {
        console.error('[Admin] loadAdminLessons error:', e);
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:20px;">Xatolik: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function getYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match ? match[1] : null;
}

async function toggleLesson(id) {
    try {
        const res = await adminFetch(`/lessons/${encodeURIComponent(id)}/toggle`, { method: 'PATCH' });
        if (!res) return;

        if (!res.ok) {
            const msg = await readErrorBody(res);
            alert(msg || `Holat o‘zgartirishda xatolik. Status: ${res.status}`);
            return;
        }

        loadAdminLessons();
    } catch (e) {
        alert('Tarmoq xatosi: ' + e.message);
    }
}

function editLesson(id) {
    window.location.href = `admin-edit-lesson.html?id=${encodeURIComponent(id)}`;
}

async function deleteLesson(id) {
    const ok = confirm("Bu darsni o'chirmoqchimisiz?\n\nEslatma: o‘chirish qaytarilmaydi.");
    if (!ok) return;

    try {
        const res = await adminFetch(`/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res) return;

        if (!res.ok) {
            const msg = await readErrorBody(res);
            alert(msg || `O‘chirishda xatolik. Status: ${res.status}`);
            return;
        }

        alert("✅ Dars o‘chirildi.");
        loadAdminLessons();
    } catch (e) {
        alert('Tarmoq xatosi: ' + e.message);
    }
}