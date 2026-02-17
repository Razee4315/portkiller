# PortKiller - UI/UX & HCI Deep Analysis

## Executive Summary

This document provides a comprehensive Human-Computer Interaction (HCI) analysis of the PortKiller desktop application, evaluating it against established HCI principles including Nielsen's Heuristics, Fitts's Law, cognitive load theory, Gestalt principles, and accessibility standards (WCAG 2.1).

---

# PART 1: FRONTEND UI ISSUES

## UI-1. CRITICAL: No Confirmation Dialog for Destructive Kill Actions

**Files:** `App.tsx:258-284`, `PortGrid.tsx:24`, `PortList.tsx:94`
**Type:** Missing safety pattern

Clicking "Kill" immediately terminates a process with **zero confirmation**. This violates Nielsen's "Error Prevention" heuristic. A single misclick on the wrong port row kills a potentially critical process (database, web server).

The common port grid is even worse - clicking any active port card instantly kills it. The kill button (X icon) in the top-right corner of cards is only 12x12px and too close to the card itself.

**Impact:** Accidental process termination with no undo path.

**Fix:** Add a confirmation step. Either a small inline "Confirm?" state on the button, or a lightweight confirmation popover.

---

## UI-2. HIGH: Inconsistent Icon Usage - Wrong Icons for Actions

**Files:** `DetailsPanel.tsx:107,157`, `ContextMenu.tsx:110,126`

Several actions use semantically wrong icons:
- **Copy PID** button uses `Icons.Port` (a monitor/screen icon) instead of `Icons.Copy`
- **Open Folder** uses `Icons.Port` instead of `Icons.Folder`
- The close button (X) uses `Icons.Kill` which visually means "terminate" - confusing in a process-killing app

**Impact:** Users cannot build correct mental models of button actions. A "Kill" icon on a close button creates anxiety.

**Fix:** Use `Icons.Copy` for copy actions, `Icons.Folder` for open folder, and a distinct close icon.

---

## UI-3. HIGH: Kill Button Visibility - Hidden Until Hover

**File:** `PortList.tsx:96`
**Type:** Discoverability issue

```css
opacity-0 group-hover:opacity-100
```

The kill button is completely invisible until the user hovers over a row. New users have no way to discover the primary action without accidentally hovering. This violates the "Visibility of System Status" and "Recognition Rather Than Recall" heuristics.

The Details button (line 81) has the same issue.

**Impact:** Users don't know how to kill a process without trial and error.

**Fix:** Show a subtle muted version of the kill button at all times (e.g., `opacity-30 group-hover:opacity-100`).

---

## UI-4. HIGH: No Keyboard Navigation Support in Port Grid

**File:** `PortGrid.tsx`
**Type:** Accessibility / keyboard support

The port grid has no keyboard navigation. Users cannot Tab through port cards or use arrow keys within the grid. The buttons lack proper `aria-label` attributes.

**Impact:** Keyboard-only users cannot interact with common ports.

**Fix:** Add `tabIndex`, `aria-label`, and keyboard event handlers to grid cards.

---

## UI-5. HIGH: Toast Notifications Lack Proper Accessibility

**File:** `Toast.tsx:1-28`
**Type:** Accessibility

- No `role="alert"` or `aria-live="polite"` for screen reader announcements
- No `aria-label` or `aria-describedby`
- Fixed positioning at bottom-center could be obscured by OS taskbar
- No dismiss button - only clickable body (undiscoverable)

**Fix:** Add ARIA live region attributes, explicit close button.

---

## UI-6. HIGH: Modal Dialogs Lack Focus Trapping

**Files:** `DetailsPanel.tsx`, `SettingsPanel.tsx`, `ContextMenu.tsx`
**Type:** Accessibility / keyboard trap

None of the modal dialogs trap focus. When opened, Tab key sends focus behind the modal to invisible elements. This is a WCAG 2.1 Level A failure (2.4.3 Focus Order).

**Fix:** Implement focus trap: on open, focus first focusable element; on Tab at last element, cycle to first.

---

## UI-7. MEDIUM: Save Button Uses Danger Styling

**File:** `SettingsPanel.tsx:131`
**Type:** Visual consistency

```jsx
<button onClick={handleSave} className="btn btn-danger flex-1">
  Save Changes
</button>
```

"Save Changes" is a constructive action but uses `btn-danger` (red styling). Red universally signals danger/destruction. Users will hesitate to click a red "Save" button.

**Impact:** Cognitive friction - users second-guess whether saving will delete their data.

**Fix:** Create a `btn-primary` style (blue/green) for constructive actions.

---

## UI-8. MEDIUM: Context Menu Has No Keyboard Navigation

**File:** `ContextMenu.tsx`
**Type:** Accessibility

