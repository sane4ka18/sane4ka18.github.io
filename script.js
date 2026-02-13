const DISCORD_ID = '950633437000241175';
const FALLBACK_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23141a22'/><stop offset='1' stop-color='%23242d3b'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23g)'/><text x='50%25' y='56%25' text-anchor='middle' fill='%23f5f7ff' font-family='Arial' font-size='48' font-weight='700'>S</text></svg>";
const MUSIC_PREVIEW_URL = 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ef/6d/fa/ef6dfad8-d6d6-bef6-dd10-0c8aaaeaecb5/mzaf_14180727661913806736.plus.aac.p.m4a';
const MUSIC_START_SECONDS = 0;
const SPOTIFY_TRACK_URL = 'https://open.spotify.com/track/1c1bwU4cCrHi7p0ExosK9T';

let lanyardData = null;
let lastFocusedElement = null;

const modal = document.getElementById('discordModal');
const discordOpenButton = document.getElementById('discordOpenButton');
const discordCloseButton = document.getElementById('discordCloseButton');
const dcTag = document.getElementById('dc-tag');
const dcAvatar = document.getElementById('dc-avatar');
const dcAvatarWrapper = document.querySelector('.dc-avatar-wrapper');
const toastContainer = document.getElementById('toast-container');
const snowToggleButton = document.getElementById('snowToggleButton');
const snowToggleIcon = document.getElementById('snowToggleIcon');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mainAvatar = document.getElementById('main-avatar');
const mainAvatarShell = document.getElementById('mainAvatarShell');

const bgMusic = document.getElementById('bgMusic');
const musicToggleButton = document.getElementById('musicToggleButton');
const musicOpenLink = document.getElementById('musicOpenLink');
const musicMuteButton = document.getElementById('musicMuteButton');
const musicVolumeIcon = document.getElementById('musicVolumeIcon');
const musicVolume = document.getElementById('musicVolume');
const musicCover = document.getElementById('musicCover');
const musicPrompt = document.getElementById('musicPrompt');
const musicPromptYes = document.getElementById('musicPromptYes');
const musicPromptNo = document.getElementById('musicPromptNo');
let lastVolumeBeforeMute = Number(musicVolume.value) || 0.18;
let spotifyProgressFrameId = null;
let spotifyTimeLabelTick = 0;

function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function bindImageWithSkeleton(img, shell) {
    const finish = () => shell.classList.remove('skeleton', 'skeleton-circle');

    if (img.complete && img.naturalWidth > 0) {
        finish();
    }

    img.addEventListener('load', finish);
    img.addEventListener('error', () => {
        if (img.src !== FALLBACK_AVATAR) {
            img.src = FALLBACK_AVATAR;
            return;
        }
        finish();
    });
}

function showSpotifyFallback(message) {
    const spotifyWidget = document.getElementById('spotify-widget');
    stopSpotifyProgressLoop();
    spotifyWidget.classList.remove('spotify-loading');
    spotifyWidget.innerHTML = `<div class="spot-no-music"><i class="fa-brands fa-spotify" aria-hidden="true"></i> ${escapeHtml(message)}</div>`;
}

function animateIconSwap(iconElement) {
    if (!iconElement || reduceMotion) return;

    iconElement.classList.remove('icon-swap');
    // Trigger reflow so animation can restart on each toggle.
    void iconElement.offsetWidth;
    iconElement.classList.add('icon-swap');
    iconElement.addEventListener('animationend', () => {
        iconElement.classList.remove('icon-swap');
    }, { once: true });
}

function setVolumeSliderUI(value) {
    const safeValue = Math.min(1, Math.max(0, Number(value) || 0));
    musicVolume.style.setProperty('--vol-progress', `${Math.round(safeValue * 100)}%`);
}

function setMusicUI(playing) {
    const icon = musicToggleButton.querySelector('i');
    if (!icon) return;

    const shouldBePause = Boolean(playing);
    const isPause = icon.classList.contains('fa-pause');
    if (shouldBePause === isPause) return;

    icon.classList.add('fa-solid');
    icon.classList.remove('fa-play', 'fa-pause');
    icon.classList.add(shouldBePause ? 'fa-pause' : 'fa-play');
    animateIconSwap(icon);
}

