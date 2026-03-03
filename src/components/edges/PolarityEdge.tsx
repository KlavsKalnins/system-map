import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { SystemEdgeData } from '../../types';
import { useMapStore } from '../../store/useMapStore';

export default function PolarityEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data?: SystemEdgeData }) {
  const updateEdgeData = useMapStore((s) => s.updateEdgeData);
  const deleteEdge = useMapStore((s) => s.deleteEdge);
  const reverseEdge = useMapStore((s) => s.reverseEdge);

  const polarity = data?.polarity ?? '+';
  const isPositive = polarity === '+';
  const color = isPositive ? '#22c55e' : '#ef4444';

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

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

  // Unique marker id per edge+polarity so colors update correctly
  const markerId = `arrow-${id}-${polarity}`;

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
          <polygon
            points="0 0, 12 6, 0 12"
            fill={color}
          />
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
