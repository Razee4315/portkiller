# Audit implementation progress

Branch: `audit/full-implementation`. Status values: `todo` / `in-progress` / `done` / `verified` / `blocked`.

Environment note: this machine has no Rust toolchain (`cargo`, `rustc`, MSVC build tools are all absent), so Rust changes cannot be compiled and the native app cannot be launched here. Frontend behaviour is verified in a browser against a mocked Tauri IPC layer. Items whose fix lives in Rust are marked `blocked` once the code is written, meaning "implemented, awaiting a compile and a native run".

## Findings

| ID | Tier | Item | Status | How verified / why blocked |
|---|---|---|---|---|
| F-01 | 1 | Show window on launch; surface existing instance on second launch | todo | |
| F-02 | 1 | Alt+P focuses a visible-but-unfocused window instead of hiding | todo | |
| F-03 | 1 | Focus and select search on re-open | todo | |
| F-04 | 1 | Gate global shortcuts behind modals and inputs | todo | |
| F-05 | 1 | Distinct cursor vs multi-select styling | todo | |
| F-06 | 1 | In-place kill confirmation (Details, context menu, `kill N`) | todo | |
| F-07 | 1 | Strict Enter parsing in search | todo | |
| F-08 | 1 | Backend re-verifies PID, name and port before kill | todo | |
| F-09 | 1 | Typed kill error codes | todo | |
| F-10 | 1 | Cursor tracked by row key | todo | |
| F-11 | 1 | Refresh feedback | todo | |
| F-12 | 1 | Stop polling while hidden | todo | |
| F-13 | 1 | "Removed" highlight: remove dead code and README claim | todo | |
| F-14 | 1 | Accessibility: list semantics, roving tab stops, contrast | todo | |
| F-15 | 1 | Key by port-pid everywhere | todo | |
| F-16 | 1 | Hotkey registration failure is non-fatal | todo | |
| F-17 | 2 | Admin restart survives UAC cancel | todo | |
| F-18 | 2 | Open Folder / Task Manager work and report errors | todo | |
| F-19 | 2 | Bulk kill: dedupe by PID, real count, busy state | todo | |
| F-20 | 2 | `kill all` scoped to visible list | todo | |
| F-21 | 2 | Toast above modal overlays | todo | |
| F-22 | 2 | Context menu clamps to viewport; right-click moves cursor | todo | |
| F-23 | 2 | Shared public-binding check (`::1` is not public) | todo | |
| F-24 | 2 | Persistent kill affordance on used grid cards | todo | |
| F-25 | 2 | Command suggestions; `help` opens cheatsheet | todo | |
| F-26 | 2 | Pinned-but-not-listening ports are visible | todo | |
| F-27 | 2 | Export actions moved into a menu | todo | |
| F-28 | 3 | Settings: instant apply, inline validation, copy | todo | |
| F-29 | 3 | Release only on manual dispatch | todo | |
| F-30 | 3 | Update dialog: Esc isolation, Retry | todo | |
| F-31 | 3 | Shared Modal with focus trap | todo | |
| F-32 | 3 | Export: CSV escaping, extra columns, filtered view, error handling | todo | |
| F-33 | 3 | Debounced window-state save | todo | |
| F-36 | 3 | SECURITY.md network statement; update-check opt-out | todo | |

## Missing must-haves

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| M-01 | Command line per process | todo | |
| M-02 | First-run hint | todo | |
| M-03 | Start with Windows | todo | |
| M-04 | Configurable hotkey | todo | |
| M-05 | Type-to-search from anywhere | todo | |
| M-06 | Post-kill verification | todo | |
| M-07 | Kill process tree | todo | |
| M-08 | Automated tests | todo | |
| M-09 | Code signing | todo | |
| M-10 | User "never kill" list | todo | |

## Cleanup

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| C-01 | Remove `Icons.Port`; merge `DotFree`/`DotUsed` | todo | |
| C-02 | Remove unused CSS and Tailwind tokens | todo | |
| C-03 | Remove unused npm packages | todo | |
| C-04 | Remove unused crates (`tokio`, `serde_json`) | todo | |
| C-05 | Remove `bun.lock` | todo | |
| C-06 | Remove stale audit docs, `newlogo.svg`, `images/.gitkeep` | todo | |
| C-07 | Remove unused backend fields | todo | |
| C-08 | Remove empty branch and unreachable error mapping | todo | |
| C-09 | `embed-icon.cjs` / `rcedit` redundancy | todo | |
| C-10 | Font stack: stop naming fonts that never load | todo | |
| C-11 | Trim Linux/macOS bundle config | todo | |
| C-12 | Extract shared utilities | todo | |
| C-13 | Split `App.tsx` | todo | |
| C-14 | Close type gaps | todo | |
| C-15 | README / CHANGELOG / CONTRIBUTING refresh | todo | |

## Optimizations

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| O-01 | Async Tauri commands | todo | |
| O-02 | Lighter process refresh | todo | |
| O-03 | Isolate footer clock; memoized rows | todo | |
| O-04 | Skip state update when the port list is unchanged | todo | |
| O-05 | List virtualization (audit: not needed) | todo | |
