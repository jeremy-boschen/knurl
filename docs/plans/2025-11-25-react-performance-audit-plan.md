# React Performance Audit & Optimization Plan

**Date:** 2025-11-25
**Status:** Planning
**Priority:** High (Frontend responsiveness is critical UX issue)

---

## Executive Summary

The codebase has **strong state management optimization** (hook layer uses Zustand with selectors + useMemo) but **weak component-level optimization** (almost zero React.memo usage, inline handler functions prevent memoization).

**Current State:** Grade C+ (Partial optimization)
**Bottlenecks Identified:** 9 critical areas
**Estimated Performance Gain:** 40-60% reduction in unnecessary renders with Phase 1 + Phase 2

---

## Part 1: React Profiler Instrumentation Strategy

### Where to Add Profiler

Use `<Profiler>` from `react` to wrap high-impact components and measure actual render times.

```tsx
import { Profiler } from 'react'

function onRenderCallback(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  console.log(`[Profiler] ${id} (${phase}):`, {
    actual: `${actualDuration.toFixed(2)}ms`,
    base: `${baseDuration.toFixed(2)}ms`,
    startTime,
    commitTime
  })
}

<Profiler id="CollectionTree" onRenderCallback={onRenderCallback}>
  <CollectionTree searchTerm={searchTerm} />
</Profiler>
```

### Profiler Instrumentation Points (Priority Order)

| Component | File | Expected Risk | Measurement Goal |
|-----------|------|---|---|
| **CollectionTree** | `src/components/layout/collection-tree.tsx` | 50-200ms on search | Detect search filter overhead |
| **RequestEditor** | `src/components/request/editor/request-editor.tsx` | 20-100ms per field change | Track panel re-renders |
| **RequestHeadersPanel** | `src/components/request/editor/request-headers-panel.tsx` | 10-50ms on typing | Identify inline handler impact |
| **RequestParametersPanel** | `src/components/request/editor/request-parameters-panel.tsx` | 10-50ms per item | List re-render overhead |
| **ResponseViewer** | `src/components/response/response-viewer.tsx` | 100-500ms on large responses | Track parsing + rendering |
| **RequestWorkspace** | `src/components/request/request-workspace.tsx` | 30-150ms on any change | Overall workspace impact |
| **RequestTabBar** | `src/components/request/tabbar/request-tab-bar.tsx` | 5-30ms per tab | Tab context menu overhead |
| **LogsList** | `src/components/response/components/logs-list.tsx` | 50-200ms with 1000+ logs | Filter + render overhead |
| **RequestBodyPanel** | `src/components/request/editor/request-body-panel.tsx` | 20-80ms on editor change | Code editor integration |

### Threshold Alerts

Set up warnings in onRenderCallback:
- 🟢 < 10ms: Good (no action)
- 🟡 10-30ms: Acceptable (monitor)
- 🟠 30-100ms: Slow (needs optimization)
- 🔴 > 100ms: Critical (must fix)

### Implementation: Create Profiler Utility

**File:** `src/lib/profiler.ts`

```tsx
const PROFILER_ENABLED = import.meta.env.DEV && localStorage.getItem('REACT_PROFILER') === '1'

const thresholds = {
  'CollectionTree': 50,
  'RequestEditor': 30,
  'RequestHeadersPanel': 20,
  // ... etc
}

export function createProfiler(componentName: string) {
  return (id: string, phase: string, actualDuration: number, _base: number, _start: number, _commit: number) => {
    if (!PROFILER_ENABLED) return

    const threshold = thresholds[componentName] ?? 30
    const level = actualDuration < threshold ? '✓' : actualDuration < threshold * 2 ? '⚠️ ' : '🔴'

    console.log(`${level} ${componentName} [${phase}] ${actualDuration.toFixed(2)}ms`)
  }
}
```

Enable with: `localStorage.setItem('REACT_PROFILER', '1')` in browser console.

---

## Part 2: Phase 1 - Quick Wins (1-2 hours)

### Task 1.1: Memoize RequestTab Component
**File:** `src/components/request/tabbar/request-tab.tsx`
**Effort:** 5 min | **Impact:** High (fixes 5-10ms per tab)

Currently rendered in list without memoization. Single line fix:

```tsx
// Before
export function RequestTab({ tabId }: RequestTabProps) { ... }

// After
export const RequestTab = React.memo(function RequestTab({ tabId }: RequestTabProps) { ... })
```

