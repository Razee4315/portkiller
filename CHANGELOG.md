# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-10-03

### Upgrade notes
- PortKiller now opens its window when you launch it. To keep it in the tray at sign-in, turn on **Start with Windows** in Settings.
- Settings apply as soon as you change them; there is no Save button.
- Your preferences, pins, common-ports grid and kill history carry over.
- The update check still contacts GitHub once per launch. It can now be turned off in Settings.

### Features
- Each row shows the process's command line, and search matches it, so several `node.exe` rows can be told apart. (M-01)
- Configurable global shortcut, **Start with Windows**, and a first-run hint about the tray. (M-02, M-03, M-04)
- Kill a process together with its child processes. (M-07)
- A **Never kill** list for processes you want protected. (M-10)
- Command suggestions under the search bar; `Tab` completes, `help` opens the cheatsheet. (F-25)
- Start typing a port number anywhere in the window to search. (M-05)
- Pinned ports that are not listening stay visible. (F-26)
- After a kill, PortKiller checks the port and tells you if something is still holding it. (M-06)

### Fixes
- Launching the app shows the window; launching it again brings the running copy forward. (F-01)
- The shortcut brings a window buried behind other apps forward instead of hiding it, with the search box ready. (F-02, F-03)
- Shortcut keys no longer fire while typing in Settings or while a dialog is open; Enter and Delete there can no longer kill a process. (F-04)
- The backend re-checks the process before every kill, so an outdated list cannot kill the wrong one, and errors say what actually went wrong. (F-08, F-09)
- Kill confirms in place in the details panel and right-click menu, and `kill 3000` waits for the second Enter. (F-06)
- Searching `3000-4000` and pressing Enter no longer arms a kill. (F-07)
- The keyboard cursor stays on its process when the list refreshes, and is drawn differently from rows ticked for a bulk kill. (F-05, F-10)
- Cancelling the Administrator prompt no longer quits the app. (F-17)
- **Open Folder** and **Task Manager** work again. (F-18)
- PortKiller starts even when another app owns its shortcut. (F-16)
- The bulk-kill button counts processes, and `kill all` only selects visible rows. (F-19, F-20)
- Notifications show above dialogs; the right-click menu stays inside the window; `::1` is no longer labelled public. (F-21, F-22, F-23)
- The update dialog offers **Try again** after a failed install. (F-30)
- CSV export escapes quotes and includes the address and command line. (F-32)

### Performance
- No polling while the window is hidden. (F-12)
- Process scans and kills run off the UI thread and read only the fields the list needs. (O-01, O-02)
- Unchanged refreshes no longer re-render the list. (O-03, O-04)

### Accessibility
- Proper list semantics, one tab stop per row, a protocol radio group, focus trapped in every dialog, and higher contrast for small text. (F-14, F-31)

### Cleanup
- The interface code was reorganised into smaller components and hooks, unit tests were added, and unused code, packages and the never-shown "port closed" highlight were removed. (C-01 – C-15, M-08, F-13)

## [1.0.17] - 2026-06-17

Changes released between 1.0.1 and 1.0.17.

### Added
- Auto-updater with an in-app "What's new" dialog.
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
