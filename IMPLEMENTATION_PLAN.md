# Systems Map — Implementation Plan

> **Status: MVP Complete** — All 7 phases implemented and building cleanly.  
> Last updated: 2026-03-03

## Overview

An interactive web-based systems map (causal loop diagram) where users can pan/zoom a canvas, create nodes, connect them with directed edges, move nodes freely, and persist state via JSON export/import. Nodes carry structured data (title, increase/decrease lists, category). An optional "blobs" mode groups same-category nodes visually with colored convex-hull overlays.

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | **TypeScript 5.9** | Type safety for node/edge schemas, autocomplete, refactor confidence |
| **Framework** | **React 19** + **Vite 7** | Component model, massive ecosystem, fast HMR via Vite |
| **Canvas/Graph** | **@xyflow/react 12.10** | Purpose-built for node-based UIs — pan/zoom, drag, edge connections, custom nodes all built-in |
| **Styling** | **Tailwind CSS 4.2** (via `@tailwindcss/vite`) | Utility-first, fast iteration, easy theming |
| **State** | **Zustand 5** | Lightweight store that React Flow recommends; no boilerplate |
| **Blob Hulls** | **d3-shape 3** + custom `hull.ts` | Compute convex hulls around category groups, render as SVG paths behind nodes |
| **Validation** | **Zod 4** | Schema validation on JSON import |
| **Persistence** | Browser `localStorage` + JSON file download/upload | Zero backend, instant save/load |
| **Package Manager** | **pnpm** | Fast, disk-efficient |

### Why React Flow (@xyflow/react)?

- **Built-in**: infinite canvas, pan, zoom, minimap, node dragging, edge creation by dragging handles, keyboard shortcuts
- **Custom nodes**: render any React component inside a node (our structured card)
- **Custom edges**: animated, labeled, styled per-edge
- **Lightweight**: ~45 kB gzipped
- **Serialization**: nodes/edges are plain JSON arrays — trivial to export/import
- **Background patterns**: dots/lines grid out of the box
- **First-class TypeScript support**

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| D3.js (force layout) | Ultimate flexibility | Must build all interaction from scratch |
| Cytoscape.js | Graph-theory algorithms | Heavier, less React-friendly, opinionated rendering |
| Svelte Flow | Lighter runtime | Smaller ecosystem, fewer examples |
| Raw Canvas/WebGL | Max performance | Enormous effort for basic UX (hit testing, text rendering) |

**Verdict**: React Flow gives us 80% of the features for free and lets us focus on the domain-specific parts (node content, blobs, persistence).

---

## Data Model

### Node

```typescript
interface SystemNode {
  id: string;                  // uuid
  type: 'systemNode';         // React Flow custom node type
  position: { x: number; y: number };
  data: {
    title: string;
    increases: string[];       // list of "increase" effects
    decreases: string[];       // list of "decrease" effects
    category: string;          // e.g. "Economic", "Social", "Environmental"
  };
}
```

### Edge

```typescript
interface SystemEdge {
  id: string;
  source: string;             // node id
  target: string;             // node id
  label?: string;             // optional relationship label
  type?: 'default' | 'step' | 'smoothstep' | 'bezier';
  animated?: boolean;
  data?: {
    polarity?: '+' | '-';    // reinforcing or balancing
  };
}
```

### Category (for colors & blobs)

```typescript
interface Category {
  id: string;
  label: string;
  color: string;              // hex or tailwind color token
}
```

### Global Config

```typescript
interface MapConfig {
  blobsEnabled: boolean;      // toggle category blob overlays
  categories: Category[];
  snapToGrid: boolean;
  gridSize: number;
}
```

### Save File

```typescript
interface SystemMapSave {
  version: number;            // schema version for migrations
  config: MapConfig;
  nodes: SystemNode[];
  edges: SystemEdge[];
  viewport?: { x: number; y: number; zoom: number };
}
```

All of this serializes to/from a single `.json` file.

---

## Architecture (Implemented)

```
src/
├── main.tsx                   # entry point (React 19 createRoot)
├── App.tsx                    # layout: ReactFlowProvider → Canvas + NodeEditor sidebar
├── index.css                  # Tailwind imports + React Flow overrides
├── store/
│   └── useMapStore.ts         # Zustand store (nodes, edges, config, CRUD, auto-save/load)
├── components/
│   ├── Canvas.tsx             # <ReactFlow> wrapper + MiniMap, Controls, Background, keyboard shortcuts
│   ├── nodes/
│   │   └── SystemNodeCard.tsx # custom node: title, ▲increases, ▼decreases, category color bar, dup/delete
│   ├── edges/
│   │   └── PolarityEdge.tsx   # custom edge: +/− toggle button, green/red coloring, delete on select
│   ├── blobs/
│   │   └── CategoryBlobs.tsx  # SVG convex-hull overlays per category (Catmull-Rom closed curves)
│   └── panels/
│       ├── Toolbar.tsx        # top bar: + Node, Blobs toggle, Snap toggle, Fit View, Export, Import
│       ├── NodeEditor.tsx     # right sidebar: edit title, category, add/remove increases & decreases
│       └── ConfigPanel.tsx    # settings dropdown: grid size slider, category CRUD with color pickers
├── lib/
│   ├── hull.ts                # Graham scan convex hull + centroid-based expansion
│   ├── colors.ts              # default categories (5) + getCategoryColor helper
│   └── io.ts                  # Zod-validated serialize/deserialize + downloadJson/uploadJson helpers
└── types/
    └── index.ts               # SystemNode, SystemEdge, Category, MapConfig, SystemMapSave interfaces
```