**Expected Result:** Tab switching no longer re-renders all tabs.

---

### Task 1.2: Extract ModeToggle from Sidebar
**File:** `src/components/layout/sidebar.tsx`
**Effort:** 10 min | **Impact:** Medium (fixes 2-5ms)

ModeToggle function recreated on every Sidebar render.

```tsx
// Before (inside Sidebar component)
function ModeToggle() { ... }

// After (extract to separate file)
// src/components/layout/mode-toggle.tsx
export const ModeToggle = React.memo(function ModeToggle() { ... })

// Then in Sidebar
import { ModeToggle } from './mode-toggle'
```

---

### Task 1.3: Memoize FieldRow Component
**File:** `src/components/request/editor/field-row.tsx`
**Effort:** 5 min | **Impact:** High (fixes 5-15ms per list item)

Used in RequestHeadersPanel, RequestParametersPanel, RequestBodyPanel. Currently not memoized.

```tsx
// Before
export function FieldRow({ field, ...props }: FieldRowProps) { ... }

// After
export const FieldRow = React.memo(function FieldRow({ field, ...props }: FieldRowProps) { ... })
```

**Precondition:** Inline handlers in parent must be wrapped with useCallback (see Task 1.4).

---

### Task 1.4: Add useCallback to Inline Handlers
**Files:**
- `src/components/request/editor/request-headers-panel.tsx` (lines 38, 47, 57, 70)
- `src/components/request/editor/request-parameters-panel.tsx` (lines 30, 32, 38, 48, etc.)
- Similar in body, auth, options panels

**Effort:** 30 min (5-10 min per file) | **Impact:** High (enables child memoization)

```tsx
// Before
<Input
  value={header.name}
  onChange={(e) => actions.updateHeader(header.id, { name: e.target.value })}
/>

// After
const handleHeaderNameChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) =>
    actions.updateHeader(header.id, { name: e.target.value }),
  [header.id, actions]
)
<Input value={header.name} onChange={handleHeaderNameChange} />
```

**Note:** Can be bulk refactored as a pattern.

---

### Task 1.5: Memoize Panel Components
**Files:**
- `src/components/request/editor/request-headers-panel.tsx`
- `src/components/request/editor/request-parameters-panel.tsx`
- `src/components/request/editor/request-auth-panel.tsx`
- `src/components/request/editor/request-options-panel.tsx`

**Effort:** 10 min (1 line per file) | **Impact:** High

```tsx
// Add to bottom of each file
export const RequestHeadersPanel = React.memo(function RequestHeadersPanel(props) { ... })
```

**Precondition:** Task 1.4 must be done first (else memoization ineffective).

---

### Task 1.6: Memoize Request Body Panel
**File:** `src/components/request/editor/request-body-panel.tsx`
**Effort:** 10 min | **Impact:** Medium (fixes 5-10ms)

```tsx
export const RequestBodyPanel = React.memo(function RequestBodyPanel({ tabId }: RequestBodyPanelProps) { ... })
```

---

### Phase 1 Checklist
- [ ] Task 1.1: Memoize RequestTab
- [ ] Task 1.2: Extract ModeToggle
- [ ] Task 1.3: Memoize FieldRow
- [ ] Task 1.4: Add useCallback to handlers (all panel files)
- [ ] Task 1.5: Memoize panel components
- [ ] Task 1.6: Memoize RequestBodyPanel
- [ ] Test: All tests pass
- [ ] Profiler: RequestTab tab switching < 5ms, RequestHeaders typing < 15ms

**Expected Total Impact:** 30-40% reduction in editor panel re-renders

---

## Part 3: Phase 2 - Medium Effort Optimizations (3-4 hours)

### Task 2.1: Memoize RequestEditor & RequestWorkspace
**Files:**
- `src/components/request/editor/request-editor.tsx`
- `src/components/request/request-workspace.tsx`

**Effort:** 15 min | **Impact:** High (5-20ms per request change)

```tsx
export const RequestEditor = React.memo(function RequestEditor({ tabId }: RequestEditorProps) { ... })
export const RequestWorkspace = React.memo(function RequestWorkspace(props) { ... })
```

---

### Task 2.2: Memoize ResponseViewer Sections
**File:** `src/components/response/response-viewer.tsx`
**Effort:** 30 min | **Impact:** High (fixes 50-100ms on response change)

