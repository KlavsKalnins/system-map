import dagre from '@dagrejs/dagre';
import type { SystemNode, SystemEdge } from '../types';

// Estimated node dimensions (matches SystemNodeCard sizing)
const NODE_WIDTH = 220;
const NODE_HEIGHT_BASE = 80; // min height without connections

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL'; // top-bottom, left-right, etc.
  nodeSep?: number; // horizontal separation between nodes
  rankSep?: number; // vertical separation between ranks
  edgeSep?: number; // separation between edges
}

/**
 * Uses the Dagre (Sugiyama-style) layered graph layout algorithm to
 * compute optimal positions for nodes based on their directed edges.
 *
 * Nodes that "affect" others are placed in earlier (higher) ranks,
 * and nodes that are "affected by" others sit in later ranks. This
 * naturally produces a top-to-bottom causal flow.
 *
 * Returns new node positions without mutating the originals.
 */
export function computeAutoLayout(
  nodes: SystemNode[],
  edges: SystemEdge[],
  options: LayoutOptions = {},
): SystemNode[] {
  if (nodes.length === 0) return nodes;

  const {
    direction = 'TB',
    nodeSep = 60,
    rankSep = 100,
    edgeSep = 30,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    edgesep: edgeSep,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Estimate node height based on connection count
  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
  }

  for (const node of nodes) {
    const conns = connectionCounts.get(node.id) ?? 0;
    // Each connection row adds ~18px, but collapsed nodes are smaller
    const estimatedHeight = conns >= 5
      ? NODE_HEIGHT_BASE + 40 // collapsed summary
      : NODE_HEIGHT_BASE + conns * 20;
    g.setNode(node.id, { width: NODE_WIDTH, height: estimatedHeight });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Map dagre positions back onto our nodes
  // Dagre outputs center coordinates, React Flow uses top-left
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - (dagreNode.height ?? NODE_HEIGHT_BASE) / 2,
      },
    };
  });
}

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * After layout, reassign sourceHandle/targetHandle on each edge so
 * the arrow exits/enters from the side closest to the other node.
 */
export function optimizeEdgeHandles(
  nodes: SystemNode[],
  edges: SystemEdge[],
): SystemEdge[] {
  // Build a center-point lookup using measured dimensions when available
  const centerMap = new Map<string, { cx: number; cy: number }>();
  for (const node of nodes) {
    const measured = (node as unknown as { measured?: { width?: number; height?: number } }).measured;
    const w = measured?.width ?? NODE_WIDTH;
    const h = measured?.height ?? NODE_HEIGHT_BASE;
    centerMap.set(node.id, {
      cx: node.position.x + w / 2,
      cy: node.position.y + h / 2,
    });
  }

  return edges.map((edge) => {
    const src = centerMap.get(edge.source);
    const tgt = centerMap.get(edge.target);
    if (!src || !tgt) return edge;

    const bestSource = pickBestSide(src.cx, src.cy, tgt.cx, tgt.cy);
    const bestTarget = pickBestSide(tgt.cx, tgt.cy, src.cx, src.cy);

    return {
      ...edge,
      sourceHandle: `s-${bestSource}`,
      targetHandle: `t-${bestTarget}`,
    };
  });
}

/** Pick the side of `from` that faces towards `to`. */
function pickBestSide(
  fromCx: number,
  fromCy: number,
  toCx: number,
  toCy: number,
): Side {
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  // Compare absolute deltas to decide horizontal vs vertical
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}