> **Note**: Export/Import are integrated into `Toolbar.tsx` rather than separate `io/` components — simpler, fewer files.

---

## Feature Breakdown & Implementation Steps

### Phase 1 — Scaffold & Basic Canvas ✅

| # | Task | Status | Details |
|---|---|---|---|
| 1.1 | Project init | ✅ | Vite 7 + React 19 + TS 5.9, Tailwind 4.2 via `@tailwindcss/vite`, React Flow 12.10, Zustand 5 |
| 1.2 | Zustand store | ✅ | `useMapStore` — nodes, edges, config, viewport, selection, CRUD, auto-save/load |
| 1.3 | Canvas component | ✅ | `Canvas.tsx` — ReactFlow + MiniMap + Controls + Background (dots grid) |
| 1.4 | Default nodes | ✅ | Nodes created via toolbar "+ Node" button, placed at viewport center |

**Outcome**: Pan, zoom, drag nodes, connect with default edges.

### Phase 2 — Custom Node Component ✅

| # | Task | Status | Details |
|---|---|---|---|
| 2.1 | `SystemNodeCard` | ✅ | Custom node: title, ▲increases (green), ▼decreases (red), category color header bar |
| 2.2 | Source/target handles | ✅ | Top (target) + bottom (source) handles, colored per category |
| 2.3 | Node context menu | ✅ | Header buttons for duplicate (⧉) and delete (✕); right-click selects for editing |

### Phase 3 — Node Editing ✅

| # | Task | Status | Details |
|---|---|---|---|
| 3.1 | `NodeEditor` sidebar | ✅ | Right sidebar: title input, category dropdown, add/remove increases & decreases with Enter-to-add |
| 3.2 | Add-node toolbar button | ✅ | "+ Node" in toolbar, placed at viewport center via `screenToFlowPosition` |
| 3.3 | Delete node | ✅ | Delete/Backspace key, node header ✕ button, or sidebar "Delete Node" button; removes connected edges |

### Phase 4 — Edge Customization ✅

| # | Task | Status | Details |
|---|---|---|---|
| 4.1 | `PolarityEdge` | ✅ | Custom edge: circular +/− label, green for reinforcing, red for balancing |
| 4.2 | Edge edit | ✅ | Click the polarity button to toggle +/−; delete button appears when edge is selected |
| 4.3 | Animated edges | ⬜ | Not yet implemented (optional toggle) |

### Phase 5 — Categories & Blobs ✅

| # | Task | Status | Details |
|---|---|---|---|
| 5.1 | Category management | ✅ | `ConfigPanel`: add/remove categories with name + color picker, 5 defaults (Economic, Social, Environmental, Political, Technological) |
| 5.2 | Node coloring | ✅ | Node border + header colored by category; handles colored by category; minimap colored by category |
| 5.3 | Blob rendering | ✅ | Graham scan convex hull → 80px centroid expansion → Catmull-Rom closed SVG paths; 2-node groups use synthetic ellipse shape |
| 5.4 | Blob updates | ✅ | Blobs recompute via `useMemo` on node/config changes, behind a `blobsEnabled` toggle in toolbar |

**Blob algorithm sketch:**

```typescript
// 1. Group nodes by category
const groups = groupBy(nodes, n => n.data.category);

// 2. For each group with ≥ 3 nodes, compute padded convex hull
for (const [cat, members] of Object.entries(groups)) {
  const points = members.map(n => [n.position.x, n.position.y]);
  const hullPoints = convexHull(points, padding: 60);
  // 3. Render smooth closed curve through hull points
  const path = d3.line().curve(d3.curveCatmullRomClosed)(hullPoints);
  // 4. Draw <path d={path} fill={categoryColor} opacity={0.12} />
}
```

### Phase 6 — Persistence (JSON Export / Import) ✅

| # | Task | Status | Details |
|---|---|---|---|
| 6.1 | Export | ✅ | `serializeSave` → `downloadJson` as `systems-map-YYYY-MM-DD.json` via toolbar "↓ Export" button |
| 6.2 | Import | ✅ | `uploadJson` → `deserializeSave` (Zod 4 validated) → `loadSaveData` → `fitView`; alert on error |
| 6.3 | Auto-save | ✅ | `setInterval` every 2s → `localStorage`; auto-load on mount via `useEffect` |
| 6.4 | Schema validation | ✅ | Full Zod schema: `SaveSchema` validates version, config, nodes, edges, viewport |

### Phase 7 — Polish & UX (Partial) ✅

