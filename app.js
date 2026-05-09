// Play modes: 'sequential' | 'repeat-one' | 'repeat-all' | 'shuffle'
class MusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.playMode = 'sequential';
        this.shuffleHistory = [];
        this.db = null;
        this.isDragging = false;

        this.audioPlayer = document.getElementById('audioPlayer');
        this.fileInput = document.getElementById('fileInput');
        this.playlistSection = document.getElementById('playlistSection');
        this.emptyState = document.getElementById('emptyState');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.progressWrapper = document.getElementById('progressWrapper');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.npTitle = document.getElementById('npTitle');
        this.npSubtitle = document.getElementById('npSubtitle');
        this.addBtn = document.getElementById('addBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.toast = document.getElementById('toast');

        this.init();
    }

    async init() {
        await this.initDB();

        this.addBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.clearBtn.addEventListener('click', () => this.clearAllTracks());

        this.initProgressInteraction();

        this.audioPlayer.addEventListener('ended', () => this.handleTrackEnd());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseIcon();
            this.updateActiveTrackState();
        });
        this.audioPlayer.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseIcon();
            this.updateActiveTrackState();
        });

        await this.loadPlaylistFromDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MusicPlayerDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tracks')) {
                    db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // --- File handling ---

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        let added = 0;

        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                await this.saveTrackToDB(file);
                added++;
            }
        }

        await this.loadPlaylistFromDB();

        if (this.currentIndex === -1 && this.playlist.length > 0) {
            this.loadTrack(0);
        }

        if (added > 0) {
            this.showToast(`已添加 ${added} 首歌曲`);
        }

        event.target.value = '';
    }

    async saveTrackToDB(file) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tracks'], 'readwrite');
            const store = tx.objectStore('tracks');
            const request = store.add({ name: file.name, blob: file, addedAt: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadPlaylistFromDB() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['tracks'], 'readonly');
            const store = tx.objectStore('tracks');
            const request = store.getAll();

            request.onsuccess = () => {
                const tracks = request.result;
                const existingUrls = new Map(this.playlist.map(t => [t.id, t.url]));
                const nextIds = new Set(tracks.map(t => t.id));
                this.playlist.forEach(t => {
                    if (!nextIds.has(t.id)) URL.revokeObjectURL(t.url);
                });

                this.playlist = tracks.map(t => ({
                    id: t.id,
                    name: t.name,
                    url: existingUrls.get(t.id) || URL.createObjectURL(t.blob),
                    blob: t.blob
                }));
                this.renderPlaylist();
                if (this.playlist.length > 0) this.enableControls();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTrack(id, event) {
        event.stopPropagation();

        const index = this.playlist.findIndex(t => t.id === id);
        if (index === -1) return;

        const wasPlaying = index === this.currentIndex && this.isPlaying;

        return new Promise((resolve) => {
            const tx = this.db.transaction(['tracks'], 'readwrite');
            const store = tx.objectStore('tracks');
            store.delete(id);

            tx.oncomplete = async () => {
                URL.revokeObjectURL(this.playlist[index].url);
                this.playlist.splice(index, 1);

                if (this.playlist.length === 0) {
                    this.currentIndex = -1;
                    this.audioPlayer.src = '';
                    this.npTitle.textContent = '未在播放';
                    this.npSubtitle.textContent = '选择一首歌曲';
                    this.isPlaying = false;
                    this.updatePlayPauseIcon();
                    this.disableControls();
                } else if (index === this.currentIndex) {
                    const newIndex = Math.min(index, this.playlist.length - 1);
                    this.loadTrack(newIndex);
                    if (wasPlaying) this.play();
                } else if (index < this.currentIndex) {
                    this.currentIndex--;
                }

                this.renderPlaylist();
                this.showToast('已移除');
                resolve();
            };
        });
    }

    async clearAllTracks() {
        if (!confirm('确定要清空所有音乐吗？')) return;

        return new Promise((resolve) => {
            const tx = this.db.transaction(['tracks'], 'readwrite');
            tx.objectStore('tracks').clear();
            tx.oncomplete = () => {
                this.playlist.forEach(t => URL.revokeObjectURL(t.url));
                this.playlist = [];
                this.currentIndex = -1;
                this.audioPlayer.src = '';
                this.npTitle.textContent = '未在播放';
                this.npSubtitle.textContent = '选择一首歌曲';
                this.isPlaying = false;
                this.updatePlayPauseIcon();
                this.renderPlaylist();
                this.disableControls();
                this.showToast('已清空播放列表');
                resolve();
            };
        });
    }

    // --- Rendering ---

    renderPlaylist() {
        this.clearBtn.style.display = this.playlist.length > 0 ? '' : 'none';

        if (this.playlist.length === 0) {
            this.playlistSection.innerHTML = '';
            this.playlistSection.appendChild(this.createEmptyState());
            return;
        }

        const fragment = document.createDocumentFragment();

        this.playlist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'track-item fade-in';
            if (index === this.currentIndex) {
                item.classList.add('active');
                if (this.isPlaying) item.classList.add('playing');
            }
            item.style.animationDelay = `${index * 0.03}s`;
            item.onclick = () => { this.loadTrack(index); this.play(); };

            const displayName = this.cleanTrackName(track.name);

            const trackIndex = document.createElement('span');
            trackIndex.className = 'track-index';
            trackIndex.textContent = index + 1;

            const artwork = document.createElement('div');
            artwork.className = 'track-artwork';

            const artworkIcon = document.createElement('span');
            artworkIcon.className = 'track-artwork-icon';
            artworkIcon.textContent = '♪';

            const playingIndicator = document.createElement('div');
            playingIndicator.className = 'playing-indicator';
            for (let i = 0; i < 3; i++) {
                const bar = document.createElement('div');
                bar.className = 'playing-bar';
                playingIndicator.appendChild(bar);
            }

            artwork.appendChild(artworkIcon);
            artwork.appendChild(playingIndicator);

            const trackInfo = document.createElement('div');
            trackInfo.className = 'track-info';

            const trackName = document.createElement('div');
            trackName.className = 'track-name';
            trackName.textContent = displayName;

            const trackMeta = document.createElement('div');
            trackMeta.className = 'track-meta';
            trackMeta.textContent = '音乐';

            trackInfo.appendChild(trackName);
            trackInfo.appendChild(trackMeta);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'track-delete';
            deleteBtn.title = '删除';
            deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            deleteBtn.addEventListener('click', (event) => this.deleteTrack(track.id, event));

            item.appendChild(trackIndex);
            item.appendChild(artwork);
            item.appendChild(trackInfo);
            item.appendChild(deleteBtn);

            fragment.appendChild(item);
        });

        this.playlistSection.innerHTML = '';
        this.playlistSection.appendChild(fragment);
    }

    createEmptyState() {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.innerHTML = `
            <div class="empty-state-icon">♫</div>
            <div class="empty-state-title">开始聆听</div>
            <div class="empty-state-desc">轻点右上角 + 添加你喜欢的音乐</div>
        `;
        return div;
    }

    cleanTrackName(name) {
        return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }

    updateActiveTrackState() {
        const items = this.playlistSection.querySelectorAll('.track-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.currentIndex);
            item.classList.toggle('playing', i === this.currentIndex && this.isPlaying);
        });
    }

    // --- Playback ---

    loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.currentIndex = index;
        const track = this.playlist[index];
        this.audioPlayer.src = track.url;

        const displayName = this.cleanTrackName(track.name);
        this.npTitle.textContent = displayName;
        this.npSubtitle.textContent = `${index + 1} / ${this.playlist.length}`;

        this.updateActiveTrackState();
    }

    togglePlayPause() {
        if (this.playlist.length === 0) return;
        this.audioPlayer.paused ? this.play() : this.pause();
    }

    play() {
        if (this.playlist.length === 0) return;
        if (this.currentIndex === -1) this.loadTrack(0);
        this.audioPlayer.play();
    }

    pause() {
        this.audioPlayer.pause();
    }

    playPrevious() {
        if (this.playlist.length === 0) return;

        if (this.audioPlayer.currentTime > 3) {
            this.audioPlayer.currentTime = 0;
            return;
        }

        if (this.playMode === 'shuffle') {
            if (this.shuffleHistory.length > 1) {
                this.shuffleHistory.pop();
                const prevIndex = this.shuffleHistory[this.shuffleHistory.length - 1];
                this.loadTrack(prevIndex);
                this.play();
                return;
            }
        }

        let newIndex = this.currentIndex - 1;
        if (newIndex < 0) newIndex = this.playlist.length - 1;
        this.loadTrack(newIndex);
        this.play();
    }

    playNext() {
        if (this.playlist.length === 0) return;

        if (this.playMode === 'shuffle') {
            this.playShuffled();
            return;
        }

        let newIndex = this.currentIndex + 1;
        if (newIndex >= this.playlist.length) {
            if (this.playMode === 'repeat-all') {
                newIndex = 0;
            } else {
                newIndex = 0;
                this.loadTrack(newIndex);
                return; // stop, don't auto-play in sequential mode at end
            }
        }
        this.loadTrack(newIndex);
        this.play();
    }

    playShuffled() {
        if (this.playlist.length <= 1) {
            this.loadTrack(0);
            this.play();
            return;
        }

        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * this.playlist.length);
        } while (randomIndex === this.currentIndex);

        this.shuffleHistory.push(randomIndex);
        if (this.shuffleHistory.length > 50) this.shuffleHistory.shift();

        this.loadTrack(randomIndex);
        this.play();
    }

    handleTrackEnd() {
        switch (this.playMode) {
            case 'repeat-one':
                this.audioPlayer.currentTime = 0;
                this.play();
                break;
            case 'repeat-all':
                this.playNext();
                break;
            case 'shuffle':
                this.playShuffled();
                break;
            case 'sequential':
            default:
                if (this.currentIndex < this.playlist.length - 1) {
                    this.playNext();
                }
                // else stop at end
                break;
        }
    }

    // --- Play mode controls ---

    toggleShuffle() {
        if (this.playMode === 'shuffle') {
            this.playMode = 'sequential';
            this.shuffleBtn.classList.remove('active');
            this.showToast('顺序播放');
        } else {
            this.playMode = 'shuffle';
            this.shuffleBtn.classList.add('active');
            this.repeatBtn.classList.remove('active');
            this.updateRepeatIcon();
            this.shuffleHistory = [this.currentIndex];
            this.showToast('随机播放');
        }
    }

    toggleRepeat() {
        if (this.playMode === 'shuffle') {
            this.shuffleBtn.classList.remove('active');
        }

        switch (this.playMode) {
            case 'sequential':
            case 'shuffle':
                this.playMode = 'repeat-all';
                this.repeatBtn.classList.add('active');
                this.showToast('列表循环');
                break;
            case 'repeat-all':
                this.playMode = 'repeat-one';
                this.repeatBtn.classList.add('active');
                this.showToast('单曲循环');
                break;
            case 'repeat-one':
                this.playMode = 'sequential';
                this.repeatBtn.classList.remove('active');
                this.showToast('顺序播放');
                break;
        }
        this.updateRepeatIcon();
    }

    updateRepeatIcon() {
        const svg = this.repeatBtn.querySelector('svg');
        if (this.playMode === 'repeat-one') {
            svg.innerHTML = `
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                <text x="12" y="14.5" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none" font-family="-apple-system, sans-serif">1</text>
                <style>svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style>
            `;
        } else {
            svg.innerHTML = `
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                <style>svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style>
            `;
        }
    }

    // --- Progress & time ---

    initProgressInteraction() {
        const wrapper = this.progressWrapper;

        const seek = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = wrapper.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            if (this.audioPlayer.duration) {
                this.audioPlayer.currentTime = pct * this.audioPlayer.duration;
            }
            this.progressFill.style.width = `${pct * 100}%`;
        };

        const onStart = (e) => {
            this.isDragging = true;
            wrapper.classList.add('dragging');
            seek(e);
        };

        const onMove = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            seek(e);
        };

        const onEnd = () => {
            this.isDragging = false;
            wrapper.classList.remove('dragging');
        };

        wrapper.addEventListener('mousedown', onStart);
        wrapper.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }

    updateProgress() {
        if (this.isDragging || !this.audioPlayer.duration) return;
        const pct = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.progressFill.style.width = `${pct}%`;
        this.currentTimeEl.textContent = this.formatTime(this.audioPlayer.currentTime);
    }

    updateDuration() {
        if (!this.audioPlayer.duration) return;
        this.durationEl.textContent = this.formatTime(this.audioPlayer.duration);
    }

    formatTime(s) {
        if (isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    // --- UI helpers ---

    updatePlayPauseIcon() {
        const svg = this.playPauseBtn.querySelector('svg');
        if (this.isPlaying) {
            svg.innerHTML = '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>';
        } else {
            svg.innerHTML = '<polygon points="8,5 20,12 8,19"/>';
        }
    }

    enableControls() {
        this.playPauseBtn.disabled = false;
        this.prevBtn.disabled = false;
        this.nextBtn.disabled = false;
        this.shuffleBtn.disabled = false;
        this.repeatBtn.disabled = false;
    }

    disableControls() {
        this.playPauseBtn.disabled = true;
        this.prevBtn.disabled = true;
        this.nextBtn.disabled = true;
        this.shuffleBtn.disabled = true;
        this.repeatBtn.disabled = true;
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.toast.classList.remove('show'), 1800);
    }
}

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

let player;
window.addEventListener('load', () => {
    player = new MusicPlayer();
});
