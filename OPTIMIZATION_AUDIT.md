# PortKiller - Optimization & Rendering Audit

## Executive Summary

This document identifies all logical, rendering, and performance issues found in the PortKiller codebase through deep static analysis of the Preact frontend and Tauri backend integration.

---

## 1. CRITICAL: Stale Closure in `fetchPorts` Causes Missed Change Detection

**File:** `src/App.tsx:58-104`
**Severity:** Critical
**Type:** Stale closure / incorrect dependency tracking

The `fetchPorts` callback depends on `state?.ports` and `prevPorts` in its dependency array, but the `useEffect` on line 106-110 that sets up the interval uses an **empty dependency array `[]`**. This means:

- The interval captures the **initial** `fetchPorts` reference (when `state` is `null` and `prevPorts` is empty)
- Every 2 seconds, the stale closure runs with outdated `state` and `prevPorts`
- Change detection (`new`/`removed` port tracking) **never works correctly** after the first render
- The `if (state?.ports)` check on line 63 always sees `null` in the stale closure

**Impact:** Port change indicators (NEW badge, green/red highlights) are fundamentally broken.

**Fix:** Either use a ref to hold current state/prevPorts, or include `fetchPorts` in the interval effect's dependency array with proper cleanup.

---

## 2. CRITICAL: Memory Leak from Unbounded `setTimeout` Accumulation

**File:** `src/App.tsx:74-80`
**Severity:** Critical
**Type:** Memory leak / timer leak

Inside `fetchPorts`, a `setTimeout` is created for every new port detected:
```typescript
setTimeout(() => {
  setPortChanges(prev => { ... })
}, 3000)
```

**Problems:**
- Timer IDs are never stored or cleaned up
- If the component unmounts before 3s, the callback still fires on unmounted state
- With 2s polling, if ports keep changing, timers accumulate faster than they resolve
- No batching - each port gets its own independent timer

**Impact:** Potential memory leak and state-update-on-unmounted-component warnings.

**Fix:** Store timer IDs in a ref and clear them on cleanup. Or use a single batched timer approach.

---

## 3. HIGH: `filteredPorts` Referenced in Stale Keyboard Handler

**File:** `src/App.tsx:134-200`
**Severity:** High
**Type:** Stale closure

The global keyboard handler `useEffect` has dependencies `[selectedIndex, contextMenu, detailsPort, showSettings]` but references `filteredPorts` (line 165, 177, 185, 193) which is **not** in the dependency array.

**Impact:** When `filteredPorts` changes (user types in search, ports refresh), keyboard navigation operates on a stale list. Pressing Enter could kill the wrong process, arrow keys navigate a phantom list.

**Fix:** Add `filteredPorts` to the dependency array, or use a ref.

---

## 4. HIGH: Duplicate `ChangeState` Type Definition

**File:** `src/App.tsx:36` and `src/types.ts:62`
**Severity:** Medium
**Type:** Code duplication / maintenance hazard

`ChangeState` is defined twice:
- `src/App.tsx:36` - `type ChangeState = 'new' | 'removed' | 'stable'`
- `src/types.ts:62` - `export type ChangeState = 'new' | 'removed' | 'stable'`

The `PortList` component imports from `types.ts`, but `App.tsx` uses its own local definition. If they ever diverge, type mismatches will occur silently.

**Fix:** Remove the duplicate in `App.tsx` and import from `types.ts`.

---

## 5. HIGH: Polling Interval Never Resets on `fetchPorts` Change

**File:** `src/App.tsx:106-110`
**Severity:** High
**Type:** Stale reference

```typescript
useEffect(() => {
  fetchPorts()
  const interval = setInterval(fetchPorts, 2000)
  return () => clearInterval(interval)
}, [])
```

Empty dependency array means the interval is set once with the initial `fetchPorts` reference. Even though `fetchPorts` is wrapped in `useCallback` with `[state?.ports, prevPorts]`, the interval never picks up the new reference.

**Impact:** The interval always calls the stale initial `fetchPorts`. Change tracking is broken.

**Fix:** Use `fetchPorts` in the dependency array, or use a ref pattern:
```typescript
const fetchPortsRef = useRef(fetchPorts)
fetchPortsRef.current = fetchPorts
useEffect(() => {
  const interval = setInterval(() => fetchPortsRef.current(), 2000)
  return () => clearInterval(interval)
}, [])
```