function setMuteUI(muted) {
    if (musicVolumeIcon) {
        const shouldBeMutedIcon = Boolean(muted);
        const isMutedIcon = musicVolumeIcon.classList.contains('fa-volume-xmark');

        if (shouldBeMutedIcon !== isMutedIcon) {
            musicVolumeIcon.classList.add('fa-solid');
            musicVolumeIcon.classList.remove('fa-volume-high', 'fa-volume-xmark');
            musicVolumeIcon.classList.add(shouldBeMutedIcon ? 'fa-volume-xmark' : 'fa-volume-high');
            animateIconSwap(musicVolumeIcon);
        }
    }
    if (musicMuteButton) {
        musicMuteButton.setAttribute('aria-pressed', String(muted));
        musicMuteButton.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
    }
}

function ensureMusicMetadata() {
    return new Promise((resolve, reject) => {
        if (bgMusic.readyState >= 1) {
            resolve();
            return;
        }

        const onReady = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error('music metadata error'));
        };
        const cleanup = () => {
            bgMusic.removeEventListener('loadedmetadata', onReady);
            bgMusic.removeEventListener('error', onError);
        };

        bgMusic.addEventListener('loadedmetadata', onReady, { once: true });
        bgMusic.addEventListener('error', onError, { once: true });
    });
}

async function playMusicFromOffset() {
    try {
        await ensureMusicMetadata();
        bgMusic.currentTime = MUSIC_START_SECONDS;
        await bgMusic.play();
        setMusicUI(true);
    } catch (error) {
        console.error('Music play error:', error);
        showToast('Music source is loading or unavailable');
        setMusicUI(false);
    }
}

function pauseMusic() {
    bgMusic.pause();
    setMusicUI(false);
}

