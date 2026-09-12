const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Read all MP3 files
const songsDir = './songs';
const workerScript = path.join(__dirname, 'audio_worker.js');

if (!fs.existsSync(songsDir)) {
    console.log(`Songs directory "${songsDir}" not found.`);
    process.exit(1);
}

const songs = fs.readdirSync(songsDir)
    .filter(file => file.endsWith('.mp3'));

if (songs.length === 0) {
    console.log('No MP3 files found in ./songs');
    process.exit(0);
}

// ---------------- STATE ----------------

let selected = 0;
let currentPlaying = -1;
let childProcess = null;
let isPaused = false;
let isManuallyStopped = false;
let tickInterval = null;

let currentTime = 0;
let duration = 0;

// Volume: 0 to 100
let volume = 80;
let previousVolume = 80;
let isMuted = false;

// Repeat mode: 'off' | 'one' | 'all'
const REPEAT_MODES = ['off', 'one', 'all'];
let repeatModeIndex = 0;

// ---------------- START ----------------

render();

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();

process.stdin.on('data', (input) => {

    // Quit (q, Q, or Ctrl+C)
    if (input === 'q' || input === 'Q' || input === '\u0003') {
        cleanup();
        process.exit(0);
    }

    // Up Arrow or 'k'
    if (input === '\u001b[A' || input[2] === 'A' || input === 'k') {
        selected--;
        if (selected < 0) {
            selected = songs.length - 1;
        }
        render();
    }

    // Down Arrow or 'j'
    if (input === '\u001b[B' || input[2] === 'B' || input === 'j') {
        selected++;
        if (selected >= songs.length) {
            selected = 0;
        }
        render();
    }

    // Right Arrow or '.' or '>' or 'f' → Seek forward +5 seconds
    if (input === '\u001b[C' || input[2] === 'C' || input === '.' || input === '>' || input === 'f') {
        seek(5);
    }

    // Left Arrow or ',' or '<' or 'b' → Seek backward -5 seconds
    if (input === '\u001b[D' || input[2] === 'D' || input === ',' || input === '<' || input === 'b') {
        seek(-5);
    }

    // Enter → Play selected song
    if (input === '\r' || input === '\n') {
        player(selected);
    }

    // P or Space → Pause / Resume
    if (input === 'p' || input === 'P' || input === ' ') {
        togglePause();
    }

    // S → Stop
    if (input === 's' || input === 'S') {
        stopPlayback();
    }

    // R or L → Toggle Repeat mode
    if (input === 'r' || input === 'R') {
        toggleRepeat();
    }

    // + or = or ] → Volume Up
    if (input === '+' || input === '=' || input === ']') {
        changeVolume(10);
    }

    // - or _ or [ → Volume Down
    if (input === '-' || input === '_' || input === '[') {
        changeVolume(-10);
    }

    // M → Mute / Unmute
    if (input === 'm' || input === 'M') {
        toggleMute();
    }
});

// ---------------- PLAYER ----------------

function player(index) {
    // Mark previous as manual stop so it doesn't trigger auto-repeat
    isManuallyStopped = true;
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }

    if (childProcess) {
        try { childProcess.stdin.write('stop\n'); } catch (e) {}
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    currentPlaying = index;
    currentTime = 0;
    duration = 0;
    isPaused = false;
    isManuallyStopped = false;

    render();

    const song = songs[index];
    const songPath = path.resolve(songsDir, song);
    const volRatio = (volume / 100).toFixed(2);

    childProcess = spawn('osascript', [
        '-l', 'JavaScript',
        workerScript,
        songPath,
        volRatio
    ]);

    const handleOutput = (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed === 'ENDED') {
                handleSongEnded();
                return;
            }

            if (trimmed.startsWith('TIME:')) {
                const parts = trimmed.slice(5).split('/');
                currentTime = parseFloat(parts[0]) || 0;
                duration = parseFloat(parts[1]) || 0;
                render();
            }
        }
    };

    childProcess.stdout.on('data', handleOutput);
    childProcess.stderr.on('data', handleOutput);

    childProcess.on('close', (code) => {
        if (tickInterval) {
            clearInterval(tickInterval);
            tickInterval = null;
        }

        const wasManual = isManuallyStopped;
        childProcess = null;
        isPaused = false;

        if (!wasManual && code === 0) {
            handleSongEnded();
        } else if (!wasManual) {
            currentPlaying = -1;
            currentTime = 0;
            duration = 0;
            render();
        }
    });

    // Start tick loop for progress updates
    tickInterval = setInterval(() => {
        if (childProcess && !isPaused) {
            try {
                childProcess.stdin.write('tick\n');
            } catch (e) {}
        }
    }, 500);
}

function handleSongEnded() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
    if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    const mode = REPEAT_MODES[repeatModeIndex];
    if (mode === 'one') {
        player(currentPlaying);
    } else if (mode === 'all') {
        const nextIndex = (currentPlaying + 1) % songs.length;
        player(nextIndex);
    } else {
        currentPlaying = -1;
        currentTime = 0;
        duration = 0;
        isPaused = false;
        render();
    }
}

// ---------------- CONTROLS ----------------