Split into memoized components:
- `ResponseHeadersViewer` (memoized)
- `ResponseBodyViewer` (memoized)
- `ResponseCookiesViewer` (memoized)

```tsx
// src/components/response/response-headers-viewer.tsx
export const ResponseHeadersViewer = React.memo(function({ headers }) { ... })
```

Then use in ResponseViewer:
```tsx
<ResponseHeadersViewer headers={response.headers} />
<ResponseBodyViewer body={response.body} contentType={contentType} />
```

---

### Task 2.3: Optimize CollectionTree Search Filtering
**File:** `src/components/layout/collection-tree.tsx` (line 1046)
**Effort:** 20 min | **Impact:** Medium (fixes search lag)

Current code recomputes entire filter on every render:

```tsx
const matchingRequests = React.useMemo(() => {
  const reqs = Object.values(collection?.requests ?? {})
  if (!query) return reqs
  return reqs.filter((r) => [r.name, r.method, r.url ?? ""].some((v) => v.toLowerCase().includes(query)))
}, [collection, query])
```

Add debouncing to search input in parent (Sidebar). Consider memoizing the filter predicate:

```tsx
const matchesPredicate = useCallback((request: RequestState, q: string) => {
  return [request.name, request.method, request.url ?? ""]
    .some((v) => v.toLowerCase().includes(q))
}, [])

const matchingRequests = React.useMemo(() => {
  if (!query) return Object.values(collection?.requests ?? {})
  return Object.values(collection?.requests ?? {}).filter((r) => matchesPredicate(r, query))
}, [collection?.requests, query, matchesPredicate])
```

---

### Task 2.4: Memoize RequestTab Rendering in RequestTabBar
**File:** `src/components/request/tabbar/request-tab-bar.tsx`
**Effort:** 10 min | **Impact:** Medium (fixes 5-15ms)

Extract menu rendering:

```tsx
// Before
const renderTabContextMenu = (tabId: string) => (
  <ContextMenu>...</ContextMenu>
)

// After
const TabContextMenu = React.memo(({ tabId }: { tabId: string }) => (
  <ContextMenu>...</ContextMenu>
))

// In render loop
<React.Fragment key={tabId}>
  <RequestTab tabId={tabId} />
  <TabContextMenu tabId={tabId} />
</React.Fragment>
```

---

### Task 2.5: Memoize Response List Components
**Files:**
- `src/components/response/components/logs-list.tsx`
- `src/components/response/components/headers-list.tsx`
- `src/components/response/components/cookies-list.tsx`

**Effort:** 15 min (5 min per file) | **Impact:** Medium (5-10ms per list)

```tsx
export const LogsList = React.memo(function LogsList(props) { ... })
export const HeadersList = React.memo(function HeadersList(props) { ... })
export const CookieList = React.memo(function CookieList(props) { ... })
```

---

### Task 2.6: Optimize CollectionTree Sensors
**File:** `src/components/layout/collection-tree.tsx` (line 202-211)
**Effort:** 10 min | **Impact:** Low (1-2ms)

```tsx
// Before
const treeSensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

// After
const treeSensors = React.useMemo(() =>
  useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  ),
  []
)
```

---

### Phase 2 Checklist
- [ ] Task 2.1: Memoize RequestEditor & RequestWorkspace
- [ ] Task 2.2: Split ResponseViewer into memoized sections
- [ ] Task 2.3: Optimize CollectionTree search filtering
- [ ] Task 2.4: Memoize RequestTabBar context menus
- [ ] Task 2.5: Memoize response list components
- [ ] Task 2.6: Optimize CollectionTree sensors
- [ ] Test: All tests pass
- [ ] Profiler: ResponseViewer < 50ms, CollectionTree search < 30ms

**Expected Total Impact:** Additional 15-25% reduction, particularly on response viewing and collection search

---

## Part 4: Phase 3 - Larger Refactors (Future sprints)

### Task 3.1: Split CollectionTree into Subcomponents
**Effort:** 4-6 hours | **Impact:** High (architectural improvement)

Current 1,549-line monolithic component. Split into:
- `CollectionTreeRoot` (state management)
- `CollectionRow` (memoized, per collection)
- `CollectionFolder` (memoized, per folder)
- `CollectionRequest` (memoized, per request)
- `CollectionSearchBox` (memoized, search input)

**Why:** Enable granular memoization. Currently entire tree re-renders on any change.

