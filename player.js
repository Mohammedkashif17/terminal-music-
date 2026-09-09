const fs = require('fs');
const { spawn, exec } = require('child_process');

// Read all MP3 files
const songsDir = './songs';

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
    if (input === 'r' || input === 'R' || input === 'l' || input === 'L') {
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
    if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    currentPlaying = index;
    isPaused = false;
    isManuallyStopped = false;

    render();

    const song = songs[index];
    const volRatio = (volume / 100).toFixed(2);

    childProcess = spawn('afplay', [
        '-v', volRatio,
        `${songsDir}/${song}`
    ]);

    childProcess.on('close', (code) => {
        const wasManual = isManuallyStopped;
        childProcess = null;
        isPaused = false;

        if (!wasManual && code === 0) {
            const mode = REPEAT_MODES[repeatModeIndex];
            if (mode === 'one') {
                player(currentPlaying);
                return;
            } else if (mode === 'all') {
                const nextIndex = (currentPlaying + 1) % songs.length;
                player(nextIndex);
                return;
            }
        }

        if (!wasManual) {
            currentPlaying = -1;
        }

        render();
    });
}

// ---------------- CONTROLS ----------------

function stopPlayback() {
    isManuallyStopped = true;
    if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
    }
    currentPlaying = -1;
    isPaused = false;
    render();
}

function togglePause() {
    if (!childProcess) {
        return;
    }

    if (!isPaused) {
        childProcess.kill('SIGSTOP');
        isPaused = true;
    } else {
        childProcess.kill('SIGCONT');
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
    syncSystemVolume(volume);
    render();
}

function toggleMute() {
    if (isMuted) {
        isMuted = false;
        volume = previousVolume > 0 ? previousVolume : 50;
        syncSystemVolume(volume);
    } else {
        isMuted = true;
        previousVolume = volume;
        volume = 0;
        syncSystemVolume(0);
    }
    render();
}

function syncSystemVolume(vol) {
    exec(`osascript -e "set volume output volume ${vol}"`, () => {});
}

// ---------------- UI HELPERS ----------------

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
    } else {
        console.log('Status:      ⏹️  Stopped');
    }

    const mode = REPEAT_MODES[repeatModeIndex];
    const volDisplay = isMuted ? 'MUTED' : `${volume}%`;
    console.log(`Volume:      ${isMuted ? '🔇' : '🔊'} ${getVolumeBar(volume)} ${volDisplay}`);
    console.log(`Repeat:      ${getRepeatLabel(mode)}`);

    console.log('\n────────────────────────────────────────');
    console.log('Controls:');
    console.log('  ↑ / k, ↓ / j  Navigate      |  Enter  Play selected');
    console.log('  p / Space     Pause / Resume|  s      Stop playback');
    console.log('  + / -         Volume Up / Dn|  m      Toggle mute');
    console.log('  r             Repeat mode   |  q      Quit');
}

// ---------------- CLEANUP ----------------

function cleanup() {
    isManuallyStopped = true;
    if (childProcess) {
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