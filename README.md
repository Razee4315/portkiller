# PortKiller

A fast, keyboard-driven Windows utility to kill processes blocking ports. Built with Tauri, Rust, and Preact.

<p align="center">
  <img src="images/demo1.png" alt="Main Interface" width="400"/>
  <img src="images/demo2.png" alt="Port Killing" width="400"/>
</p>

## Features

- **Global Hotkey** — `Alt+P` to show/hide from anywhere
- **Keyboard Navigation** — Arrow keys, Enter to kill, fuzzy search
- **Command Palette** — Type `kill 3000`, `admin`, `refresh`
- **Multi-Select** — `Ctrl+Click` to select, bulk kill
- **Real-Time Updates** — Green/red highlighting for port changes
- **Process Details** — Double-click for memory, CPU, quick actions
- **Customizable Ports** — Configure your common dev ports
- **Admin Elevation** — One-click restart with elevated privileges

## Installation

Download from [Releases](https://github.com/Razee4315/portkiller/releases):
- `PortKiller_x.x.x_x64-setup.exe` (recommended)
- `PortKiller_x.x.x_x64_en-US.msi`

**Requirements:** Windows 10/11 (x64), WebView2 Runtime (auto-installed)

## Quick Reference

| Shortcut | Action |
|----------|--------|
| `Alt+P` | Show/hide |
| `↑/↓` | Navigate list |
| `Enter` | Kill selected |
| `Ctrl+Click` | Multi-select |
| `Esc` | Hide window |
| `/` | Focus search |

**Commands:** `kill <port>` · `admin` · `refresh` · `export json`

## Build from Source

```bash
npm install
npm run tauri build
```

## Author

**Saqlain Razee** — [GitHub](https://github.com/Razee4315) · [LinkedIn](https://www.linkedin.com/in/saqlainrazee/)

## License

MIT