function closeMusicPrompt() {
    musicPrompt.classList.remove('active');
    musicPrompt.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function openMusicPrompt() {
    musicPrompt.classList.add('active');
    musicPrompt.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    musicPromptYes.focus();
}

function initMusicPlayer() {
    bgMusic.src = MUSIC_PREVIEW_URL;
    bgMusic.preload = 'auto';
    bgMusic.loop = true;
    bgMusic.volume = Number(musicVolume.value);
    bgMusic.muted = false;
    bgMusic.load();
    setVolumeSliderUI(bgMusic.volume);

    musicOpenLink.href = SPOTIFY_TRACK_URL;
    setMusicUI(false);
    setMuteUI(false);

    musicToggleButton.addEventListener('click', async () => {
        if (bgMusic.paused) {
            await playMusicFromOffset();
        } else {
            pauseMusic();
        }
    });

    musicVolume.addEventListener('input', () => {
        const nextVolume = Number(musicVolume.value);
        bgMusic.volume = nextVolume;
        setVolumeSliderUI(nextVolume);

        if (nextVolume > 0) {
            lastVolumeBeforeMute = nextVolume;
            bgMusic.muted = false;
            setMuteUI(false);
            return;
        }

        bgMusic.muted = true;
        setMuteUI(true);
    });

    musicMuteButton.addEventListener('click', () => {
        if (bgMusic.muted || bgMusic.volume === 0) {
            const restored = Math.max(0.01, lastVolumeBeforeMute || 0.18);
            bgMusic.volume = restored;
            musicVolume.value = restored.toFixed(2);
            setVolumeSliderUI(restored);
            bgMusic.muted = false;
            setMuteUI(false);
            return;
        }

        if (bgMusic.volume > 0) {
            lastVolumeBeforeMute = bgMusic.volume;
        }
        bgMusic.muted = true;
        setMuteUI(true);
    });

    musicPromptYes.addEventListener('click', async () => {
        closeMusicPrompt();
        await playMusicFromOffset();
    });

    musicPromptNo.addEventListener('click', () => {
        closeMusicPrompt();
        pauseMusic();
    });

    bgMusic.addEventListener('pause', () => setMusicUI(false));
    bgMusic.addEventListener('play', () => setMusicUI(true));

    musicCover.addEventListener('error', () => {
        musicCover.src = FALLBACK_AVATAR;
    }, { once: true });

    setTimeout(openMusicPrompt, 320);
}

function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

setInterval(updateClock, 10000);
updateClock();

async function fetchLanyard() {
    let timer = null;
    try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 6500);
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`, { signal: controller.signal });
        const { data, success } = await res.json();
        if (success) {
            lanyardData = data;
            updateUI();
        } else {
            showSpotifyFallback('Not listening to anything');
        }
    } catch (error) {
        console.error('Lanyard error:', error);
        showSpotifyFallback('Status unavailable');
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function updateUI() {
    if (!lanyardData) return;

    const { discord_user, discord_status, activities, listening_to_spotify, spotify } = lanyardData;
    const statusText = document.getElementById('discord-status-text');
    const custom = activities.find((activity) => activity.type === 4);

    mainAvatar.src = discord_user.avatar
        ? `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${discord_user.avatar}.png?size=256`
        : FALLBACK_AVATAR;

    statusText.textContent = custom && custom.state
        ? custom.state
        : discord_status.charAt(0).toUpperCase() + discord_status.slice(1);

    renderSpotify(listening_to_spotify, spotify);
}

function renderSpotify(active, data) {
    const container = document.getElementById('spotify-widget');
    container.classList.remove('spotify-loading');

    if (!active || !data) {
        stopSpotifyProgressLoop();
        container.innerHTML = '<div class="spot-no-music"><i class="fa-brands fa-spotify" aria-hidden="true"></i> Not listening to anything</div>';
        return;
    }

    container.innerHTML = `
        <div class="spot-content">
            <img id="spot-cover" class="spot-img" src="${escapeHtml(data.album_art_url)}" alt="Album art" loading="lazy" decoding="async">
            <div class="spot-info">
                <a href="https://open.spotify.com/track/${escapeHtml(data.track_id)}" target="_blank" rel="noopener noreferrer" class="spot-title">${escapeHtml(data.song)}</a>
                <span class="spot-artist">${escapeHtml(data.artist)}</span>
            </div>
            <i class="fa-brands fa-spotify" style="color:#1db954; font-size:1.2rem; margin-left:auto;" aria-hidden="true"></i>
        </div>
        <div class="spot-progress-container">
            <div class="spot-bar-bg"><div id="spot-fill" class="spot-bar-fill"></div></div>
            <div class="spot-time">
                <span id="spot-start">0:00</span>
                <span id="spot-end">0:00</span>
            </div>
        </div>
    `;

    const cover = document.getElementById('spot-cover');
    if (cover) {
        cover.addEventListener('error', () => {
            cover.src = FALLBACK_AVATAR;
        }, { once: true });
    }

    startSpotifyProgressLoop();
}

function stopSpotifyProgressLoop() {
    if (spotifyProgressFrameId !== null) {
        cancelAnimationFrame(spotifyProgressFrameId);
        spotifyProgressFrameId = null;
    }
    spotifyTimeLabelTick = 0;
}

function formatTrackTime(ms) {
    const sec = Math.floor((ms / 1000) % 60);
    return `${Math.floor(ms / 60000)}:${sec < 10 ? `0${sec}` : sec}`;
}

function updateSpotifyProgress(updateLabels = false) {
    if (!lanyardData || !lanyardData.listening_to_spotify) return false;

    const s = lanyardData.spotify;
    const startTs = s?.timestamps?.start;
    const endTs = s?.timestamps?.end;
    if (!startTs || !endTs) return false;

    const total = Math.max(0, endTs - startTs);
    if (total === 0) return false;

    const elapsedRaw = Date.now() - startTs;
    const elapsed = Math.min(total, Math.max(0, elapsedRaw));
    const progress = elapsed / total;

    const fill = document.getElementById('spot-fill');
    const start = document.getElementById('spot-start');
    const end = document.getElementById('spot-end');

    if (fill) {
        fill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
    }

    if (updateLabels && start && end) {
        start.textContent = formatTrackTime(elapsed);
        end.textContent = formatTrackTime(total);
    }

    return true;
}

function runSpotifyProgressLoop(now = 0) {
    const shouldUpdateLabels = spotifyTimeLabelTick === 0 || now - spotifyTimeLabelTick >= 250;
    const isActive = updateSpotifyProgress(shouldUpdateLabels);

    if (!isActive) {
        stopSpotifyProgressLoop();
        return;
    }

    if (shouldUpdateLabels) {
        spotifyTimeLabelTick = now;
    }

    spotifyProgressFrameId = requestAnimationFrame(runSpotifyProgressLoop);
}

function startSpotifyProgressLoop() {
    stopSpotifyProgressLoop();
    updateSpotifyProgress(true);
    spotifyProgressFrameId = requestAnimationFrame(runSpotifyProgressLoop);
}

function openDiscordModal() {
    lastFocusedElement = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    discordOpenButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('modal-open');

    // Keep avatar clean in modal to avoid shimmer artifacts on status badge.
    dcAvatarWrapper.classList.remove('skeleton', 'skeleton-circle');

    if (!lanyardData) {
        document.getElementById('dc-status').style.backgroundColor = '#80848e';
        discordCloseButton.focus();
        return;
    }

    const { discord_user: user, discord_status: status, activities, spotify } = lanyardData;
    const colors = {
        online: '#23a559',
        idle: '#f0b232',
        dnd: '#f23f43',
        offline: '#80848e'
    };

    dcAvatar.src = user.avatar
        ? `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${user.avatar}.png?size=256`
        : FALLBACK_AVATAR;

    document.getElementById('dc-username').textContent = user.global_name || user.username;
    dcTag.textContent = `@${user.username}`;
    document.getElementById('dc-status').style.backgroundColor = colors[status] || colors.offline;

    const rpc = document.getElementById('rpc-content');
    rpc.classList.remove('rpc-loading');

    const activity = activities.find((entry) => entry.type !== 4);
    if (!activity) {
        rpc.innerHTML = '<span style="color:#72767d; font-size:0.8rem;">Currently not playing anything</span>';
        discordCloseButton.focus();
        return;
    }

    let largeImage = 'https://i.imgur.com/3Q9XY1r.png';
    if (activity.name === 'Spotify' && spotify) {
        largeImage = spotify.album_art_url;
    } else if (activity.assets?.large_image) {
        if (activity.assets.large_image.startsWith('mp:')) {
            largeImage = activity.assets.large_image.replace('mp:', 'https://media.discordapp.net/');
        } else {
            largeImage = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`;
        }
    }

    rpc.innerHTML = `
        <div style="position:relative; width:54px; height:54px; flex-shrink:0;">
            <img id="rpc-image" src="${escapeHtml(largeImage)}" alt="RPC image" style="width:100%; height:100%; border-radius:8px; object-fit:cover;">
        </div>
        <div style="overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-size:0.9rem; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(activity.name)}</div>
            <div style="font-size:0.75rem; color:#b9bbbe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(activity.details || '')}</div>
            <div style="font-size:0.75rem; color:#b9bbbe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(activity.state || '')}</div>
        </div>
    `;

    const rpcImage = document.getElementById('rpc-image');
    if (rpcImage) {
        rpcImage.addEventListener('error', () => {
            rpcImage.src = FALLBACK_AVATAR;
        }, { once: true });
    }

    discordCloseButton.focus();
}

