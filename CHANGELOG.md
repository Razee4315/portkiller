# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Pinned ports — pin favorites with `p` or the row icon; sticky-sorted
  to the top across restarts.
- Protocol filter pills (All / TCP / UDP) with live counts.
- Sort dropdown: port asc/desc, by process name, or by PID. Persisted
  across restarts.
- Port range search: type `3000-4000` to filter, or `kill 3000-4000`
  to arm a multi-select for bulk kill.
- `kill all` command primes a multi-select for every killable port.
- Recently killed history panel (open with the `h` key or the History
  button in the title bar). Shows last 15 kills with timestamps.
- "Public" badge on ports bound to `0.0.0.0` / `::`.
- Context menu: copy `taskkill` and `Stop-Process` commands; "Select
  all N ports from this process" when one PID owns multiple ports;
  Pin/Unpin entry.
- Vim-style `j` / `k` navigation. `Ctrl+C` copies the selected
  `port:pid`. Cheatsheet updated.
- Common ports grid expanded with Redis (6379), MongoDB (27017),
  MySQL (3306), and Astro (4321).

### Changed
- Pressing `Esc` now progressively clears state — search, then
  selection, then hides the window — instead of always hiding
  immediately.
- Empty state distinguishes a no-search-match from a no-protocol-match
  result and offers a one-click "Show all ports" button.

## [1.0.0] - 2025-11-30

### Added
- Initial release
- Global hotkey (Alt+P) to show/hide overlay
- Live port scanning using Windows API
- Common ports grid (3000, 8080, 5000, 5432, 8000, 4200, 5173)
- Quick kill via port number input
- Process kill with admin elevation support
- System tray integration
- Protected system process detection
- Dark mode UI
- NSIS and MSI installers