---

## 6. HIGH: `showToast` Creates Overlapping Timers

**File:** `src/App.tsx:210-214`
**Severity:** High
**Type:** Timer leak / UX bug

```typescript
const showToast = (message: string, type: 'success' | 'error') => {
  setToast({ message, type })
  const duration = type === 'error' ? 5000 : 3000
  setTimeout(() => setToast(null), duration)
}
```

If `showToast` is called twice rapidly (e.g., bulk kill), the first timer still fires and clears the second toast prematurely.

**Impact:** New toasts disappear too quickly because the old timer clears them.

**Fix:** Store the timer ID in a ref and clear it before setting a new one.

---

## 7. MEDIUM: `handleBulkKill` Executes Kills Sequentially

**File:** `src/App.tsx:286-311`
**Severity:** Medium
**Type:** Performance bottleneck

```typescript
for (const port of portsToKill) {
  try {
    const result = await invoke<KillResult>('kill_process', { ... })
    if (result.success) killed++
  } catch { }
}
```

Kills are awaited one-by-one in sequence. With 10 selected ports, this could take 10+ seconds.

**Impact:** UI appears frozen during bulk kill operations.

**Fix:** Use `Promise.allSettled()` to kill in parallel:
```typescript
const results = await Promise.allSettled(
  portsToKill.map(port => invoke<KillResult>('kill_process', { ... }))
)
```

---

## 8. MEDIUM: `getCommonPortStatus` Does Linear Scan Per Port

**File:** `src/App.tsx:410-412`
**Severity:** Medium
**Type:** Unnecessary O(n*m) complexity

```typescript
const getCommonPortStatus = (port: number): PortInfo | undefined => {
  return state?.ports.find(p => p.port === port)
}
```

This is called 8 times (once per common port) on every render. Each call scans the entire `state.ports` array. Total: O(8 * n) per render.

**Impact:** Unnecessary work on every 2-second refresh.

**Fix:** Memoize a port-number-to-PortInfo map:
```typescript
const portMap = useMemo(() => {
  const map = new Map<number, PortInfo>()
  state?.ports.forEach(p => map.set(p.port, p))
  return map
}, [state?.ports])
```

---

## 9. MEDIUM: Icon Components Re-create SVG Elements Every Render

**File:** `src/components/Icons.tsx:1-166`
**Severity:** Medium
**Type:** Unnecessary virtual DOM work

All 20 icon components are plain functions that return new SVG JSX on every call. Since they're used extensively (Kill button in every list row, dots, shields), this generates significant virtual DOM churn.

**Impact:** ~40-60 extra SVG elements diffed per render cycle with 20 ports.

**Fix:** Memoize icon components or convert to static strings with `dangerouslySetInnerHTML` for truly static icons. With Preact, wrapping with `memo()` from `preact/compat` would skip re-renders when `className` hasn't changed.

---

## 10. MEDIUM: `PortList` Creates New Default Values Every Render

**File:** `src/components/PortList.tsx:29-30`
**Severity:** Medium
**Type:** Referential instability

```typescript
selectedPorts = new Set(),
portChanges = new Map(),
```

Default parameter values `new Set()` and `new Map()` create new objects on every render, causing child components to see new references and potentially re-render.

**Fix:** Use module-level constants:
```typescript
const EMPTY_SET = new Set<string>()
const EMPTY_MAP = new Map<string, ChangeState>()
```

---

## 11. MEDIUM: CSS Animations Applied on Mount Trigger Layout Thrashing

**File:** `src/App.tsx:434`, `src/index.css:29`
**Severity:** Medium
**Type:** Performance / layout

The root `<div>` has `animate-fade-in` which triggers a CSS animation on every mount. Port cards have `hover:scale-[1.02]` with transitions. Combined with the 2s polling that could cause re-renders, this can trigger layout recalculations.

**Impact:** Potential jank during transitions, especially on lower-end hardware.

**Fix:** Use `will-change: transform` on animated elements and ensure animations only run once.

---

## 12. MEDIUM: `DetailsPanel` Doesn't Refresh Process Details

**File:** `src/components/DetailsPanel.tsx:18-37`
**Severity:** Medium
**Type:** Stale data

The `useEffect` only fetches process details once (dependency is `[port.pid]`). Memory and CPU values become stale immediately. For a utility app about process management, showing stale resource data is misleading.

