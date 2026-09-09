# 🎵 Terminal Music Player

A fast, lightweight, zero-dependency terminal music player for macOS built with Node.js and `afplay`.

![Terminal Music Player](songs/test.jpeg)

## Features

- 🎹 **Interactive CLI UI**: Clean terminal interface with playlist navigation and playback status.
- ⏯️ **Playback Controls**: Play, pause, resume, and stop playback with instant keyboard shortcuts.
- 🔊 **Volume Control & Mute**: Adjust volume dynamically (0% - 100%) or mute instantly.
- 🔁 **Repeat / Loop Modes**: Toggle between Off, Repeat Current Track, and Repeat All Playlist.
- 🎯 **Accurate Track Status**: Clear visual separation between cursor navigation and currently playing song.
- ⚡ **Zero Dependencies**: Pure Node.js standard library with built-in macOS audio utilities.

---

## Getting Started

### Prerequisites

- macOS (utilizes built-in `afplay`)
- Node.js (v14 or newer)

### Installation & Run

1. Clone repository:
   ```bash
   git clone https://github.com/Mohammedkashif17/terminal-music-.git
   cd terminal-music-
   ```

2. Add your `.mp3` files into the `songs/` folder.

3. Launch the player:
   ```bash
   npm start
   # or
   node player.js
   ```

---

## Keyboard Controls

| Key | Action |
| --- | --- |
| `↑` / `k` | Navigate Up |
| `↓` / `j` | Navigate Down |
| `Enter` | Play Selected Track |
| `p` / `Space` | Pause / Resume Playback |
| `s` | Stop Playback |
| `+` / `=` | Increase Volume (+10%) |
| `-` | Decrease Volume (-10%) |
| `m` | Toggle Mute |
| `r` / `l` | Cycle Repeat Mode (`Off` → `Repeat One` → `Repeat All`) |
| `q` / `Ctrl+C` | Quit Player |

---

## License

MIT © Mohammed Kashif