---

### Task 3.2: Add Virtual Scrolling to Large Lists
**Components:**
- LogsList (1000+ logs)
- RequestHeadersPanel (100+ headers)
- RequestParametersPanel (large query params)

**Library:** `react-window` or `tanstack/solid-virtual` (lightweight)

**Effort:** 4-6 hours | **Impact:** High (10x faster for large lists)

---

### Task 3.3: Extract Response Formatting Logic
**Effort:** 3-4 hours | **Impact:** Medium (cleaner code + easier optimization)

Move to separate memoized components:
- `ResponseJSONViewer`
- `ResponseCSVViewer`
- `ResponseHTMLViewer`
- `ResponseImageViewer`

Each with language detection + parsing memoized.

---

### Task 3.4: Debounce Search & Filter Operations
**Effort:** 2-3 hours | **Impact:** Medium (UX improvement)

Use `lodash.debounce` or custom hook:
```tsx
const debouncedSearch = useCallback(
  debounce((term: string) => {
    setSearchTerm(term)
  }, 300),
  []
)
```

Apply to:
- CollectionTree search (line 1046)
- LogsList filtering
- Response body search

---

### Task 3.5: Optimize Request State Patches
**Effort:** 6-8 hours | **Impact:** Medium (architectural)

Currently every request field change creates new patch object. Could use:
- Immer batching to reduce selectors triggered
- Granular patches (e.g., `updateHeaderName` vs `updateHeader`)
- Selector memoization per patch type

---

### Phase 3 Checklist
- [ ] Task 3.1: Split CollectionTree (future sprint)
- [ ] Task 3.2: Add virtual scrolling (future sprint)
- [ ] Task 3.3: Extract response formatters (future sprint)
- [ ] Task 3.4: Debounce search/filter (future sprint)
- [ ] Task 3.5: Optimize request patches (future sprint)

**Expected Total Impact:** 50-70% improvement, architectural foundation for scaling

---

## Part 5: Testing & Measurement Plan

### Profiler Measurements (After Each Phase)

**Setup:** Add Profiler instrumentation per Part 1

**Test Scenarios:**

1. **CollectionTree Search** (Task 2.3 validation)
   - Input: 50+ collections, 100+ requests
   - Action: Type in search box
   - Metric: Search filter + render time < 30ms
   - Before: Likely 50-100ms
   - After Phase 1: ~40ms
   - After Phase 2: ~25ms

2. **Request Header Editing** (Task 1.4 + 1.5 validation)
   - Input: Open request with 20+ headers
   - Action: Type in header value
   - Metric: Panel re-render time < 15ms
   - Before: Likely 30-50ms
   - After Phase 1: ~12ms
   - After Phase 2: ~8ms

3. **Tab Switching** (Task 1.1 validation)
   - Input: 10 open tabs
   - Action: Click different tabs
   - Metric: Tab bar re-render < 5ms per tab
   - Before: Likely 15-30ms
   - After Phase 1: ~4ms
   - After Phase 2: ~3ms

4. **Large Response Display** (Task 2.2 validation)
   - Input: 100KB JSON response, 500+ log entries
   - Action: Switch to response tab
   - Metric: ResponseViewer render < 50ms
   - Before: Likely 150-300ms
   - After Phase 1: ~100ms
   - After Phase 2: ~40ms

5. **Complex Request** (Overall validation)
   - Input: Request with 20 headers, 10 params, form body, OAuth
   - Action: Make changes to multiple fields
   - Metric: RequestEditor interactive < 20ms per change
   - Before: Likely 40-80ms
   - After Phase 1: ~25ms
   - After Phase 2: ~15ms

### Unit Tests

- Run `yarn test:unit` after each task
- No test changes should be required (only implementation)
- All 613+ tests should pass

### E2E Tests

- Run `yarn test:e2e:critical` after each phase
- Verify search, editing, tab switching still work correctly
- No performance regression in E2E execution time

### Chrome DevTools Flamegraph Analysis

After Phase 2:
1. Open DevTools > Performance tab
2. Record 30-second session with search, editing, response viewing
3. Analyze main thread time
4. Compare to baseline

**Expected:** Main thread time reduced by 40-60% for reactive operations

---

## Part 6: Documentation & Knowledge Transfer

### Create Optimization Guide

**File:** `docs/PERFORMANCE.md`

