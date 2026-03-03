const ADMIN_API = window.APP_CONFIG.API_URL + '/admin';
const PUBLIC_API = window.APP_CONFIG.API_URL;
let adminToken = localStorage.getItem('admin_token') || '';

let lessonId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!adminToken) {
        window.location.href = 'admin.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    lessonId = urlParams.get('id');

    if (!lessonId) {
        alert("Dars identifikatori topilmadi!");
        window.location.href = 'admin.html';
        return;
    }

    loadLessonDetails(lessonId);

    // YouTube preview listener
    const ytInput = document.getElementById('edit-lesson-url');
    if (ytInput) ytInput.addEventListener('input', showYoutubePreview);
});

function logoutAdmin() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.href = 'admin.html';
}

function getYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match ? match[1] : null;
}

function showYoutubePreview() {
    const url = document.getElementById('edit-lesson-url').value;
    let previewEl = document.getElementById('yt-preview');

    if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.id = 'yt-preview';
        document.getElementById('edit-lesson-url').parentElement.appendChild(previewEl);
    }

    const videoId = getYoutubeId(url);
    if (videoId) {
        previewEl.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;padding:10px;background:#f8fafc;border-radius:10px;margin-top:8px;">
                <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="width:160px;height:90px;border-radius:8px;object-fit:cover;">
                <div>
                    <div style="font-weight:600;color:#16a34a;">✅ YouTube video topildi</div>
                    <div style="font-size:0.85rem;color:#666;margin-top:4px;">Video ID: ${videoId}</div>
                </div>
            </div>
        `;
    } else if (url) {
        previewEl.innerHTML = '<div style="color:#dc2626;font-size:0.9rem;margin-top:8px;">⚠️ YouTube link noto\'g\'ri formatda</div>';
    } else {
        previewEl.innerHTML = '';
    }
}

async function loadLessonDetails(id) {
    try {
        const res = await fetch(`${PUBLIC_API}/lessons/${id}`);
        if (!res.ok) throw new Error("Darsni yuklab bo'lmadi");
        const lesson = await res.json();

        document.getElementById('edit-lesson-title').value = lesson.title || '';
        document.getElementById('edit-lesson-category').value = lesson.category || 'Barcha Darslar';
        document.getElementById('edit-lesson-desc').value = lesson.description || '';
        document.getElementById('edit-lesson-duration').value = lesson.duration || '';

        let videoInfo = "Faqat material yuklangan, video kiritilmagan.";
        if (lesson.youtube_url) {
            videoInfo = `<strong>YouTube:</strong> <a href="${lesson.youtube_url}" target="_blank">${lesson.youtube_url}</a>`;
            document.getElementById('edit-lesson-url').value = lesson.youtube_url;
            // Trigger preview
            showYoutubePreview();
        } else if (lesson.video_path) {
            videoInfo = `<strong>Lokal Server Video fayli:</strong> Yuklangan`;
        }
        document.getElementById('current-video-info').innerHTML = videoInfo;

        if (lesson.file_path) {
            const fileName = lesson.file_path.split('/').pop().split('\\').pop();
            document.getElementById('current-material-info').innerText = fileName;
        } else {
            document.getElementById('current-material-info').innerText = "Mavjud emas";
        }

        const thumbContainer = document.getElementById('current-thumbnail-info');
        if (lesson.thumbnail_path) {
            const thumbUrl = `${window.APP_CONFIG.BASE_URL}/${lesson.thumbnail_path.replace(/\\/g, '/')}`;
            thumbContainer.innerHTML = `<img src="${thumbUrl}" alt="Thumbnail" style="max-width:180px; border-radius:6px; border:1px solid #ddd;">`;
        } else if (lesson.youtube_url) {
            const yid = getYoutubeId(lesson.youtube_url);
            if (yid) thumbContainer.innerHTML = `<img src="https://img.youtube.com/vi/${yid}/hqdefault.jpg" alt="YouTube Thumbnail" style="max-width:180px; border-radius:6px;">`;
        } else {
            thumbContainer.innerText = "Thumbnail yuklanmagan";
        }
    } catch (error) {
        alert("Tarmoq xatosi yoki dars topilmadi!");
        window.location.href = 'admin.html';
    }
}

document.getElementById('edit-lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('edit-lesson-title').value;
    const category = document.getElementById('edit-lesson-category').value;
    const description = document.getElementById('edit-lesson-desc').value;
    const duration = document.getElementById('edit-lesson-duration').value;

    const youtube_url = document.getElementById('edit-lesson-url').value;
    const videoInput = document.getElementById('edit-lesson-video-file');
    const fileInput = document.getElementById('edit-lesson-file');
    const thumbnailInput = document.getElementById('edit-lesson-thumbnail');

    const lessonFile = fileInput.files[0];
    const videoFile = videoInput.files[0];
    const thumbnailFile = thumbnailInput ? thumbnailInput.files[0] : null;

    if (!title) {
        alert("Sarlavha kiritish majburiy!");
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('duration', duration);
    if (youtube_url) formData.append('youtube_url', youtube_url);
    if (videoFile) formData.append('video_file', videoFile);
    if (thumbnailFile) formData.append('thumbnail_file', thumbnailFile);
    if (lessonFile) formData.append('lesson_file', lessonFile);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const statusDiv = document.getElementById('upload-status');
    submitBtn.innerText = 'Saqlanmoqda...';
    submitBtn.disabled = true;
    statusDiv.innerText = "Ma'lumotlar serverga uzatilmoqda...";
    statusDiv.style.color = "blue";

    try {
        const res = await fetch(`${ADMIN_API}/lessons/${lessonId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            statusDiv.innerText = "Muvaffaqiyatli saqlandi!";
            statusDiv.style.color = "green";
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
        } else {
            statusDiv.innerText = data.error || 'Server xatosi!';
            statusDiv.style.color = "red";
            submitBtn.innerText = 'O\'zgarishlarni Saqlash';
            submitBtn.disabled = false;
        }
    } catch (error) {
        statusDiv.innerText = 'Tarmoq xatosi!';
        statusDiv.style.color = "red";
        submitBtn.innerText = 'O\'zgarishlarni Saqlash';
        submitBtn.disabled = false;
    }
});