function closeDiscordModal(force = false, eventTarget = null) {
    if (!force && eventTarget && eventTarget !== modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    discordOpenButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('modal-open');

    if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
    } else {
        discordOpenButton.focus();
    }
}

async function copyDiscordUsername() {
    if (!lanyardData) return;

    try {
        await navigator.clipboard.writeText(lanyardData.discord_user.username);
        showToast('Username copied!');
    } catch (error) {
        console.error('Clipboard error:', error);
    }
}

discordOpenButton.addEventListener('click', openDiscordModal);
discordCloseButton.addEventListener('click', () => closeDiscordModal(true));
modal.addEventListener('click', (event) => closeDiscordModal(false, event.target));

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && musicPrompt.classList.contains('active')) {
        closeMusicPrompt();
        pauseMusic();
        return;
    }

    if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeDiscordModal(true);
    }
});

dcTag.addEventListener('click', copyDiscordUsername);
dcTag.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyDiscordUsername();
    }
});

function initSnowEffect(canvas) {
    const fallbackController = {
        setEnabled: () => false,
        toggle: () => false,
        isEnabled: () => false
    };

    if (!canvas || reduceMotion) {
        if (canvas) canvas.style.display = 'none';
        return fallbackController;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return fallbackController;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.matchMedia('(max-width: 560px)').matches;
    const flakeCount = isMobile ? 60 : 110;
    const baseSpeed = isMobile ? 0.55 : 0.75;
    const horizontalWind = isMobile ? 0.08 : 0.12;
    const flakes = [];

    let width = 0;
    let height = 0;
    let rafId = 0;
    let lastTimestamp = 0;
    let enabled = true;

    const createFlake = (spawnAtTop = false) => ({
        x: Math.random() * width,
        y: spawnAtTop ? -Math.random() * height : Math.random() * height,
        r: 0.8 + Math.random() * 2.4,
        speed: baseSpeed + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * horizontalWind,
        sway: 0.4 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.28 + Math.random() * 0.6
    });

    const resetFlake = (flake) => {
        flake.x = Math.random() * width;
        flake.y = -10 - Math.random() * 28;
        flake.r = 0.8 + Math.random() * 2.4;
        flake.speed = baseSpeed + Math.random() * 1.5;
        flake.drift = (Math.random() - 0.5) * horizontalWind;
        flake.sway = 0.4 + Math.random() * 1.2;
        flake.phase = Math.random() * Math.PI * 2;
        flake.alpha = 0.28 + Math.random() * 0.6;
    };

    const resizeCanvas = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (flakes.length === 0) {
            for (let i = 0; i < flakeCount; i += 1) {
                flakes.push(createFlake(false));
            }
            return;
        }

        while (flakes.length < flakeCount) {
            flakes.push(createFlake(true));
        }
        while (flakes.length > flakeCount) {
            flakes.pop();
        }
    };

    const drawFlake = (flake) => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.alpha})`;
        ctx.fill();
    };

    const frame = (timestamp) => {
        if (!enabled) return;

        if (!lastTimestamp) lastTimestamp = timestamp;
        const dt = Math.min(2.2, (timestamp - lastTimestamp) / 16.67);
        lastTimestamp = timestamp;

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < flakes.length; i += 1) {
            const flake = flakes[i];
            flake.phase += 0.01 * dt;
            flake.x += (flake.drift + Math.sin(flake.phase) * 0.08 * flake.sway) * dt * 6;
            flake.y += flake.speed * dt;

            if (flake.y > height + 16) {
                resetFlake(flake);
            }

            if (flake.x < -18) {
                flake.x = width + 18;
            } else if (flake.x > width + 18) {
                flake.x = -18;
            }

            drawFlake(flake);
        }

        rafId = requestAnimationFrame(frame);
    };

    const stop = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
        ctx.clearRect(0, 0, width, height);
    };

    const start = () => {
        if (!enabled || rafId) return;
        lastTimestamp = 0;
        rafId = requestAnimationFrame(frame);
    };

    const applyEnabled = () => {
        canvas.style.display = enabled ? 'block' : 'none';
        if (enabled) {
            start();
            return;
        }
        stop();
    };

    document.addEventListener('visibilitychange', () => {
        if (!enabled) return;
        if (document.hidden) {
            stop();
            return;
        }
        start();
    });

    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();
    applyEnabled();

    return {
        setEnabled(nextValue) {
            enabled = Boolean(nextValue);
            applyEnabled();
            return enabled;
        },
        toggle() {
            enabled = !enabled;
            applyEnabled();
            return enabled;
        },
        isEnabled() {
            return enabled;
        }
    };
}

function setSnowToggleUI(enabled) {
    if (!snowToggleButton || !snowToggleIcon) return;

    snowToggleButton.classList.toggle('is-off', !enabled);
    snowToggleButton.setAttribute('aria-pressed', String(enabled));
    snowToggleButton.setAttribute('aria-label', enabled ? 'Turn off snow' : 'Turn on snow');
    snowToggleIcon.className = enabled ? 'fa-solid fa-snowflake' : 'fa-regular fa-snowflake';
}

const canvas = document.getElementById('snowCanvas');
const snowController = initSnowEffect(canvas);

if (snowToggleButton) {
    setSnowToggleUI(snowController.isEnabled());
    snowToggleButton.addEventListener('click', () => {
        const enabled = snowController.toggle();
        setSnowToggleUI(enabled);
    });
}

bindImageWithSkeleton(mainAvatar, mainAvatarShell);
bindImageWithSkeleton(dcAvatar, dcAvatarWrapper);
initMusicPlayer();
fetchLanyard();
setInterval(fetchLanyard, 30000);
