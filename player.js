const fs = require('fs');
const { spawn } = require('child_process');

// Read all MP3 files
const path = './songs';

const songs = fs.readdirSync(path)
    .filter(file => file.endsWith('.mp3'));

if (songs.length === 0) {
    console.log('No MP3 files found in ./songs');
    process.exit(0);
}

// ---------------- STATE ----------------

let selected = 0;
let childProcess = null;
let isPaused = false;

// ---------------- START ----------------

render();

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();

process.stdin.on('data', (input) => {

    // Quit
    if (input === 'q') {
        cleanup();
        process.exit(0);
    }

    // Up Arrow
    if (input[2] === 'A') {
        selected--;

        if (selected < 0) {
            selected = songs.length - 1;
        }

        render();
    }

    // Down Arrow
    if (input[2] === 'B') {
        selected++;

        if (selected >= songs.length) {
            selected = 0;
        }

        render();
    }

    // Enter → Play
    if (input === '\r') {
        player(selected);
    }

    // P → Pause / Resume
    if (input === 'p') {
        togglePause();
    }
});

// ---------------- PLAYER ----------------

function player(index) {

    // Stop previous song
    if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    const song = songs[index];

    render();

    childProcess = spawn('afplay', [
        `${path}/${song}`
    ]);

    isPaused = false;

    childProcess.on('close', () => {
        childProcess = null;
        isPaused = false;

        render();
    });
}

// ---------------- PAUSE / RESUME ----------------

function togglePause() {

    // No song playing
    if (!childProcess) {
        return;
    }

    if (!isPaused) {

        // Pause
        childProcess.kill('SIGSTOP');

        isPaused = true;

    } else {

        // Resume
        childProcess.kill('SIGCONT');

        isPaused = false;
    }

    render();
}

// ---------------- UI ----------------

function render() {

    // Clear terminal
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[H');

    console.log('🎵 MUSIC PLAYER');
    console.log('────────────────────────\n');

    songs.forEach((song, index) => {

        if (index === selected) {
            console.log(`> ${song}`);
        } else {
            console.log(`  ${song}`);
        }

    });

    console.log('\n────────────────────────');

    if (childProcess) {

        console.log(`▶️  ${songs[selected]}`);

        if (isPaused) {
            console.log('⏸️  PAUSED');
        } else {
            console.log('▶️  PLAYING');
        }

    } else {

        console.log('⏹️  No song playing');

    }

    console.log('\n↑ ↓ Navigate');
    console.log('Enter  Play');
    console.log('p      Pause / Resume');
    console.log('q      Quit');
}

// ---------------- CLEANUP ----------------

function cleanup() {

    if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
    }

    process.stdin.setRawMode(false);
    process.stdin.pause();

    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[H');

    console.log('Goodbye 🎵');
}