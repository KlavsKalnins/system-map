import { useMemo } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { line, curveCatmullRomClosed } from 'd3-shape';
import { useMapStore } from '../../store/useMapStore';
import { convexHull, expandHull } from '../../lib/hull';
import { getCategoryColor } from '../../lib/colors';
import type { SystemNode } from '../../types';

export default function CategoryBlobs() {
  const nodes = useMapStore((s) => s.nodes);
  const config = useMapStore((s) => s.config);
  const { getInternalNode } = useReactFlow();
  const viewport = useViewport();

  const blobs = useMemo(() => {
    if (!config.blobsEnabled) return [];

    // Group nodes by category
    const groups: Record<string, SystemNode[]> = {};
    for (const node of nodes) {
      const cat = node.data.category;
      if (!cat) continue;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(node);
    }

    const lineGenerator = line()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(curveCatmullRomClosed);

    const result: { path: string; color: string; label: string }[] = [];

    for (const [catId, members] of Object.entries(groups)) {
      if (members.length < 1) continue;

      // Use flow-space positions — generate corner points for each node
      // so the hull naturally encompasses the full card area
      const points: [number, number][] = members.flatMap((n) => {
        const internal = getInternalNode(n.id);
        const width = internal?.measured?.width ?? 200;
        const height = internal?.measured?.height ?? 100;
        const x = n.position.x;
        const y = n.position.y;
        return [
          [x, y] as [number, number],
          [x + width, y] as [number, number],
          [x + width, y + height] as [number, number],
          [x, y + height] as [number, number],
        ];
      });

      // For 2 nodes, create an ellipse-like shape by adding synthetic points
      let hullPoints: [number, number][];
      if (members.length === 1) {
        // Single node: create a rectangle-ish shape around it
        const n = members[0];
        const internal = getInternalNode(n.id);
        const w = internal?.measured?.width ?? 200;
        const h = internal?.measured?.height ?? 100;
        const cx = n.position.x + w / 2;
        const cy = n.position.y + h / 2;
        hullPoints = [
          [cx - w / 2, cy - h / 2],
          [cx + w / 2, cy - h / 2],
          [cx + w / 2, cy + h / 2],
          [cx - w / 2, cy + h / 2],
        ];
      } else if (points.length <= 8) {
        // 2 nodes (8 corner points) — create ellipse-like shape
        const centers: [number, number][] = members.map((n) => {
          const internal = getInternalNode(n.id);
          const w = internal?.measured?.width ?? 200;
          const h = internal?.measured?.height ?? 100;
          return [n.position.x + w / 2, n.position.y + h / 2];
        });
        const [a, b] = centers;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const spread = Math.max(80, len * 0.3);
        // Use the corner points plus synthetic spread points
        hullPoints = convexHull([
          ...points,
          [mx + nx * spread, my + ny * spread],
          [mx - nx * spread, my - ny * spread],
        ]);
      } else {
        hullPoints = convexHull(points);
      }

      const expanded = expandHull(hullPoints, config.blobPadding ?? 40);
      const path = lineGenerator(expanded);
      if (!path) continue;

      const color = getCategoryColor(config.categories, catId);
      const label = config.categories.find((c) => c.id === catId)?.label ?? '';
      result.push({ path, color, label });
    }

    return result;
  }, [nodes, config, getInternalNode]);

  if (!config.blobsEnabled || blobs.length === 0) return null;

  // Apply viewport transform so blobs live in flow coordinate space
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {blobs.map((blob, i) => (
          <g key={i}>
            <path
              d={blob.path}
              fill={blob.color}
              fillOpacity={0.08}
              stroke={blob.color}
              strokeOpacity={0.25}
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${8 / viewport.zoom} ${4 / viewport.zoom}`}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