The context menu only supports Escape to close. There's no:
- Arrow Up/Down to navigate items
- Enter to select focused item
- Home/End to jump to first/last item

This is standard context menu behavior that users expect.

**Fix:** Add keyboard navigation with arrow keys, Enter, and focus management.

---

## UI-9. MEDIUM: Search Input Lacks Clear Affordance for Commands

**File:** `App.tsx:499-518`
**Type:** Discoverability

The input placeholder says "Search ports, processes, or type a command..." but:
- No list of available commands is shown
- No autocomplete or suggestions
- No visual distinction between search and command mode
- Users must memorize: admin, sudo, refresh, r, clear, c, settings, config, kill, export

**Impact:** Command palette is effectively undiscoverable.

**Fix:** Show command suggestions when input starts with known prefixes, or add a `/` prefix convention with a dropdown.

---

## UI-10. MEDIUM: Window Hides on Focus Loss - Disruptive Pattern

**File:** `App.tsx:117-131`
**Type:** Unexpected behavior

The window automatically hides when it loses focus (clicking outside). While this mimics spotlight/launcher behavior, it's problematic because:
- Users lose their place if they click a browser to check something
- The DetailsPanel, SettingsPanel, and ContextMenu are all dismissed on focus loss
- No option to disable this behavior
- Conflicts with "User Control and Freedom" heuristic

**Fix:** Make auto-hide configurable in settings. At minimum, don't hide when a modal is open.

---

## UI-11. MEDIUM: No Visual Feedback During Port Refresh

**Type:** System status visibility

The 2-second polling happens silently. Users have no indication that:
- Data is being refreshed
- When the last refresh occurred
- Whether the refresh succeeded or failed

The footer shows "X ports active" but no timestamp or refresh indicator.

**Fix:** Add a subtle pulse animation or timestamp showing "Updated Xs ago".

---

## UI-12. LOW: DotFree and DotUsed Icons Are Identical

**File:** `Icons.tsx:120-130`
**Type:** Redundancy

```tsx
DotFree: // <circle cx="6" cy="6" r="5" />
DotUsed: // <circle cx="6" cy="6" r="5" />
```

Both icons render identical SVG circles. The visual difference comes purely from the `className` color passed by the parent. This is confusing for maintenance.

**Fix:** Either differentiate them visually (e.g., filled vs hollow) or merge into a single `Dot` component.

---

## UI-13. LOW: Port Grid Doesn't Scale with Custom Ports

**File:** `PortGrid.tsx:14`
**Type:** Layout issue

The grid is hardcoded to 4 columns (`grid-cols-4`). With 8 default ports, this creates 2 neat rows. But when users add custom ports in settings, the grid can grow unboundedly. With 12+ ports, the grid pushes the port list off-screen.

**Fix:** Add `max-h` with overflow-auto, or dynamically adjust columns based on count.

---

## UI-14. LOW: Inconsistent Text Sizes Across Components

**Type:** Visual consistency

Text sizes vary without clear hierarchy:
- Header title: `text-[11px]`
- Section labels: `text-[10px]`
- Port numbers: `text-xs` (12px)
- Process names: `text-[11px]`
- Protocol badges: `text-[10px]`
- Footer: `text-[10px]`

The difference between 10px and 11px is imperceptible and creates maintenance burden without visual benefit.

**Fix:** Standardize to 2-3 size tiers with clear semantic purpose.

---

---

# PART 2: DEEP HCI ANALYSIS

## HCI Principle 1: Nielsen's 10 Usability Heuristics

### H1 - Visibility of System Status (PARTIAL FAIL)
- **Good:** Loading spinner shown during initial load; kill button shows spinner during operation
- **Bad:** No refresh indicator during polling; no "last updated" timestamp; no indication when running without admin privileges limits functionality; no connection status for Tauri IPC

### H2 - Match Between System and Real World (PASS)
- **Good:** Uses familiar terminology (Port, PID, Kill, Protected); port numbers displayed with colon prefix (`:3000`) matching terminal convention
- **Minor:** "Kill" is technically aggressive - "Stop" or "Terminate" would be more professional

### H3 - User Control and Freedom (PARTIAL FAIL)
- **Bad:** No undo after killing a process; window auto-hides on focus loss without option to disable; Escape hides the entire window (common key, extreme action); no way to re-show killed processes
- **Good:** Search can be cleared; settings can be cancelled

### H4 - Consistency and Standards (PARTIAL FAIL)
- **Bad:** Close button (X) and Kill icon are the same; save button uses danger/red color; minimize and close buttons both hide window (do the same thing); context menu and details panel duplicate "Kill Process" and "Open Folder" but with different icons
- **Good:** Consistent dark theme; monospace font throughout

