import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport,
} from '@xyflow/react';
import { v4 as uuid } from 'uuid';
import type {
  SystemNode,
  SystemEdge,
  MapConfig,
  SystemMapSave,
  SystemNodeData,
} from '../types';
import { DEFAULT_CATEGORIES } from '../lib/colors';
import { computeAutoLayout, optimizeEdgeHandles } from '../lib/autoLayout';

// ─── Undo / Redo history ────────────────────────────────────────────────────

interface Snapshot {
  nodes: SystemNode[];
  edges: SystemEdge[];
}

const MAX_HISTORY = 50;
let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];

// pushSnapshot is set after store creation to access set()
let pushSnapshot: (state: { nodes: SystemNode[]; edges: SystemEdge[] }) => void = () => {};

const STORAGE_KEY = 'systems-map-autosave';

// ─── Default config ─────────────────────────────────────────────────────────

const defaultConfig: MapConfig = {
  blobsEnabled: false,
  snapToGrid: false,
  gridSize: 20,
  blobPadding: 40,
  edgeStyle: 'classic',
  categories: DEFAULT_CATEGORIES,
};

// ─── Store interface ────────────────────────────────────────────────────────

interface MapState {
  nodes: SystemNode[];
  edges: SystemEdge[];
  config: MapConfig;
  viewport: Viewport;
  selectedNodeId: string | null;
  undoCount: number;
  redoCount: number;

  // React Flow handlers
  onNodesChange: OnNodesChange<SystemNode>;
  onEdgesChange: OnEdgesChange<SystemEdge>;
  onConnect: OnConnect;

