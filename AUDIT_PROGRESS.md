# Audit implementation progress

Branch: `audit/full-implementation`. Status values: `todo` / `in-progress` / `done` / `verified` / `blocked`.

Environment note: the machine this was written on has no Rust toolchain, so the Rust changes were first compiled by CI on the pull request (Razee4315/portkiller#11), where `cargo check`, clippy and rustfmt pass. Frontend behaviour was verified in a browser against a mocked Tauri IPC layer. Items whose fix lives in Rust stay `blocked` until someone launches a built app and walks the checklist.

## Findings

| ID | Tier | Item | Status | How verified / why blocked |
|---|---|---|---|---|
| F-01 | 1 | Show window on launch; surface existing instance on second launch | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Frontend half (signals ready after restoring geometry) exercised in the harness. |
| F-02 | 1 | Alt+P focuses a visible-but-unfocused window instead of hiding | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| F-03 | 1 | Focus and select search on re-open | verified | Browser harness (real UI, mocked Tauri IPC): emitted the window-focus event, search focused with its text selected; skipped while a dialog is open. |
| F-04 | 1 | Gate global shortcuts behind modals and inputs | verified | Browser harness (real UI, mocked Tauri IPC): h, j, k, /, Delete, Enter, Space, Ctrl+A inside a Settings field are not intercepted; no cursor move, no pending kill, zero kill calls. Real-key test: Enter in search no longer also arms a kill. |
| F-05 | 1 | Distinct cursor vs multi-select styling | verified | Browser harness (real UI, mocked Tauri IPC): a click moves the cursor only; Ctrl+click and Space tick rows; one cursor ring, ticks drawn as checkbox plus tint. |
| F-06 | 1 | In-place kill confirmation (Details, context menu, `kill N`) | verified | Browser harness (real UI, mocked Tauri IPC): details and context-menu Kill arm in place and kill on the second press; "kill 5173" keeps its text, second Enter kills, pending row stays visible. |
| F-07 | 1 | Strict Enter parsing in search | verified | Browser harness (real UI, mocked Tauri IPC) + unit tests: Enter on "3000-6000" or "3001abc" arms nothing; Enter on text moves the cursor to the first result. |
| F-08 | 1 | Backend re-verifies PID, name and port before kill | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| F-09 | 1 | Typed kill error codes | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Frontend wording for every kill code verified in the harness. |
| F-10 | 1 | Cursor tracked by row key | verified | Browser harness (real UI, mocked Tauri IPC): inserted a lower port and refreshed; the cursor stayed on the same port-pid. Cursor resets on a new query. A same-tick burst (three moves, Space, move, Enter) acts on exactly the rows moved to. |
| F-11 | 1 | Refresh feedback | verified | Browser harness (real UI, mocked Tauri IPC): refresh button spins and disables during a manual refresh, then returns to idle. |
| F-12 | 1 | Stop polling while hidden | verified | Browser harness (real UI, mocked Tauri IPC): with the window reported hidden, 0 list fetches in 4.5 s; visible, 2 fetches. Depends on Tauri isVisible, exercised only through the mock. |
| F-13 | 1 | "Removed" highlight: remove dead code and README claim | verified | Removed the "removed" state, its CSS and the README claim; grep finds no references; new-row highlight still works in the harness. |
| F-14 | 1 | Accessibility: list semantics, roving tab stops, contrast | verified | Browser harness (real UI, mocked Tauri IPC): list/listitem roles, aria-current on the cursor row, row buttons tabbable only on the cursor row, protocol radiogroup, combobox wired to suggestions; resting opacities raised; no gray-500 text left. |
| F-15 | 1 | Key by port-pid everywhere | verified | Browser harness (real UI, mocked Tauri IPC) + unit tests: in-flight kills keyed by port-pid; grid and kill-by-number prefer a killable TCP owner. |
| F-16 | 1 | Hotkey registration failure is non-fatal | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| F-17 | 2 | Admin restart survives UAC cancel | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Frontend flow verified in the harness: a cancelled prompt leaves the app running, the button re-enables, an error toast is shown. |
| F-18 | 2 | Open Folder / Task Manager work and report errors | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Frontend verified in the harness: calls the new commands, a failure shows a toast, the menu closes. |
| F-19 | 2 | Bulk kill: dedupe by PID, real count, busy state | verified | Browser harness (real UI, mocked Tauri IPC): three ports of one PID show "Kill 1 process"; protected row excluded; changing the selection disarms; button disabled while busy; "Killed 2 of 2 processes". |
| F-20 | 2 | `kill all` scoped to visible list | verified | Browser harness (real UI, mocked Tauri IPC): with the UDP filter on, "kill all" selected only the 5 visible killable rows. |
| F-21 | 2 | Toast above modal overlays | verified | Browser harness (real UI, mocked Tauri IPC): toast layer z-index 60 vs dialog 50; toast shown above Settings and Details. |
| F-22 | 2 | Context menu clamps to viewport; right-click moves cursor | verified | Browser harness (real UI, mocked Tauri IPC): menu opened at the bottom-right corner stays fully inside the window; right-click moves the cursor; arrows and Enter do not reach the list. |
| F-23 | 2 | Shared public-binding check (`::1` is not public) | verified | Browser harness (real UI, mocked Tauri IPC) + unit tests: a ::1 row has no Public badge; details uses the same helper. |
| F-24 | 2 | Persistent kill affordance on used grid cards | verified | Browser harness (real UI, mocked Tauri IPC): used cards show the kill icon without hover; two-step kill from a card works. |
| F-25 | 2 | Command suggestions; `help` opens cheatsheet | verified | Browser harness (real UI, mocked Tauri IPC) (real keys): typing "ki" lists the kill commands, Tab completes, "help" opens the cheatsheet; aliases are listed there. |
| F-26 | 2 | Pinned-but-not-listening ports are visible | verified | Browser harness (real UI, mocked Tauri IPC): pinned 9999 (not listening) shown as a chip above the list with unpin; pinned 3000 floats to the top. |
| F-27 | 2 | Export actions moved into a menu | verified | Browser harness (real UI, mocked Tauri IPC): one copy menu with JSON and CSV; Escape closes only the menu; no toolbar overflow at 460 px. |
| F-28 | 3 | Settings: instant apply, inline validation, copy | verified | Browser harness (real UI, mocked Tauri IPC): every change applies at once with a single Done button; invalid and duplicate ports show inline errors; empty grid allowed; reset to defaults works. |
| F-29 | 3 | Release only on manual dispatch | blocked | Workflow now runs on manual dispatch only and CONTRIBUTING documents the release steps. Cannot be exercised without running the GitHub workflow. |
| F-30 | 3 | Update dialog: Esc isolation, Retry | verified | Browser harness (real UI, mocked Tauri IPC): Escape on the update dialog closes only that dialog (window not hidden, Settings stays); a failed install shows Close and Try again. |
| F-31 | 3 | Shared Modal with focus trap | verified | Browser harness (real UI, mocked Tauri IPC): all five dialogs use Modal; focus lands inside; overlay click closes; "h" ignored while a dialog is open; history copy corrected. |
| F-32 | 3 | Export: CSV escaping, extra columns, filtered view, error handling | verified | Unit test for CSV quoting and columns; Browser harness (real UI, mocked Tauri IPC): export copies the filtered view and reports a clipboard failure in a toast. |
| F-33 | 3 | Debounced window-state save | blocked | Debounced (300 ms) and skips the minimized state; type-checked. Move/resize events cannot be produced in the harness, so it needs a native drag test. |
| F-36 | 3 | SECURITY.md network statement; update-check opt-out | verified | SECURITY.md corrected; "Check for updates at launch" toggle present in the harness and read by useUpdater. |

## Missing must-haves

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| M-01 | Command line per process | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Row hint, details field, search-by-command and CSV column verified in the harness and unit tests. |
| M-02 | First-run hint | verified | Browser harness (real UI, mocked Tauri IPC): banner shown on first run with the current shortcut, dismissed and remembered. |
| M-03 | Start with Windows | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Settings toggle verified in the harness (reads state, writes, rolls back on error). |
| M-04 | Configurable hotkey | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. Capture UI verified in the harness and unit tests: bare key rejected; failed registration reverts and re-registers the previous shortcut; success persists and updates the footer. |
| M-05 | Type-to-search from anywhere | verified | Browser harness (real UI, mocked Tauri IPC) (real keys): typing digits with the list focused lands in the search box. |
| M-06 | Post-kill verification | verified | Browser harness (real UI, mocked Tauri IPC): success toast only when the port is gone; "still held by python.exe (PID 4999)" when something re-binds. |
| M-07 | Kill process tree | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. In-place confirm for tree kill verified in the harness (details panel and context menu send tree=true). |
| M-08 | Automated tests | verified | vitest added; 43 tests over ports, commands, format, hotkey and preferences pass; CI runs npm test. |
| M-09 | Code signing | blocked | Needs a code-signing certificate (a purchase plus a repo secret). Nothing to implement until one exists. |
| M-10 | User "never kill" list | verified | Browser harness (real UI, mocked Tauri IPC): adding postgres.exe marks its row Protected, disables its grid card and excludes it from bulk kill. Frontend-only guard. |

## Cleanup

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| C-01 | Remove `Icons.Port`; merge `DotFree`/`DotUsed` | verified | Icons.Port and Icons.Kill removed, DotFree/DotUsed merged into Dot; tsc clean. |
| C-02 | Remove unused CSS and Tailwind tokens | verified | Removed .port-new, .port-removed, the shake animation and the amber token; build clean. |
| C-03 | Remove unused npm packages | verified | Removed @tauri-apps/plugin-global-shortcut (JS) and png-to-ico after grep found no references; build clean. |
| C-04 | Remove unused crates (`tokio`, `serde_json`) | blocked | `tokio` removed. `serde_json` restored after CI showed `tauri::generate_context!()` needs it. Cargo.lock is regenerated by cargo on each CI build until a machine with Rust commits it. |
| C-05 | Remove `bun.lock` | verified | bun.lock removed; CI uses npm. |
| C-06 | Remove stale audit docs, `newlogo.svg`, `images/.gitkeep` | verified | Removed both stale audit docs, images/.gitkeep, and newlogo.svg (byte-identical to src-tauri/icons/icon.svg). |
| C-07 | Remove unused backend fields | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| C-08 | Remove empty branch and unreachable error mapping | verified | Empty branch gone with the polling rewrite; error wording is now driven by kill codes. |
| C-09 | `embed-icon.cjs` / `rcedit` redundancy | blocked | Left in place: confirming that tauri-build already embeds the icon needs a release build. |
| C-10 | Font stack: stop naming fonts that never load | verified | Font stacks name only system fonts; rendering unchanged in the harness. |
| C-11 | Trim Linux/macOS bundle config | blocked | Linux/macOS blocks removed and targets set to nsis + msi. Needs a tauri build to confirm the bundle step. |
| C-12 | Extract shared utilities | verified | src/lib now holds ports, format, commands, hotkey, system and memo; the duplicates in components are gone. |
| C-13 | Split `App.tsx` | verified | App.tsx went from 1,392 to about 730 lines; state split into usePorts, useKill, useGlobalKeys, useWindowChrome, useToast, usePortActions; Header, SearchBar, ListToolbar, Footer, Modal extracted. |
| C-14 | Close type gaps | verified | No casts through unknown; IPC payload and stored preferences are validated; tsc strict clean. |
| C-15 | README / CHANGELOG / CONTRIBUTING refresh | verified | README, CHANGELOG, CONTRIBUTING and SECURITY updated to match behaviour. |

## Optimizations

| ID | Item | Status | How verified / why blocked |
|---|---|---|---|
| O-01 | Async Tauri commands | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| O-02 | Lighter process refresh | blocked | Compiles and passes clippy and rustfmt in CI (run 37089140057). Not yet run natively: needs a launch of the built app. |
| O-03 | Isolate footer clock; memoized rows | verified | Footer clock is a leaf component reading a ref; rows memoized with a small local helper instead of preact/compat. |
| O-04 | Skip state update when the port list is unchanged | verified | usePorts keeps the previous state object when a poll returns identical rows (comparison unit-tested). |
| O-05 | List virtualization (audit: not needed) | verified | No change, as the audit concluded: not needed at 50-150 rows once O-03 and O-04 landed. |
