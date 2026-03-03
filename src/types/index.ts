import type { Node, Edge } from '@xyflow/react';

// ─── Category ───────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  label: string;
  color: string; // hex color
}

// ─── Node Data ──────────────────────────────────────────────────────────────

export interface SystemNodeData {
  title: string;
  category: string; // category id
  [key: string]: unknown; // required by React Flow
}

export type SystemNode = Node<SystemNodeData, 'system'>;

// ─── Edge Data ──────────────────────────────────────────────────────────────

export interface SystemEdgeData {
  polarity?: '+' | '-';
  controlOffsetX?: number;
  controlOffsetY?: number;
  [key: string]: unknown;
}

export type SystemEdge = Edge<SystemEdgeData>;

// ─── Config ─────────────────────────────────────────────────────────────────

export interface MapConfig {
  blobsEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  blobPadding: number;
  edgeStyle: 'classic' | 'bezier';
  categories: Category[];
}

// ─── Save File ──────────────────────────────────────────────────────────────

export interface SystemMapSave {
  version: number;
  config: MapConfig;
  nodes: SystemNode[];
  edges: SystemEdge[];
  viewport?: { x: number; y: number; zoom: number };
}