function seek(deltaSeconds) {
    if (!childProcess) return;

    try {
        if (deltaSeconds > 0) {
            childProcess.stdin.write(`forward ${deltaSeconds}\n`);
        } else {
            childProcess.stdin.write(`backward ${Math.abs(deltaSeconds)}\n`);
        }
    } catch (e) {}
}

function stopPlayback() {
    isManuallyStopped = true;
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }

    if (childProcess) {
        try { childProcess.stdin.write('stop\n'); } catch (e) {}
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    currentPlaying = -1;
    currentTime = 0;
    duration = 0;
    isPaused = false;
    render();
}

function togglePause() {
    if (!childProcess) return;

    if (!isPaused) {
        try { childProcess.stdin.write('pause\n'); } catch (e) {}
        isPaused = true;
    } else {
        try { childProcess.stdin.write('resume\n'); } catch (e) {}
        isPaused = false;
    }

    render();
}

function toggleRepeat() {
    repeatModeIndex = (repeatModeIndex + 1) % REPEAT_MODES.length;
    render();
}

function changeVolume(delta) {
    if (isMuted) {
        isMuted = false;
        volume = previousVolume > 0 ? previousVolume : 50;
    }
    volume = Math.min(100, Math.max(0, volume + delta));
    syncVolume();
    render();
}

function toggleMute() {
    if (isMuted) {
        isMuted = false;
        volume = previousVolume > 0 ? previousVolume : 50;
        syncVolume();
    } else {
        isMuted = true;
        previousVolume = volume;
        volume = 0;
        syncVolume();
    }
    render();
}

function syncVolume() {
    const vol = (volume / 100).toFixed(2);
    if (childProcess) {
        try {
            childProcess.stdin.write(`volume ${vol}\n`);
        } catch (e) {}
    }
    exec(`osascript -e "set volume output volume ${volume}"`, () => {});
}

// ---------------- UI HELPERS ----------------

function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getProgressBar(current, total, width = 16) {
    if (!total || total <= 0) return '[' + ' '.repeat(width) + ']';
    const progress = Math.min(1, Math.max(0, current / total));
    const filled = Math.round(progress * width);
    const empty = width - filled;
    const bar = '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '>' : '') + ' '.repeat(empty);
    return '[' + bar + ']';
}

function getVolumeBar(vol) {
    const totalBars = 10;
    const filledBars = Math.round((vol / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return '[' + '='.repeat(filledBars) + ' '.repeat(emptyBars) + ']';
}

function getRepeatLabel(mode) {
    switch (mode) {
        case 'one':
            return '🔂 Repeat One';
        case 'all':
            return '🔁 Repeat All';
        case 'off':
        default:
            return '➡️  Off';
    }
}

// ---------------- UI ----------------

function render() {
    // Clear terminal
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[H');

    console.log('🎵 TERMINAL MUSIC PLAYER');
    console.log('────────────────────────────────────────\n');

    songs.forEach((song, index) => {
        const isSelected = index === selected;
        const isCurrent = index === currentPlaying && childProcess;

        const cursor = isSelected ? '> ' : '  ';
        let statusTag = '';

        if (isCurrent) {
            statusTag = isPaused ? ' [⏸️ PAUSED]' : ' [▶️ PLAYING]';
        }

        console.log(`${cursor}${song}${statusTag}`);
    });

    console.log('\n────────────────────────────────────────');

    // Status Section
    if (childProcess && currentPlaying >= 0) {
        const playingSong = songs[currentPlaying];
        const statusText = isPaused ? '⏸️  PAUSED' : '▶️  PLAYING';
        console.log(`Now Playing: ${playingSong}`);
        console.log(`Status:      ${statusText}`);
        if (duration > 0) {
            const timeStr = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            const progress = getProgressBar(currentTime, duration, 16);
            console.log(`Progress:    ${progress} ${timeStr}`);
        }
    } else {
        console.log('Status:      ⏹️  Stopped');
    }

    const mode = REPEAT_MODES[repeatModeIndex];
    const volDisplay = isMuted ? 'MUTED' : `${volume}%`;
    console.log(`Volume:      ${isMuted ? '🔇' : '🔊'} ${getVolumeBar(volume)} ${volDisplay}`);
    console.log(`Repeat:      ${getRepeatLabel(mode)}`);

    console.log('\n────────────────────────────────────────');
    console.log('Controls:');
    console.log('  ↑ / k, ↓ / j    Navigate        |  Enter      Play selected');
    console.log('  ← / →           Seek -5s / +5s  |  p / Space  Pause / Resume');
    console.log('  + / -           Volume Up / Dn  |  s          Stop playback');
    console.log('  m               Toggle mute     |  r          Repeat mode');
    console.log('  q               Quit');
}

// ---------------- CLEANUP ----------------

function cleanup() {
    isManuallyStopped = true;
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
    if (childProcess) {
        try { childProcess.stdin.write('stop\n'); } catch (e) {}
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    try {
        process.stdin.setRawMode(false);
    } catch (e) {}
    process.stdin.pause();

    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[H');

    console.log('Goodbye 🎵\n');
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});