**Fix:** Add a polling interval inside the details panel to refresh every 2-3 seconds.

---

## 13. LOW: `handleInputKeyDown` Duplicates Arrow Key Logic

**File:** `src/App.tsx:340-366` vs `src/App.tsx:163-172`
**Severity:** Low
**Type:** Code duplication

Arrow key handling exists in both the global keyboard handler and `handleInputKeyDown`. The global handler handles both Up/Down, while `handleInputKeyDown` only handles Down (line 361). This creates inconsistent behavior depending on focus state.

**Fix:** Consolidate arrow key handling in one place.

---

## 14. LOW: `executeCommand` Uses String Matching Without Debounce

**File:** `src/App.tsx:217-256`
**Severity:** Low
**Type:** Potential UX issue

Commands are triggered instantly on Enter. There's no protection against double-execution if the user presses Enter twice quickly.

**Fix:** Add a simple guard or debounce.

---

## 15. LOW: `formatBytes` Can Produce Incorrect Results

**File:** `src/components/DetailsPanel.tsx:62-67`
**Severity:** Low
**Type:** Edge case bug

```typescript
const i = Math.floor(Math.log(bytes) / Math.log(1024))
```

For very large values, `i` could exceed the `units` array length (4 items: B, KB, MB, GB). Missing TB unit. Also, `Math.log(0)` returns `-Infinity`, but this is guarded by the `bytes === 0` check.

**Fix:** Clamp `i` to `units.length - 1` and add TB.

---

## 16. LOW: Scrollbar Styles Defined in Both `index.html` and `index.css`

**File:** `index.html:21-33` and `src/index.css:107-124`
**Severity:** Low
**Type:** Duplication / specificity conflict

Scrollbar styles are defined in both places with slightly different values (inline uses `rgba(255,255,255,0.08)`, CSS uses `#333`). This creates specificity conflicts and maintenance burden.

**Fix:** Remove inline styles from `index.html` and keep only the CSS version.

---

## 17. LOW: Number Input Spinner Styles Duplicated

**File:** `index.html:34-41` and `src/index.css:14-23`
**Severity:** Low
**Type:** Duplication

Number input spinner hiding CSS exists in both files identically.

**Fix:** Remove from `index.html`, keep in `index.css`.

---

## 18. INFO: No Error Boundary for Crash Recovery

**Severity:** Low
**Type:** Missing resilience

If any component throws during render (e.g., unexpected null from Tauri IPC), the entire app crashes with a white screen. No error boundary exists to catch and recover.

**Fix:** Add a Preact error boundary component wrapping the App.

---

## 19. INFO: Google Fonts Loaded from CDN on Every Launch

**File:** `index.html:7-9`
**Severity:** Info
**Type:** Startup performance

JetBrains Mono is fetched from Google Fonts CDN on every app launch. For a desktop app, this adds 200-500ms to first paint and fails without internet.

**Fix:** Bundle the font locally in the `public/` or `src/assets/` directory.

---

## Summary Table

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | Critical | Stale Closure | fetchPorts interval captures stale state |
| 2 | Critical | Memory Leak | setTimeout timers never cleaned up |
| 3 | High | Stale Closure | Keyboard handler uses stale filteredPorts |
| 4 | Medium | Duplication | ChangeState type defined twice |
| 5 | High | Stale Ref | Polling interval never updates fetchPorts ref |
| 6 | High | Timer Leak | showToast timers overlap and cancel new toasts |
| 7 | Medium | Performance | Bulk kill executes sequentially |
| 8 | Medium | Performance | getCommonPortStatus does O(n) scan per port |
| 9 | Medium | Performance | Icon components re-create SVG every render |
| 10 | Medium | Referential | PortList creates new Set/Map defaults each render |
| 11 | Medium | Layout | CSS animations cause layout thrashing |
| 12 | Medium | Stale Data | DetailsPanel never refreshes process info |
| 13 | Low | Duplication | Arrow key handling duplicated |
| 14 | Low | UX | Command execution has no double-press guard |
| 15 | Low | Bug | formatBytes missing TB, no upper bound clamp |
| 16 | Low | Duplication | Scrollbar styles in two places |
| 17 | Low | Duplication | Number spinner styles in two places |
| 18 | Low | Resilience | No error boundary |
| 19 | Info | Startup | Google Fonts CDN dependency |
