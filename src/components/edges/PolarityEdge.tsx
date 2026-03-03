import { useCallback, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import type { SystemEdgeData } from '../../types';
import { useMapStore } from '../../store/useMapStore';

/** Minimum hold time (ms) before drag-reconnect activates. Short clicks cycle selection. */
const HOLD_THRESHOLD_MS = 300;

/** Perpendicular offset (px) between sibling edges sharing the same handle. */
const SIBLING_SPREAD = 8;

/** Shortest distance from point (px,py) to segment (ax,ay)-(bx,by). */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * PolarityEdge — supports two rendering modes:
 *
 * 1. "classic" — orthogonal smooth-step paths (the original)
 * 2. "bezier"  — cubic bezier curves with:
 *      • Smart curvature that avoids clipping through source/target nodes
 *      • Draggable control-point offsets for fine-tuning (stored in edge data)
 *      • Reset button to clear manual offsets
 *
 * Also supports drag-from-anywhere reconnection (hold 300ms, then drag).
 * Short click on edge path cycles selection through overlapping edges.
 */
export default function PolarityEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
  selected,
}: EdgeProps & { data?: SystemEdgeData }) {
  const edgeStyle = useMapStore((s) => s.config.edgeStyle);
  const edges = useMapStore((s) => s.edges);
  const nodes = useMapStore((s) => s.nodes);
  const updateEdgeData = useMapStore((s) => s.updateEdgeData);
  const updateEdgeEndpoint = useMapStore((s) => s.updateEdgeEndpoint);
  const deleteEdge = useMapStore((s) => s.deleteEdge);
  const reverseEdge = useMapStore((s) => s.reverseEdge);
  const { screenToFlowPosition } = useReactFlow();

  const polarity = data?.polarity ?? '+';
  const isPositive = polarity === '+';
  const color = isPositive ? '#22c55e' : '#ef4444';

  // Control offsets for bezier fine-tuning
  const controlOffsetX = (data?.controlOffsetX as number) ?? 0;
  const controlOffsetY = (data?.controlOffsetY as number) ?? 0;

  // ── Sibling offset: fan out edges sharing the same handle ───────────────

  const sourceSiblings = edges.filter(
    (e) => e.source === source && e.sourceHandle === sourceHandleId,
  );
  const sourceIdx = sourceSiblings.findIndex((e) => e.id === id);
  const sourceFan = sourceSiblings.length > 1
    ? (sourceIdx - (sourceSiblings.length - 1) / 2) * SIBLING_SPREAD
    : 0;

  const targetSiblings = edges.filter(
    (e) => e.target === target && e.targetHandle === targetHandleId,
  );
  const targetIdx = targetSiblings.findIndex((e) => e.id === id);
  const targetFan = targetSiblings.length > 1
    ? (targetIdx - (targetSiblings.length - 1) / 2) * SIBLING_SPREAD
    : 0;

  const isSourceHorizontal = sourcePosition === 'top' || sourcePosition === 'bottom';
  const adjSrcX = sourceX + (isSourceHorizontal ? sourceFan : 0);
  const adjSrcY = sourceY + (isSourceHorizontal ? 0 : sourceFan);

  const isTargetHorizontal = targetPosition === 'top' || targetPosition === 'bottom';
  const adjTgtX = targetX + (isTargetHorizontal ? targetFan : 0);
  const adjTgtY = targetY + (isTargetHorizontal ? 0 : targetFan);

  // ── Node titles for tooltip ─────────────────────────────────────────────

  const sourceTitle = nodes.find((n) => n.id === source)?.data?.title ?? source;
  const targetTitle = nodes.find((n) => n.id === target)?.data?.title ?? target;

  // ── Path computation ────────────────────────────────────────────────────

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (edgeStyle === 'bezier') {
    const curvature = 0.25;

    [edgePath, labelX, labelY] = getBezierPath({
      sourceX: adjSrcX,
      sourceY: adjSrcY,
      targetX: adjTgtX,
      targetY: adjTgtY,
      sourcePosition,
      targetPosition,
      curvature,
    });

    if (controlOffsetX !== 0 || controlOffsetY !== 0) {
      const dx = Math.abs(adjTgtX - adjSrcX);
      const dy = Math.abs(adjTgtY - adjSrcY);
      const isHorizontal =
        sourcePosition === 'left' || sourcePosition === 'right';
      const cpOffset = Math.max(50, curvature * (isHorizontal ? dx : dy));

      edgePath = buildCustomBezierPath(
        adjSrcX, adjSrcY, adjTgtX, adjTgtY,
        sourcePosition, targetPosition,
        cpOffset, controlOffsetX, controlOffsetY,
      );
      labelX += controlOffsetX * 0.5;
      labelY += controlOffsetY * 0.5;
    }
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: adjSrcX,
      sourceY: adjSrcY,
      targetX: adjTgtX,
      targetY: adjTgtY,
      sourcePosition,
      targetPosition,
      borderRadius: 16,
    });
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  const togglePolarity = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateEdgeData(id, { polarity: isPositive ? '-' : '+' });
  };

  const handleReverse = (e: React.MouseEvent) => {
    e.stopPropagation();
    reverseEdge(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  const handleResetControl = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateEdgeData(id, { controlOffsetX: 0, controlOffsetY: 0 });
  };

  // ── Drag control point ──────────────────────────────────────────────────

  const dragStartRef = useRef<{
    startFlowX: number;
    startFlowY: number;
    origOX: number;
    origOY: number;
  } | null>(null);

  const onControlPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      dragStartRef.current = {
        startFlowX: flowPos.x,
        startFlowY: flowPos.y,
        origOX: controlOffsetX,
        origOY: controlOffsetY,
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return;
        const currentFlow = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const dxFlow = currentFlow.x - dragStartRef.current.startFlowX;
        const dyFlow = currentFlow.y - dragStartRef.current.startFlowY;
        updateEdgeData(id, {
          controlOffsetX: dragStartRef.current.origOX + dxFlow,
          controlOffsetY: dragStartRef.current.origOY + dyFlow,
        });
      };

      const onPointerUp = () => {
        dragStartRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [id, controlOffsetX, controlOffsetY, screenToFlowPosition, updateEdgeData],
  );

  // ── Drag-from-edge reconnect (hold 300ms) + click-to-cycle ────────────────

  const dragLineRef = useRef<SVGLineElement>(null);
  const reconnectInfoRef = useRef<{
    end: 'source' | 'target';
    fixedX: number;
    fixedY: number;
  } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const onEdgePathPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      isDraggingRef.current = false;
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const distS = Math.hypot(flowPos.x - sourceX, flowPos.y - sourceY);
      const distT = Math.hypot(flowPos.x - targetX, flowPos.y - targetY);
      const movingEnd = distS < distT ? 'source' : 'target';
      const fixedX = movingEnd === 'source' ? targetX : sourceX;
      const fixedY = movingEnd === 'source' ? targetY : sourceY;

      reconnectInfoRef.current = { end: movingEnd, fixedX, fixedY };

      // Start drag-reconnect only after holding for HOLD_THRESHOLD_MS
      const startDrag = () => {
        isDraggingRef.current = true;
        if (dragLineRef.current) {
          dragLineRef.current.style.display = '';
          dragLineRef.current.setAttribute('x1', String(fixedX));
          dragLineRef.current.setAttribute('y1', String(fixedY));
          const pos = screenToFlowPosition({ x: startClientX, y: startClientY });
          dragLineRef.current.setAttribute('x2', String(pos.x));
          dragLineRef.current.setAttribute('y2', String(pos.y));
        }
      };

      holdTimerRef.current = setTimeout(startDrag, HOLD_THRESHOLD_MS);

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const pos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        if (dragLineRef.current) {
          dragLineRef.current.setAttribute('x2', String(pos.x));
          dragLineRef.current.setAttribute('y2', String(pos.y));
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        if (dragLineRef.current) dragLineRef.current.style.display = 'none';

        if (!isDraggingRef.current) {
          // Short click — cycle selection through overlapping edges near click point
          isDraggingRef.current = false;
          reconnectInfoRef.current = null;

          const clickFlow = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
          const { edges: allEdges, nodes: allNodes, onEdgesChange: dispatch } = useMapStore.getState();

          // Build a set of edges whose path passes near the click point
          const HIT_DISTANCE = 40; // flow-space px
          const nearbyEdges = allEdges.filter((edge) => {
            const sNode = allNodes.find((n) => n.id === edge.source);
            const tNode = allNodes.find((n) => n.id === edge.target);
            if (!sNode || !tNode) return false;
            const sw = sNode.measured?.width ?? 180;
            const sh = sNode.measured?.height ?? 100;
            const tw = tNode.measured?.width ?? 180;
            const th = tNode.measured?.height ?? 100;
            const sx = sNode.position.x + sw / 2;
            const sy = sNode.position.y + sh / 2;
            const tx = tNode.position.x + tw / 2;
            const ty = tNode.position.y + th / 2;
            return pointToSegmentDist(clickFlow.x, clickFlow.y, sx, sy, tx, ty) < HIT_DISTANCE;
          });

          if (nearbyEdges.length === 0) return;

          // Find currently selected edge in the nearby set
          const selectedIdx = nearbyEdges.findIndex((e) => e.selected);
          // Cycle: if something is selected, go to next; otherwise select first
          const nextIdx = selectedIdx >= 0 ? (selectedIdx + 1) % nearbyEdges.length : 0;
          const selectId = nearbyEdges[nextIdx].id;

          setTimeout(() => {
            const freshEdges = useMapStore.getState().edges;
            const { onEdgesChange: d } = useMapStore.getState();
            const changes: Array<{ id: string; type: 'select'; selected: boolean }> = [];
            for (const edge of freshEdges) {
              if (edge.selected && edge.id !== selectId) {
                changes.push({ id: edge.id, type: 'select', selected: false });
              }
              if (!edge.selected && edge.id === selectId) {
                changes.push({ id: edge.id, type: 'select', selected: true });
              }
            }
            if (changes.length > 0) d(changes);
          }, 0);
          return;
        }

        // Drag completed — perform reconnect
        isDraggingRef.current = false;
        const dropPos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const info = reconnectInfoRef.current;
        reconnectInfoRef.current = null;
        if (!info) return;

        const currentNodes = useMapStore.getState().nodes;
        const fixedNodeId = info.end === 'source' ? target : source;

        // Find nearest node to drop point (must be within max distance)
        const MAX_DROP_DISTANCE = 200; // flow-space px — ignore far-away nodes
        let bestNode: typeof currentNodes[0] | null = null;
        let bestDist = Infinity;
        for (const n of currentNodes) {
          const w = (n.measured?.width ?? 180);
          const h = (n.measured?.height ?? 100);
          const cx = n.position.x + w / 2;
          const cy = n.position.y + h / 2;
          const d = Math.hypot(cx - dropPos.x, cy - dropPos.y);
          if (d < bestDist) {
            bestDist = d;
            bestNode = n;
          }
        }

        if (!bestNode || bestDist > MAX_DROP_DISTANCE) return;

        const fixedNode = currentNodes.find((n) => n.id === fixedNodeId);
        if (!fixedNode) return;

        const fw = fixedNode.measured?.width ?? 180;
        const fh = fixedNode.measured?.height ?? 100;
        const fcx = fixedNode.position.x + fw / 2;
        const fcy = fixedNode.position.y + fh / 2;
        const nw = bestNode.measured?.width ?? 180;
        const nh = bestNode.measured?.height ?? 100;
        const ncx = bestNode.position.x + nw / 2;
        const ncy = bestNode.position.y + nh / 2;

        let srcCx: number, srcCy: number, tgtCx: number, tgtCy: number;
        if (info.end === 'source') {
          srcCx = ncx; srcCy = ncy;
          tgtCx = fcx; tgtCy = fcy;
        } else {
          srcCx = fcx; srcCy = fcy;
          tgtCx = ncx; tgtCy = ncy;
        }

        const ddx = tgtCx - srcCx;
        const ddy = tgtCy - srcCy;
        let sHandle: string;
        let tHandle: string;
        if (Math.abs(ddx) > Math.abs(ddy)) {
          sHandle = ddx > 0 ? 's-right' : 's-left';
          tHandle = ddx > 0 ? 't-left' : 't-right';
        } else {
          sHandle = ddy > 0 ? 's-bottom' : 's-top';
          tHandle = ddy > 0 ? 't-top' : 't-bottom';
        }

        if (info.end === 'source') {
          updateEdgeEndpoint(id, {
            source: bestNode.id,
            sourceHandle: sHandle,
            targetHandle: tHandle,
          });
        } else {
          updateEdgeEndpoint(id, {
            target: bestNode.id,
            sourceHandle: sHandle,
            targetHandle: tHandle,
          });
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    },
    [id, source, target, sourceX, sourceY, targetX, targetY, screenToFlowPosition, updateEdgeEndpoint],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const markerId = `arrow-${id}-${polarity}`;
  const hasManualOffset = controlOffsetX !== 0 || controlOffsetY !== 0;
  const isBezier = edgeStyle === 'bezier';

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 12 6, 0 12" fill={color} />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
        markerEnd={`url(#${markerId})`}
      />
      {/* Invisible wide hit area for drag-to-reconnect */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: 'grab', pointerEvents: 'stroke' }}
        onPointerDown={onEdgePathPointerDown}
      />
      {/* Drag preview line */}
      <line
        ref={dragLineRef}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="6 3"
        style={{ display: 'none', pointerEvents: 'none' }}
      />
      <EdgeLabelRenderer>
        {/* Selection tooltip — shows source → target */}
        {selected && (
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -170%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <div className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded shadow-md whitespace-nowrap">
              {sourceTitle} → {targetTitle}
            </div>
          </div>
        )}
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {/* Draggable control point indicator (bezier mode + selected) */}
          {isBezier && selected && (
            <div
              className="w-5 h-5 rounded-full border-2 border-blue-400 bg-blue-50 cursor-grab active:cursor-grabbing shadow-sm flex items-center justify-center"
              title="Drag to adjust curve"
              onPointerDown={onControlPointerDown}
              style={{ touchAction: 'none' }}
            >
              <span className="text-[9px] text-blue-500 font-bold">◆</span>
            </div>
          )}

          {/* Reverse direction */}
          <button
            className="w-6 h-6 rounded-full bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 text-xs font-bold shadow-sm flex items-center justify-center cursor-pointer transition-colors hover:scale-110"
            onClick={handleReverse}
            title="Reverse direction"
          >
            ⇄
          </button>
          {/* Toggle polarity */}
          <button
            className={`
              w-6 h-6 rounded-full text-xs font-bold text-white shadow-sm
              flex items-center justify-center cursor-pointer
              transition-colors hover:scale-110
              ${isPositive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            `}
            onClick={togglePolarity}
            title={isPositive ? 'Positively affects (click to toggle)' : 'Negatively affects (click to toggle)'}
          >
            {polarity}
          </button>
          {/* Reset control point (bezier + has offset) */}
          {isBezier && hasManualOffset && (
            <button
              className="w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 text-[10px] flex items-center justify-center cursor-pointer shadow-sm"
              onClick={handleResetControl}
              title="Reset curve to default"
            >
              ↺
            </button>
          )}
          {/* Delete */}
          {selected && (
            <button
              className="w-5 h-5 rounded-full bg-gray-400 hover:bg-gray-600 text-white text-[10px] flex items-center justify-center cursor-pointer"
              onClick={handleDelete}
              title="Delete edge"
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ─── Custom bezier path with manual control point offsets ───────────────────

function buildCustomBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: string,
  targetPosition: string,
  curvature: number,
  offsetX: number,
  offsetY: number,
): string {
  const [scx, scy] = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
  const [tcx, tcy] = getControlPoint(targetX, targetY, targetPosition, curvature);

  // Apply manual offsets — weighted so the curve shifts smoothly
  const cx1 = scx + offsetX * 0.6;
  const cy1 = scy + offsetY * 0.6;
  const cx2 = tcx + offsetX * 0.4;
  const cy2 = tcy + offsetY * 0.4;

  return `M${sourceX},${sourceY} C${cx1},${cy1} ${cx2},${cy2} ${targetX},${targetY}`;
}

function getControlPoint(
  x: number,
  y: number,
  position: string,
  offset: number,
): [number, number] {
  switch (position) {
    case 'top':
      return [x, y - offset];
    case 'bottom':
      return [x, y + offset];
    case 'left':
      return [x - offset, y];
    case 'right':
      return [x + offset, y];
    default:
      return [x, y + offset];
  }
}
