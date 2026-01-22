const DISCORD_ID = '950633437000241175';
const FALLBACK_AVATAR = 'https://i.pinimg.com/736x/88/c3/38/88c3383a595952f144f80879e19d7d3d.jpg';

let lanyardData = null;

// Часы
function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 10000);
updateClock();

// API Lanyard
async function fetchLanyard() {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
        const { data, success } = await res.json();
        if (success) {
            lanyardData = data;
            updateUI();
        }
    } catch (e) { console.error("Lanyard error:", e); }
}

function updateUI() {
    if (!lanyardData) return;
    const { discord_user, discord_status, activities, listening_to_spotify, spotify } = lanyardData;

    // Аватар
    document.getElementById('main-avatar').src = discord_user.avatar 
        ? `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${discord_user.avatar}.png?size=256` 
        : FALLBACK_AVATAR;

    // Статус
    const statusText = document.getElementById('discord-status-text');
    const custom = activities.find(a => a.type === 4);
    
    // Приоритет отображения: кастомный статус -> статус в игре -> обычный статус
    if (custom && custom.state) {
        statusText.innerText = custom.state;
    } else {
        statusText.innerText = discord_status.charAt(0).toUpperCase() + discord_status.slice(1);
    }

    // Spotify виджет в главном меню
    renderSpotify(listening_to_spotify, spotify);
}

function renderSpotify(active, data) {
    const container = document.getElementById('spotify-widget');
    if (!active || !data) {
        container.innerHTML = `<div class="spot-no-music"><i class="fa-brands fa-spotify"></i> Not listening to anything</div>`;
        return;
    }

    container.innerHTML = `
        <div class="spot-content">
            <img class="spot-img" src="${data.album_art_url}" alt="Album Art">
            <div class="spot-info">
                <a href="https://open.spotify.com/track/${data.track_id}" target="_blank" class="spot-title">${data.song}</a>
                <span class="spot-artist">${data.artist}</span>
            </div>
            <i class="fa-brands fa-spotify" style="color:#1db954; font-size:1.4rem; margin-left:auto;"></i>
        </div>
        <div class="spot-progress-container">
            <div class="spot-bar-bg"><div id="spot-fill" class="spot-bar-fill"></div></div>
            <div class="spot-time">
                <span id="spot-start">0:00</span>
                <span id="spot-end">0:00</span>
            </div>
        </div>
    `;
    updateSpotifyProgress();
}

function updateSpotifyProgress() {
    if (!lanyardData || !lanyardData.listening_to_spotify) return;
    const s = lanyardData.spotify;
    const total = s.timestamps.end - s.timestamps.start;
    const current = Date.now() - s.timestamps.start;
    const prg = Math.min(100, Math.max(0, (current / total) * 100));

    const fill = document.getElementById('spot-fill');
    if (fill) fill.style.width = prg + '%';

    const fmt = (ms) => {
        const sec = Math.floor((ms / 1000) % 60);
        return Math.floor(ms / 60000) + ":" + (sec < 10 ? "0" + sec : sec);
    };

    if (document.getElementById('spot-start')) {
        document.getElementById('spot-start').innerText = fmt(current);
        document.getElementById('spot-end').innerText = fmt(total);
    }
}
setInterval(updateSpotifyProgress, 1000);

// Модалка (ИСПРАВЛЕННАЯ ЛОГИКА)
const modal = document.getElementById('discordModal');

function openDiscordModal() {
    modal.classList.add('active');
    if (!lanyardData) return;
    const { discord_user: u, discord_status: s, activities: acts, spotify } = lanyardData;
    const colors = { online: '#23a559', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e' };

    document.getElementById('dc-avatar').src = u.avatar ? `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${u.avatar}.png?size=256` : FALLBACK_AVATAR;
    document.getElementById('dc-username').innerText = u.global_name || u.username;
    document.getElementById('dc-tag').innerText = `@${u.username}`;
    document.getElementById('dc-status').style.backgroundColor = colors[s] || colors.offline;

    const rpc = document.getElementById('rpc-content');
    
    // Находим активность, которая НЕ является кастомным статусом
    const act = acts.find(a => a.type !== 4);

    if (act) {
        let largeImage = 'https://i.imgur.com/3Q9XY1r.png'; // Заглушка
        let smallImage = null;

        // Если это Spotify, берем картинку из объекта spotify
        if (act.name === 'Spotify' && spotify) {
            largeImage = spotify.album_art_url;
        } 
        // Если это другая игра с картинками
        else if (act.assets?.large_image) {
            if (act.assets.large_image.startsWith('mp:')) {
                largeImage = act.assets.large_image.replace('mp:', 'https://media.discordapp.net/');
            } else {
                largeImage = `https://cdn.discordapp.com/app-assets/${act.application_id}/${act.assets.large_image}.png`;
            }
        }

        // Рендерим HTML
        rpc.innerHTML = `
            <div style="position:relative; width:60px; height:60px; flex-shrink:0;">
                <img src="${largeImage}" style="width:100%; height:100%; border-radius:8px; object-fit:cover;">
            </div>
            <div style="overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
                <div style="font-size:0.9rem; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${act.name}
                </div>
                <div style="font-size:0.75rem; color:#b9bbbe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${act.details || ''}
                </div>
                <div style="font-size:0.75rem; color:#b9bbbe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${act.state || ''}
                </div>
            </div>
        `;
    } else {
        rpc.innerHTML = `<span style="color:#72767d; font-size:0.8rem;">Currently not playing anything</span>`;
    }
}

function closeDiscordModal(e, force = false) { if (force || e.target === modal) modal.classList.remove('active'); }

document.getElementById('dc-tag').onclick = () => {
    if(!lanyardData) return;
    navigator.clipboard.writeText(lanyardData.discord_user.username);
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = 'Username copied!';
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 2500);
};

// Снег
const canvas = document.getElementById('snowCanvas');
const ctx = canvas.getContext('2d');
let snowflakes = [];

class Snowflake {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.radius = Math.random() * 1.5 + 0.8;
        this.speedY = Math.random() * 0.6 + 0.3;
        this.wobbleAngle = Math.random() * Math.PI * 2;
        this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
        this.y += this.speedY;
        this.x += Math.sin(this.wobbleAngle) * 0.2;
        this.wobbleAngle += 0.02;
        if (this.y > canvas.height) this.reset();
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fill();
    }
}

function initSnow() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    snowflakes = Array.from({ length: 120 }, () => new Snowflake());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    snowflakes.forEach(s => { s.update(); s.draw(); });
    requestAnimationFrame(animate);
}

window.addEventListener('resize', initSnow);
initSnow();
animate();
fetchLanyard();
setInterval(fetchLanyard, 30000);