### H5 - Error Prevention (FAIL)
- **Critical:** No confirmation for kill actions; bulk kill has no confirmation; no warning when killing database processes (PostgreSQL, MySQL); Enter key on search immediately kills matching port

### H6 - Recognition Rather Than Recall (PARTIAL FAIL)
- **Bad:** Commands must be memorized (admin, refresh, clear, settings, kill, export); keyboard shortcuts not listed in UI (only Alt+P in footer); hover-only buttons require recall
- **Good:** Port descriptions in grid; process names visible in list

### H7 - Flexibility and Efficiency of Use (GOOD)
- **Good:** Keyboard shortcuts (/, Escape, arrows, Enter, Delete, Ctrl+A); command palette; fuzzy search; bulk select with Shift/Ctrl click; export to JSON/CSV
- **Minor:** No customizable shortcuts

### H8 - Aesthetic and Minimalist Design (GOOD)
- **Good:** Clean dark theme; minimal chrome; information density is well balanced; no unnecessary decoration
- **Minor:** Protocol badge adds visual noise for non-expert users

### H9 - Help Users Recognize, Diagnose, and Recover From Errors (PARTIAL FAIL)
- **Bad:** Error messages from Tauri IPC are raw (e.g., "Access is denied. (os error 5)"); no guidance on what to do (e.g., "Run as Admin to kill system processes"); failed kills show toast and disappear - no persistent error state
- **Good:** "Retry" button on fetch error

### H10 - Help and Documentation (FAIL)
- **No help system at all:** No onboarding, no tooltip explaining commands, no keyboard shortcut reference, no "?" icon linking to documentation

---

## HCI Principle 2: Fitts's Law Analysis

Fitts's Law states that the time to reach a target is proportional to distance/size. Analysis of interactive targets:

### Problematic Targets:
1. **Kill button in port cards** (top-right icon, ~12x12px): Extremely small target requiring precision. Violates minimum 44x44px touch target recommendation.
2. **Kill button in list rows** (opacity-0 until hover): Zero-size target until discovered. Infinite Fitts's Law time for new users.
3. **Window control buttons** (minimize/close, ~28x28px): Small but adequate for experienced users.
4. **Context menu items**: Good height but narrow width (192px). Adequate.
5. **Export buttons** (JSON/CSV, ~30x16px): Very small text-only targets with no padding. Hard to click.

### Well-Designed Targets:
1. **Search input**: Full-width, well-padded. Excellent target.
2. **Port grid cards**: Large touch targets with full-card clickability. Good.
3. **Modal buttons**: Full-width action buttons in DetailsPanel and SettingsPanel. Good.

**Fix:** Increase minimum interactive target size to 32x32px. Add padding to export buttons.

---

## HCI Principle 3: Cognitive Load Analysis

### Current Cognitive Load Issues:

1. **Intrinsic Load (Task Complexity) - Appropriate:**
   The app deals with an inherently technical domain (ports, PIDs, processes). The information shown is appropriate for the target audience (developers).

2. **Extraneous Load (Interface Overhead) - Too High:**
   - Users must remember 6+ keyboard commands with no visual reference
   - The search bar serves triple duty (search, command input, kill-by-port-number) with no mode indicator
   - Two different kill mechanisms (grid click vs list button) with different interaction patterns
   - "NEW" badge, colored dots, protocol badges, PID numbers, process names - too many simultaneous information channels in the port list

3. **Germane Load (Learning) - Insufficient Support:**
   - No onboarding or first-use guide
   - No progressive disclosure - everything is shown at once
   - No contextual help or tooltips

### Miller's Law (7 +/- 2 items):
The port grid shows 8 items (within limit). The port list can show 20+ items with no grouping or pagination - exceeds working memory for scanning.

**Fix:** Group ports by process name or protocol. Add section headers. Implement progressive disclosure for advanced features.

---

## HCI Principle 4: Gestalt Principles Analysis

### Proximity
- **Good:** Port grid items are grouped with consistent spacing. List row elements (dot, port, name, buttons) are well-grouped.
- **Bad:** The "JSON"/"CSV" export buttons are visually grouped with the section header but functionally separate. No visual grouping of related context menu items.

### Similarity
- **Good:** All port cards share the same visual treatment. Status dots use consistent color coding (green=free, red=used, yellow=protected).
- **Bad:** The Kill icon (X) is used for both "close modal" and "kill process" - similarity principle creates wrong association.

### Closure
- **Good:** Cards and modal panels have clear boundaries with borders and backgrounds.

### Continuity
- **Good:** The vertical port list follows natural reading flow.
- **Bad:** The transition from grid to list has no visual flow connection. They feel like separate apps.

