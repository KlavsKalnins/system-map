import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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

  const polarity = data?.polarity ?? '+';
  const isPositive = polarity === '+';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const togglePolarity = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateEdgeData(id, { polarity: isPositive ? '-' : '+' });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isPositive ? '#22c55e' : '#ef4444',
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-0.5"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <button
            className={`
              w-6 h-6 rounded-full text-xs font-bold text-white shadow-sm
              flex items-center justify-center cursor-pointer
              transition-colors hover:scale-110
              ${isPositive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            `}
            onClick={togglePolarity}
            title="Toggle polarity"
          >
            {polarity}
          </button>
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
