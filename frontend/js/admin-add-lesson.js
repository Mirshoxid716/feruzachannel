const ADMIN_API = window.APP_CONFIG.API_URL + '/admin';
let adminToken = localStorage.getItem('admin_token') || '';

document.addEventListener('DOMContentLoaded', () => {
    if (!adminToken) {
        window.location.href = 'admin.html';
        return;
    }

    // YouTube preview listener
    const ytInput = document.getElementById('new-lesson-url');
    if (ytInput) {
        ytInput.addEventListener('input', showYoutubePreview);
    }
});

function logoutAdmin() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.href = 'admin.html';
}

function showYoutubePreview() {
    const url = document.getElementById('new-lesson-url').value;
    let previewEl = document.getElementById('yt-preview');

    if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.id = 'yt-preview';
        previewEl.style.cssText = 'margin-top:10px;border-radius:12px;overflow:hidden;';
        document.getElementById('new-lesson-url').parentElement.appendChild(previewEl);
    }

    const videoId = getYoutubeId(url);
    if (videoId) {
        previewEl.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;padding:10px;background:#f8fafc;border-radius:10px;margin-top:8px;">
                <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="width:160px;height:90px;border-radius:8px;object-fit:cover;">
                <div>
                    <div style="font-weight:600;color:#16a34a;">✅ YouTube video topildi</div>
                    <div style="font-size:0.85rem;color:#666;margin-top:4px;">Video ID: ${videoId}</div>
                    <iframe width="0" height="0" style="display:none;" src="https://www.youtube.com/embed/${videoId}" id="yt-embed-check"></iframe>
                </div>
            </div>
        `;
    } else if (url) {
        previewEl.innerHTML = '<div style="color:#dc2626;font-size:0.9rem;margin-top:8px;">⚠️ YouTube link noto\'g\'ri formatda</div>';
    } else {
        previewEl.innerHTML = '';
    }
}

function getYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match ? match[1] : null;
}

document.getElementById('add-lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('new-lesson-title').value;
    const category = document.getElementById('new-lesson-category').value;
    const description = document.getElementById('new-lesson-desc').value;
    const duration = document.getElementById('new-lesson-duration').value;

    const youtube_url = document.getElementById('new-lesson-url').value;
    const videoInput = document.getElementById('new-lesson-video-file');
    const fileInput = document.getElementById('new-lesson-file');

    const lessonFile = fileInput.files[0];
    const videoFile = videoInput.files[0];
    const thumbnailInput = document.getElementById('new-lesson-thumbnail');
    const thumbnailFile = thumbnailInput ? thumbnailInput.files[0] : null;

    if (!title || !lessonFile) {
        alert("Sarlavha va material (PDF/ZIP) kiritish majburiy!");
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
    formData.append('lesson_file', lessonFile);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const statusDiv = document.getElementById('upload-status');
    submitBtn.innerText = 'Yuklanmoqda...';
    submitBtn.disabled = true;
    statusDiv.innerText = "Fayllar serverga yuklanmoqda...";
    statusDiv.style.color = "blue";

    try {
        const res = await fetch(`${ADMIN_API}/lessons`, {
            method: 'POST',
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
            }, 1500);
        } else {
            statusDiv.innerText = data.error || 'Server xatosi!';
            statusDiv.style.color = "red";
            submitBtn.innerText = 'Darsni Saqlash va Tarqatish';
            submitBtn.disabled = false;
        }
    } catch (error) {
        statusDiv.innerText = 'Tarmoq xatosi!';
        statusDiv.style.color = "red";
        submitBtn.innerText = 'Darsni Saqlash va Tarqatish';
        submitBtn.disabled = false;
    }
});