  // Node CRUD
  addNode: (data: Partial<SystemNodeData>, position?: { x: number; y: number }) => void;
  updateNodeData: (id: string, data: Partial<SystemNodeData>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;

  // Edge CRUD
  updateEdgeData: (id: string, data: Partial<SystemEdge['data']>) => void;
  deleteEdge: (id: string) => void;
  reverseEdge: (id: string) => void;
  resetEdgeControlPoints: () => void;

  // Selection
  setSelectedNodeId: (id: string | null) => void;

  // Layout
  autoLayout: (direction?: 'TB' | 'LR' | 'BT' | 'RL') => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;

  // Config
  setConfig: (config: Partial<MapConfig>) => void;
  setViewport: (viewport: Viewport) => void;

  // Persistence
  getSaveData: () => SystemMapSave;
  loadSaveData: (save: SystemMapSave) => void;
  autoSave: () => void;
  autoLoad: () => boolean;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useMapStore = create<MapState>((set, get) => ({
  nodes: [],
  edges: [],
  config: defaultConfig,
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  undoCount: 0,
  redoCount: 0,

  // ── React Flow event handlers ───────────────────────────────────────────

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    pushSnapshot(get());
    // Normalize handles: with Loose mode, target might land on a source handle (s-*)
    // Ensure sourceHandle is always s-* and targetHandle is always t-*
    const normalizeHandle = (h: string | null | undefined, prefix: 's' | 't'): string | null => {
      if (!h) return null;
      const pos = h.startsWith('s-') || h.startsWith('t-') ? h.slice(2) : h;
      return `${prefix}-${pos}`;
    };
    const newEdge: SystemEdge = {
      ...connection,
      id: `e-${uuid()}`,
      type: 'polarity',
      sourceHandle: normalizeHandle(connection.sourceHandle, 's'),
      targetHandle: normalizeHandle(connection.targetHandle, 't'),
      data: { polarity: '+' },
    };
    set({ edges: addEdge(newEdge, get().edges) as SystemEdge[] });
  },

  // ── Node CRUD ───────────────────────────────────────────────────────────

  addNode: (data, position) => {
    pushSnapshot(get());
    const id = `n-${uuid()}`;
    const newNode: SystemNode = {
      id,
      type: 'system',
      position: position ?? { x: 250 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: {
        title: data.title ?? 'New Node',
        category: data.category ?? get().config.categories[0]?.id ?? '',
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    });
  },

  deleteNode: (id) => {
    pushSnapshot(get());
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },

  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    get().addNode(
      { ...node.data },
      { x: node.position.x + 50, y: node.position.y + 50 },
    );
  },

  // ── Edge CRUD ───────────────────────────────────────────────────────────

  updateEdgeData: (id, data) => {
    pushSnapshot(get());
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...data } } : e,
      ),
    });
  },

  deleteEdge: (id) => {
    pushSnapshot(get());
    set({ edges: get().edges.filter((e) => e.id !== id) });
  },

  reverseEdge: (id) => {
    pushSnapshot(get());
    set({
      edges: get().edges.map((e) => {
        if (e.id !== id) return e;
        // Extract the position part from any handle id (s-top → top, t-right → right, etc.)
        const getPosition = (h: string | null | undefined): string | null => {
          if (!h) return null;
          // Handle IDs are "s-top", "t-bottom", "s-left", "t-right", or legacy "top", "bottom", etc.
          if (h.startsWith('s-') || h.startsWith('t-')) return h.slice(2);
          return h;
        };
        const oldSourcePos = getPosition(e.sourceHandle);
        const oldTargetPos = getPosition(e.targetHandle);
        return {
          ...e,
          source: e.target,
          target: e.source,
          // New source needs a source handle (s-*) at the old target's position
          sourceHandle: oldTargetPos ? `s-${oldTargetPos}` : null,
          // New target needs a target handle (t-*) at the old source's position
          targetHandle: oldSourcePos ? `t-${oldSourcePos}` : null,
        };
      }),
    });
  },

  resetEdgeControlPoints: () => {
    pushSnapshot(get());
    set({
      edges: get().edges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          controlOffsetX: undefined,
          controlOffsetY: undefined,
        },
      })),
    });
  },

  // ── Selection ───────────────────────────────────────────────────────────

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // ── Config ──────────────────────────────────────────────────────────────

  setConfig: (partial) => {
    set({ config: { ...get().config, ...partial } });
  },

  setViewport: (viewport) => set({ viewport }),

  // ── Layout ──────────────────────────────────────────────────────────────

  autoLayout: (direction) => {
    pushSnapshot(get());
    const { nodes, edges } = get();
    const laid = computeAutoLayout(nodes, edges, { direction });
    const optimizedEdges = optimizeEdgeHandles(laid, edges);
    set({ nodes: laid, edges: optimizedEdges });
  },

  // ── Undo / Redo ─────────────────────────────────────────────────────────

  undo: () => {
    if (undoStack.length === 0) return;
    redoStack.push({
      nodes: structuredClone(get().nodes),
      edges: structuredClone(get().edges),
    });
    const snapshot = undoStack.pop()!;
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    });
  },

  redo: () => {
    if (redoStack.length === 0) return;
    undoStack.push({
      nodes: structuredClone(get().nodes),
      edges: structuredClone(get().edges),
    });
    const snapshot = redoStack.pop()!;
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    });
  },

  // ── Persistence ─────────────────────────────────────────────────────────

  getSaveData: () => ({
    version: 1,
    config: get().config,
    nodes: get().nodes,
    edges: get().edges,
    viewport: get().viewport,
  }),

  loadSaveData: (save) => {
    // Migrate edges: ensure handle IDs are compatible with current handle scheme
    const migratedEdges = save.edges.map((e) => {
      // Old edges with null handles still work via backward-compat hidden handles
      // Edges with old-style names ("top", "bottom-target") get migrated
      const migrateSource = (h: string | null | undefined) => {
        if (!h) return h ?? null;
        if (h === 'top') return 's-top';
        if (h === 'bottom') return 's-bottom';
        if (h === 'left') return 's-left';
        if (h === 'right') return 's-right';
        return h;
      };
      const migrateTarget = (h: string | null | undefined) => {
        if (!h) return h ?? null;
        if (h === 'top-target') return 't-top';
        if (h === 'bottom-target') return 't-bottom';
        if (h === 'left-target') return 't-left';
        if (h === 'right-target') return 't-right';
        return h;
      };
      return {
        ...e,
        sourceHandle: migrateSource(e.sourceHandle),
        targetHandle: migrateTarget(e.targetHandle),
      };
    });
    set({
      config: { ...defaultConfig, ...save.config, blobPadding: save.config.blobPadding ?? 40, edgeStyle: save.config.edgeStyle ?? 'classic' },
      nodes: save.nodes,
      edges: migratedEdges,
      viewport: save.viewport ?? { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
    });
  },

  autoSave: () => {
    try {
      const data = get().getSaveData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // silently fail
    }
  },

  autoLoad: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const save: SystemMapSave = JSON.parse(raw);
      get().loadSaveData(save);
      return true;
    } catch {
      return false;
    }
  },
}));

// Initialize pushSnapshot now that we have access to set via the store
pushSnapshot = (state) => {
  undoStack.push({
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
  });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  useMapStore.setState({ undoCount: undoStack.length, redoCount: 0 });
};
