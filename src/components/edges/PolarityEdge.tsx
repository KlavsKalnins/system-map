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

/**
 * PolarityEdge — supports two rendering modes:
 *
 * 1. "classic" — orthogonal smooth-step paths (the original)
 * 2. "bezier"  — cubic bezier curves with:
 *      • Smart curvature that avoids clipping through source/target nodes
 *      • Draggable control-point offsets for fine-tuning (stored in edge data)
 *      • Reset button to clear manual offsets
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
  const updateEdgeData = useMapStore((s) => s.updateEdgeData);
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

  const SIBLING_SPREAD = 8; // px between sibling edges

  // Edges sharing the same source node+handle
  const sourceSiblings = edges.filter(
    (e) => e.source === source && e.sourceHandle === sourceHandleId,
  );
  const sourceIdx = sourceSiblings.findIndex((e) => e.id === id);
  const sourceFan = (sourceIdx - (sourceSiblings.length - 1) / 2) * SIBLING_SPREAD;

  // Edges sharing the same target node+handle
  const targetSiblings = edges.filter(
    (e) => e.target === target && e.targetHandle === targetHandleId,
  );
  const targetIdx = targetSiblings.findIndex((e) => e.id === id);
  const targetFan = (targetIdx - (targetSiblings.length - 1) / 2) * SIBLING_SPREAD;

  // Apply perpendicular offset based on handle side
  const isSourceHorizontal = sourcePosition === 'top' || sourcePosition === 'bottom';
  const adjustedSourceX = sourceX + (isSourceHorizontal ? sourceFan : 0);
  const adjustedSourceY = sourceY + (isSourceHorizontal ? 0 : sourceFan);

  const isTargetHorizontal = targetPosition === 'top' || targetPosition === 'bottom';
  const adjustedTargetX = targetX + (isTargetHorizontal ? targetFan : 0);
  const adjustedTargetY = targetY + (isTargetHorizontal ? 0 : targetFan);

  // ── Path computation ────────────────────────────────────────────────────

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (edgeStyle === 'bezier') {
    // curvature is a multiplier on the axis distance (React Flow default = 0.25)
    const curvature = 0.25;

    [edgePath, labelX, labelY] = getBezierPath({
      sourceX: adjustedSourceX,
      sourceY: adjustedSourceY,
      targetX: adjustedTargetX,
      targetY: adjustedTargetY,
      sourcePosition,
      targetPosition,
      curvature,
    });

    // If there are manual offsets, re-compute with adjusted control points
    if (controlOffsetX !== 0 || controlOffsetY !== 0) {
      // For the custom builder we need pixel-based offsets for control points.
      // Approximate what React Flow does: offset = curvature * axis-distance, min 50px
      const dx = Math.abs(adjustedTargetX - adjustedSourceX);
      const dy = Math.abs(adjustedTargetY - adjustedSourceY);
      const isHorizontal =
        sourcePosition === 'left' || sourcePosition === 'right';
      const cpOffset = Math.max(50, curvature * (isHorizontal ? dx : dy));

      edgePath = buildCustomBezierPath(
        adjustedSourceX, adjustedSourceY, adjustedTargetX, adjustedTargetY,
        sourcePosition, targetPosition,
        cpOffset, controlOffsetX, controlOffsetY,
      );
      // Shift label to follow the offset
      labelX += controlOffsetX * 0.5;
      labelY += controlOffsetY * 0.5;
    }
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: adjustedSourceX,
      sourceY: adjustedSourceY,
      targetX: adjustedTargetX,
      targetY: adjustedTargetY,
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
      <EdgeLabelRenderer>
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
