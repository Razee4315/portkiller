# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- The window now opens when you launch PortKiller, and launching it again
  brings the running copy forward instead of doing nothing.
- Each row shows the process's command line, and search matches it, so
  several `node.exe` rows can be told apart.
- Configurable global shortcut, an optional "Start with Windows" setting,
  and a first-run hint about the tray and the shortcut.
- Kill a process together with its child processes (details panel and
  right-click menu).
- A "Never kill" list in Settings for processes you want protected.
- Command suggestions appear under the search bar as you type; `Tab`
  completes the first one. `help` opens the cheatsheet.
- Start typing a port number from anywhere in the window to search.
- Ports you pinned that are not currently listening are shown above the
  list instead of disappearing.
- Setting to turn off the update check at launch.

### Changed
- After a kill, PortKiller checks the port and tells you if something is
  still holding it rather than always reporting it as freed.
- Kill errors now say what actually happened (access denied, already
  exited, list out of date) instead of always suggesting Administrator.
- The backend re-checks the process name and port ownership before every
  kill, so an out-of-date list cannot terminate the wrong process.
- The keyboard cursor and the rows ticked for a bulk kill are now drawn
  differently, and the cursor follows its process when the list reorders.
- "Kill Process" in the details panel and the right-click menu confirms
  in place; `kill 3000` stays in the search bar until you confirm it.
- The bulk-kill button counts processes, not rows, and `kill all` only
  selects what is currently visible in the list.
- Pressing the shortcut while the window is open behind other apps brings
  it forward instead of hiding it, with the search box focused.
- Settings apply immediately; there is no separate Save step.
- "Copy JSON" and "Copy CSV" moved into one menu and now copy the visible
  rows, including the bound address and command line.
- Polling stops while the window is hidden.
- Releases are published manually instead of on every merge.

### Fixed
- Single-key shortcuts no longer fire while typing in Settings or while a
  dialog is open; Enter and Delete there can no longer kill a process.
- Cancelling the Windows elevation prompt no longer quits the app.
- "Open Folder" and "Task Manager" work again and report failures.
- PortKiller no longer fails to start when another app owns `Alt+P`.
- Notifications are no longer hidden behind an open dialog.
- A port bound only to IPv6 loopback (`::1`) is no longer labelled as
  reachable from outside.
- The right-click menu stays inside the window near its edges.
- Searching a range such as `3000-4000` and pressing Enter no longer arms
  a kill on port 3000.

### Removed
- The red "port closed" highlight, which never actually appeared.

### Previously added
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
