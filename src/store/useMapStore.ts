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

const STORAGE_KEY = 'systems-map-autosave';

// ─── Default config ─────────────────────────────────────────────────────────

const defaultConfig: MapConfig = {
  blobsEnabled: false,
  snapToGrid: false,
  gridSize: 20,
  categories: DEFAULT_CATEGORIES,
};

// ─── Store interface ────────────────────────────────────────────────────────

interface MapState {
  nodes: SystemNode[];
  edges: SystemEdge[];
  config: MapConfig;
  viewport: Viewport;
  selectedNodeId: string | null;

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

  // Selection
  setSelectedNodeId: (id: string | null) => void;

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

  // ── React Flow event handlers ───────────────────────────────────────────

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const newEdge: SystemEdge = {
      ...connection,
      id: `e-${uuid()}`,
      type: 'polarity',
      data: { polarity: '+' },
    };
    set({ edges: addEdge(newEdge, get().edges) as SystemEdge[] });
  },

  // ── Node CRUD ───────────────────────────────────────────────────────────

  addNode: (data, position) => {
    const id = `n-${uuid()}`;
    const newNode: SystemNode = {
      id,
      type: 'system',
      position: position ?? { x: 250 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: {
        title: data.title ?? 'New Node',
        increases: data.increases ?? [],
        decreases: data.decreases ?? [],
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
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...data } } : e,
      ),
    });
  },

  deleteEdge: (id) => {
    set({ edges: get().edges.filter((e) => e.id !== id) });
  },

  // ── Selection ───────────────────────────────────────────────────────────

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // ── Config ──────────────────────────────────────────────────────────────

  setConfig: (partial) => {
    set({ config: { ...get().config, ...partial } });
  },

  setViewport: (viewport) => set({ viewport }),

  // ── Persistence ─────────────────────────────────────────────────────────

  getSaveData: () => ({
    version: 1,
    config: get().config,
    nodes: get().nodes,
    edges: get().edges,
    viewport: get().viewport,
  }),

  loadSaveData: (save) => {
    set({
      config: save.config,
      nodes: save.nodes,
      edges: save.edges,
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
