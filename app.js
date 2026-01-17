class MusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.db = null;

        this.audioPlayer = document.getElementById('audioPlayer');
        this.fileInput = document.getElementById('fileInput');
        this.playlistElement = document.getElementById('playlist');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.forwardBtn = document.getElementById('forwardBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTrackName = document.getElementById('currentTrackName');
        this.currentTime = document.getElementById('currentTime');
        this.duration = document.getElementById('duration');

        this.init();
    }

    async init() {
        await this.initDB();
        
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        this.forwardBtn.addEventListener('click', () => this.forward5Seconds());
        this.progressBar.addEventListener('click', (e) => this.seek(e));

        this.audioPlayer.addEventListener('ended', () => this.handleTrackEnd());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();
        });
        this.audioPlayer.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        await this.loadPlaylistFromDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MusicPlayerDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tracks')) {
                    db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                await this.saveTrackToDB(file);
            }
        }

        await this.loadPlaylistFromDB();

        if (this.currentIndex === -1 && this.playlist.length > 0) {
            this.loadTrack(0);
        }

        event.target.value = '';
    }

    async saveTrackToDB(file) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            
            const trackData = {
                name: file.name,
                blob: file,
                addedAt: Date.now()
            };
            
            const request = store.add(trackData);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadPlaylistFromDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const tracks = request.result;
                this.playlist = tracks.map(track => ({
                    id: track.id,
                    name: track.name,
                    url: URL.createObjectURL(track.blob),
                    blob: track.blob
                }));
                
                this.renderPlaylist();
                if (this.playlist.length > 0) {
                    this.enableControls();
                }
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllTracks() {
        if (!confirm('确定要清空所有音乐吗？此操作不可恢复。')) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            const request = store.clear();
            
            request.onsuccess = async () => {
                this.playlist.forEach(track => {
                    if (track.url) {
                        URL.revokeObjectURL(track.url);
                    }
                });
                
                this.playlist = [];
                this.currentIndex = -1;
                this.audioPlayer.src = '';
                this.currentTrackName.textContent = '未播放';
                this.isPlaying = false;
                this.updatePlayPauseButton();
                this.renderPlaylist();
                
                this.playPauseBtn.disabled = true;
                this.prevBtn.disabled = true;
                this.nextBtn.disabled = true;
                this.forwardBtn.disabled = true;
                
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    renderPlaylist() {
        const clearBtn = document.getElementById('clearBtn');
        
        if (this.playlist.length === 0) {
            this.playlistElement.innerHTML = '<div class="empty-playlist">还没有音乐，点击上方按钮添加</div>';
            if (clearBtn) clearBtn.style.display = 'none';
            return;
        }

        if (clearBtn) clearBtn.style.display = 'block';

        this.playlistElement.innerHTML = this.playlist.map((track, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'active' : ''}" 
                 onclick="player.loadTrack(${index}); player.play();">
                <span class="playlist-item-number">${index + 1}</span>
                <span class="playlist-item-name">${track.name}</span>
            </div>
        `).join('');
    }

    loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        this.currentIndex = index;
        const track = this.playlist[index];
        
        this.audioPlayer.src = track.url;
        this.currentTrackName.textContent = track.name;
        
        this.renderPlaylist();
    }

    togglePlayPause() {
        if (this.playlist.length === 0) return;

        if (this.audioPlayer.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        if (this.playlist.length === 0) return;

        if (this.currentIndex === -1) {
            this.loadTrack(0);
        }

        this.audioPlayer.play();
    }

    pause() {
        this.audioPlayer.pause();
    }

    playPrevious() {
        if (this.playlist.length === 0) return;

        let newIndex = this.currentIndex - 1;
        
        if (newIndex < 0) {
            newIndex = this.playlist.length - 1;
        }

        this.loadTrack(newIndex);
        this.play();
    }

    playNext() {
        if (this.playlist.length === 0) return;

        let newIndex = this.currentIndex + 1;
        
        if (newIndex >= this.playlist.length) {
            newIndex = 0;
        }

        this.loadTrack(newIndex);
        this.play();
    }

    forward5Seconds() {
        if (!this.audioPlayer.src) return;

        const newTime = Math.min(
            this.audioPlayer.currentTime + 5,
            this.audioPlayer.duration
        );
        this.audioPlayer.currentTime = newTime;
    }

    handleTrackEnd() {
        this.playNext();
    }

    updateProgress() {
        if (!this.audioPlayer.duration) return;

        const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.progressFill.style.width = `${progress}%`;

        this.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime);
    }

    updateDuration() {
        if (!this.audioPlayer.duration) return;
        this.duration.textContent = this.formatTime(this.audioPlayer.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    seek(event) {
        if (!this.audioPlayer.duration) return;

        const rect = this.progressBar.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * this.audioPlayer.duration;

        this.audioPlayer.currentTime = newTime;
    }

    updatePlayPauseButton() {
        this.playPauseBtn.textContent = this.isPlaying ? '⏸' : '▶️';
    }

    enableControls() {
        this.playPauseBtn.disabled = false;
        this.prevBtn.disabled = false;
        this.nextBtn.disabled = false;
        this.forwardBtn.disabled = false;
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
    });
}

let player;
window.addEventListener('load', async () => {
    player = new MusicPlayer();
});
