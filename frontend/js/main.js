const API_URL = window.APP_CONFIG.API_URL;

// Load lessons on index or courses page
document.addEventListener('DOMContentLoaded', () => {
    const lessonsList = document.getElementById('lessons-list');
    if (lessonsList) {
        loadLessons();
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }

    // New Dashboard Search Logic
    const searchInput = document.getElementById('course-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterLessons(e.target.value);
        });
    }
});

let allLessons = [];

async function loadLessons() {
    try {
        const response = await fetch(`${API_URL}/lessons`);
        allLessons = await response.json();
        renderLessons(allLessons);
    } catch (error) {
        console.error('Error loading lessons:', error);
        const lessonsContainer = document.getElementById('lessons-list');
        if (lessonsContainer) {
            lessonsContainer.innerHTML = '<p style="color: red; grid-column: 1/-1; text-align: center;">Darslarni yuklashda xatolik yuz berdi.</p>';
        }
    }
}

function getYoutubeThumbnail(url) {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length == 11) {
        return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
    }
    return null;
}

function renderLessons(lessons) {
    const lessonsContainer = document.getElementById('lessons-list');
    if (!lessonsContainer) return;

    lessonsContainer.innerHTML = '';

    if (lessons.length === 0) {
        lessonsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Hozircha darslar mavjud emas.</p>';
        return;
    }

    lessons.forEach(lesson => {
        const card = document.createElement('div');
        const isDashboard = document.body.classList.contains('courses-page-v2');
        const thumbUrl = getYoutubeThumbnail(lesson.youtube_url)
            || (lesson.thumbnail_path ? `${window.APP_CONFIG.BASE_URL}/${lesson.thumbnail_path.replace(/\\/g, '/')}` : null);

        // Agar rasm topilmasa, gradient fon qo'yamiz.
        const thumbHtml = thumbUrl
            ? `<div class="thumb-placeholder" style="background-image: url('${thumbUrl}'); background-size: cover; background-position: center;"></div>`
            : `<div class="thumb-placeholder" style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);"></div>`;

        const durationHtml = lesson.duration ? `<span class="duration">${lesson.duration}</span>` : '';
        const categoryHtml = lesson.category ? `<span class="category-badge" style="font-size:12px; font-weight:bold; color:#FF0000; margin-bottom: 5px; display:block;">${lesson.category}</span>` : '';

        if (isDashboard) {
            card.className = 'video-placeholder-card';
            card.onclick = () => window.location.href = `lesson.html?id=${lesson.id}`;
            card.innerHTML = `
                <div class="video-thumb-wrapper">
                    ${thumbHtml}
                    ${durationHtml}
                </div>
                <div style="padding: 10px 0;">
                    ${categoryHtml}
                    <h3 class="video-title" style="margin: 0; font-size: 16px;">${lesson.title}</h3>
                    <p style="font-size: 13px; color: #666; margin-top: 5px; height: 38px; overflow: hidden;">${lesson.description || ''}</p>
                </div>
            `;
        } else {
            card.className = 'lesson-card animate';
            let mediaLinkHtml = '';
            if (lesson.youtube_url) {
                mediaLinkHtml = `<a href="${lesson.youtube_url}" target="_blank" class="btn" style="background: #FF0000; color: white;">YouTube</a>`;
            } else if (lesson.video_path) {
                mediaLinkHtml = `<a href="lesson.html?id=${lesson.id}" class="btn" style="background: #4F46E5; color: white;">Videoni ko'rish</a>`;
            }

            card.innerHTML = `
                ${categoryHtml}
                <h3>${lesson.title}</h3>
                <p>${lesson.description || ''}</p>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    ${mediaLinkHtml}
                    <a href="lesson.html?id=${lesson.id}" class="btn btn-primary">Material</a>
                </div>
            `;
        }
        lessonsContainer.appendChild(card);
    });
}

function filterLessons(query) {
    const filtered = allLessons.filter(l =>
        l.title.toLowerCase().includes(query.toLowerCase())
    );
    renderLessons(filtered);

    const emptyState = document.getElementById('empty-dashboard');
    if (emptyState) {
        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    const status = document.getElementById('contact-status');
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
    };

    status.innerText = 'Yuborilmoqda...';
    try {
        const response = await fetch(`${API_URL}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await response.json();

        status.style.color = response.ok ? 'green' : 'red';
        status.innerText = result.message || result.error || 'Xato yuz berdi';

        if (response.ok) e.target.reset();
    } catch (error) {
        status.style.color = 'red';
        status.innerText = 'Serverga bog\'lanishda xatolik yoki juda ko\'p urinish.';
    }
}

// Lesson page functions
async function fetchLessonDetails(id) {
    try {
        const response = await fetch(`${API_URL}/lessons/${id}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Dars topilmadi');
        }
        const lesson = await response.json();
        document.getElementById('lesson-title').innerText = lesson.title;
        document.title = `${lesson.title} - Feruza Channel`;
    } catch (error) {
        document.getElementById('lesson-title').innerText = 'Dars topilmadi';
        document.getElementById('lesson-info').innerHTML += `<p style="color: red;">${error.message}</p>`;
    }
}

async function handleMaterialRequest(e, lessonId) {
    e.preventDefault();
    const status = document.getElementById('request-status');
    const email = document.getElementById('user-email').value;

    status.innerText = 'Yozib olinmoqda...';
    try {
        const response = await fetch(`${API_URL}/lessons/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId, email })
        });
        const result = await response.json();
        status.style.color = response.ok ? 'green' : 'red';
        status.innerText = result.message || result.error || 'Xato yuz berdi';
    } catch (error) {
        status.innerText = 'Serverga bog\'lanishda xatolik.';
        status.style.color = 'red';
    }
}