```markdown
# React Performance Optimization Guidelines

## Patterns to Follow

1. **Always memo expensive components:**
   ```tsx
   export const MyComponent = React.memo(function MyComponent(props) { ... })
   ```

2. **Use useCallback for event handlers:**
   ```tsx
   const handleChange = useCallback((value) => { ... }, [deps])
   ```

3. **Memoize list items:**
   - ✅ <ItemRow /> with React.memo
   - ✅ Key on stable ID
   - ❌ Inline onChange handlers

4. **Split large components:**
   - Max 500 lines per component
   - Extract memoized subcomponents
   - Separate state management from rendering

## Anti-patterns to Avoid

1. ❌ Inline function definitions in props
2. ❌ New object literals in dependencies
3. ❌ Component functions inside render
4. ❌ List items without memoization
5. ❌ Monolithic components > 600 lines
```

---

## Part 7: Implementation Roadmap

### Week 1: Phase 1 (Quick Wins)
- Sprint: 1 (2 hours)
- Tasks: 1.1 - 1.6
- Testing: Unit + E2E
- Profiler: Verify improvements

### Week 2: Phase 2 (Medium Effort)
- Sprint: 2-3 (6-8 hours)
- Tasks: 2.1 - 2.6
- Testing: Unit + E2E + Flamegraph
- Profiler: Validate all scenarios

### Week 3+: Phase 3 (Larger Refactors)
- Sprint: 4-6 (as part of future work)
- Tasks: 3.1 - 3.5
- Planning: Coordinate with feature work

---

## Success Criteria

### Phase 1 Complete ✓
- [ ] RequestTab memoized (no prop changes)
- [ ] All panel handlers wrapped in useCallback
- [ ] All panel components memoized
- [ ] 613 unit tests passing
- [ ] E2E critical tests passing
- [ ] Profiler shows 20-30% improvement in editor responsiveness

### Phase 2 Complete ✓
- [ ] RequestEditor, RequestWorkspace memoized
- [ ] ResponseViewer split into sections
- [ ] CollectionTree search optimized
- [ ] All response viewers memoized
- [ ] 613 unit tests passing
- [ ] E2E critical + comprehensive tests passing
- [ ] Flamegraph shows 40-60% reduction in main thread time
- [ ] Search < 30ms, editing < 15ms, responses < 50ms

### Overall Impact ✓
- [ ] UI feels responsive on 2018+ hardware
- [ ] No noticeable lag during heavy editing
- [ ] Large responses (100KB+) load smoothly
- [ ] Search across 100+ collections feels instant

---

## Open Questions & Notes

1. **Should we use Redux DevTools for profiling?**
   - Current: Zustand + React DevTools
   - Consider: Redux DevTools browser extension for action profiling

2. **Virtual scrolling library choice:**
   - `react-window` (most popular, mature)
   - `@tanstack/solid-virtual` (lighter, modern)
   - Recommend: react-window for Phase 3

3. **Profiler in production?**
   - Current plan: Development only
   - Consider: Conditional Profiler in staging for real-world metrics

4. **Should RequestTab avoid re-renders entirely?**
   - Current plan: React.memo to skip re-renders if props unchanged
   - Caveat: If parent re-renders, children render anyway (need parent memo too)

5. **CollectionTree DnD optimization:**
   - Current plan: Memoize sensors
   - Consider: Lazy load expanded folders to reduce DOM size

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Tests break after memoization | High | Run tests after each task, diff mocks if needed |
| Memoization doesn't help | Medium | Use Profiler to validate; may indicate other bottleneck |
| Callbacks create closure bugs | Medium | Careful with dependency arrays; unit test handlers |
| Virtual scrolling breaks UI | Medium | Test with keyboard nav, search, drag-drop |

---

## Success Metrics (Before & After)

**Baseline metrics (current state):**
- CollectionTree search: 50-100ms
- RequestEditor typing: 30-50ms
- Tab switching: 15-30ms
- Response display (100KB): 150-300ms

**Target metrics (after Phase 2):**
- CollectionTree search: < 30ms
- RequestEditor typing: < 15ms
- Tab switching: < 5ms
- Response display (100KB): < 50ms

**Measurement tool:** React DevTools Profiler (built-in) + Chrome DevTools Performance tab

---

## Sign-off

**Planned by:** Claude Code
**Status:** Ready for Phase 1 implementation
**Next step:** Create Profiler utility (Part 1), then start Task 1.1
