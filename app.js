class MusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;

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

    init() {
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

        this.loadPlaylistFromStorage();
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            if (file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                this.playlist.push({
                    name: file.name,
                    url: url,
                    file: file
                });
            }
        });

        this.renderPlaylist();
        this.enableControls();
        this.savePlaylistToStorage();

        if (this.currentIndex === -1 && this.playlist.length > 0) {
            this.loadTrack(0);
        }

        event.target.value = '';
    }

    renderPlaylist() {
        if (this.playlist.length === 0) {
            this.playlistElement.innerHTML = '<div class="empty-playlist">还没有音乐，点击上方按钮添加</div>';
            return;
        }

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

    savePlaylistToStorage() {
        const playlistData = this.playlist.map(track => ({
            name: track.name
        }));
        localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlistData));
    }

    loadPlaylistFromStorage() {
        try {
            const stored = localStorage.getItem('musicPlayerPlaylist');
            if (stored) {
                const playlistData = JSON.parse(stored);
            }
        } catch (error) {
            console.error('加载播放列表失败:', error);
        }
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
    });
}

const player = new MusicPlayer();