| # | Task | Status | Details |
|---|---|---|---|
| 7.1 | Keyboard shortcuts | ✅ | `Cmd/Ctrl+S` save, `Delete`/`Backspace` remove selected node or edge |
| 7.2 | Undo/Redo | ⬜ | Not yet implemented |
| 7.3 | Snap to grid | ✅ | Toolbar toggle ("⊞ Snap"), configurable grid size (10–50px) in settings |
| 7.4 | Minimap | ✅ | `<MiniMap>` with `nodeColor` callback → colored by category |
| 7.5 | Fit view | ✅ | Toolbar "⊡ Fit" button + auto-fit on load/import |
| 7.6 | Dark mode | ⬜ | Not yet implemented |
| 7.7 | Responsive | ✅ | React Flow handles touch pan/zoom natively |

---

## Blob Visualization — Detail

When enabled, blobs create soft colored regions behind nodes of the same category, similar to mind-map group bubbles.

```
┌──────────────────────────────────────┐
│           ╭─ ─ ─ ─ ─ ─╮             │
│          ╱  [Economic]  ╲            │
│         │  ┌─────┐ ┌─────┐│          │
│         │  │GDP  │→│Trade││          │
│         │  └─────┘ └─────┘│          │
│          ╲   ┌─────┐     ╱           │
│           ╰─ │Jobs │─ ─╯            │
│              └─────┘                 │
│                                      │
│     ╭─ ─ ─ ─ ─ ─ ─ ─╮              │
│    ╱    [Environmental] ╲            │
│   │  ┌──────┐  ┌───────┐ │          │
│   │  │CO₂   │→ │Forests│ │          │
│   │  └──────┘  └───────┘ │          │
│    ╲                     ╱           │
│     ╰─ ─ ─ ─ ─ ─ ─ ─ ╯             │
└──────────────────────────────────────┘
```

**Implementation**: A custom React Flow `<Panel>` or SVG layer rendered at `z-index: 0` (behind nodes at `z-index: 1`). Uses convex hull with ~60px padding and a smooth Catmull-Rom closed curve.

---

## Package List (Installed)

```json
{
  "dependencies": {
    "@xyflow/react": "12.10.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zustand": "5.0.11",
    "zod": "4.3.6",
    "d3-shape": "3.2.0",
    "uuid": "13.0.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@types/d3-shape": "3.1.8",
    "tailwindcss": "4.2.1",
    "@tailwindcss/vite": "4.2.1",
    "vite": "7.3.1",
    "@vitejs/plugin-react": "5.1.4"
  }
}
```

> **Note**: `hull.js` was dropped in favor of a custom Graham scan implementation in `src/lib/hull.ts`.

---

## Milestones & Status

| Milestone | Status | Notes |
|---|---|---|
| Phase 1 — Scaffold & Canvas | ✅ Complete | Vite + React + TS + Tailwind + React Flow + Zustand |
| Phase 2 — Custom Nodes | ✅ Complete | `SystemNodeCard` with full data display |
| Phase 3 — Node Editing | ✅ Complete | `NodeEditor` sidebar + toolbar add/delete |
| Phase 4 — Edge Customization | ✅ Complete | `PolarityEdge` with +/− toggle (animated edges still TODO) |
| Phase 5 — Categories & Blobs | ✅ Complete | 5 default categories, blob hulls with Catmull-Rom curves |
| Phase 6 — JSON Persistence | ✅ Complete | Export/Import + localStorage auto-save + Zod validation |
| Phase 7 — Polish & UX | 🟡 Partial | Shortcuts, snap, minimap, fit view done; undo/redo & dark mode TODO |

### Remaining TODO

- [ ] Undo/Redo (Zustand temporal middleware)
- [ ] Dark mode toggle
- [ ] Animated edges toggle
- [ ] Edge labels (free text)

---

## Key Design Decisions

1. **No backend** — Everything runs client-side. JSON files are the persistence layer. This keeps deployment trivial (static host / GitHub Pages / Vercel).
2. **React Flow handles the hard parts** — Pan, zoom, drag, connect, minimap, controls. We focus on domain logic.
3. **Zustand over Redux** — Less boilerplate, React Flow's docs recommend it, built-in `persist` middleware for localStorage.
4. **Blobs are optional** — Behind a toggle so they don't distract when not needed. Computed dynamically from node positions.
5. **Zod validation on import** — Prevents corrupt state from malformed JSON files.
6. **Schema versioning** — `version` field in save files enables future migrations without breaking old saves.

---

## Future Extensions (Out of Scope for MVP)

- **Collaboration**: WebSocket + CRDT (Yjs) for real-time multi-user editing
- **Backend persistence**: Supabase or Firebase for cloud saves
- **AI analysis**: Feed the graph to an LLM to identify feedback loops, leverage points
- **Export to image**: html-to-image or canvas snapshot for PNG/SVG export
- **Simulation**: Animate flows through the system based on increase/decrease relationships
- **Search & filter**: Find nodes by title, filter by category
- **Subgraphs / nesting**: Collapse a group of nodes into a single meta-node

## Quick Start

```bash
pnpm install
pnpm dev          # → http://localhost:5173
pnpm build        # production build → dist/
```