### Figure-Ground
- **Good:** Modal overlays with dark backdrop create clear figure-ground separation.
- **Bad:** The dark-on-dark color scheme (dark-700 on dark-800 on dark-900) makes element boundaries hard to perceive. Contrast ratios between background layers are insufficient.

---

## HCI Principle 5: Accessibility Audit (WCAG 2.1)

### Level A Failures:
1. **1.3.1 Info and Relationships:** No semantic HTML structure (no `<main>`, `<nav>`, `<section>` landmarks). Screen readers cannot navigate sections.
2. **2.1.1 Keyboard:** Port grid not keyboard accessible. Context menu not keyboard navigable. Modal focus not managed.
3. **2.4.3 Focus Order:** Modals don't trap focus. Tab order jumps behind open dialogs.
4. **4.1.2 Name, Role, Value:** Interactive elements lack `aria-label`. Button purposes not conveyed (icon-only buttons with no text alternative).

### Level AA Failures:
5. **1.4.3 Contrast (Minimum):** `text-gray-400` (#9ca3af) on `bg-dark-800` (#141414) = contrast ratio ~4.0:1 (fails 4.5:1 requirement for normal text). `text-gray-500` on dark backgrounds fails more severely.
6. **1.4.11 Non-text Contrast:** The 1.5px status dots may not meet 3:1 contrast requirement against dark backgrounds.
7. **2.4.7 Focus Visible:** No custom focus indicators defined. Default browser focus ring may be invisible on dark theme.

### Level AAA Considerations:
8. **2.3.3 Animation from Interactions:** No option to reduce motion (respecting `prefers-reduced-motion`).

---

## HCI Principle 6: Error Recovery & Forgiveness

### Current State:
- **Kill action:** Irreversible. No undo. No confirmation. Worst case: user accidentally kills their database and loses unsaved data.
- **Bulk kill:** Even more dangerous - can kill multiple processes at once with no confirmation.
- **Settings:** Can be cancelled (good), but "Reset to Default" has no confirmation.
- **Search/commands:** Enter immediately executes - no preview of what will happen.

### Recommended Error Recovery Model:
1. **Prevention:** Confirmation for single kill, stronger confirmation for bulk kill
2. **Detection:** Highlight when killing a common service (database, web server)
3. **Recovery:** Show "recently killed" processes with restart option (if applicable)
4. **Feedback:** Clear success/failure indication with actionable next steps

---

## HCI Principle 7: Information Architecture

### Current Hierarchy:
```
Header (branding + actions)
  -> Search bar (search + commands)
  -> Common ports grid (quick access)
  -> Port list (full listing)
Footer (status)
```

### Issues:
1. The header contains too many distinct functions: branding, admin status, settings, minimize, close, and bulk kill. Cognitive overload.
2. Common ports grid and port list are visually disconnected. Clicking a grid port kills it; selecting a list port merely selects it. Inconsistent interaction models.
3. No clear visual hierarchy between primary (kill) and secondary (details, export) actions.

---

## Summary Table

| # | Category | Severity | Issue |
|---|----------|----------|-------|
| UI-1 | Safety | Critical | No confirmation for kill actions |
| UI-2 | Consistency | High | Wrong icons for Copy/Folder actions |
| UI-3 | Discoverability | High | Kill/Details buttons hidden until hover |
| UI-4 | Accessibility | High | Port grid not keyboard accessible |
| UI-5 | Accessibility | High | Toast lacks ARIA attributes |
| UI-6 | Accessibility | High | Modals don't trap focus |
| UI-7 | Consistency | Medium | Save button uses danger/red styling |
| UI-8 | Accessibility | Medium | Context menu no keyboard nav |
| UI-9 | Discoverability | Medium | Commands are undiscoverable |
| UI-10 | Control | Medium | Auto-hide on focus loss is disruptive |
| UI-11 | Feedback | Medium | No refresh indicator |
| UI-12 | Maintenance | Low | DotFree/DotUsed icons identical |
| UI-13 | Layout | Low | Port grid doesn't scale with custom ports |
| UI-14 | Consistency | Low | Inconsistent text sizes |
| H1 | Heuristic | Medium | Partial system status visibility |
| H3 | Heuristic | High | Poor user control (no undo, auto-hide) |
| H5 | Heuristic | Critical | No error prevention for kills |
| H9 | Heuristic | Medium | Raw error messages, no guidance |
| H10 | Heuristic | Medium | No help system |
| Fitts | Motor | Medium | Kill targets too small |
| Cog | Cognitive | Medium | Extraneous load from multi-purpose search |
| A11y | WCAG | High | Multiple Level A failures |
| Contrast | WCAG | Medium | Text contrast below 4.5:1 |
| Motion | WCAG | Low | No prefers-reduced-motion support |
