import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SystemNodeData } from '../../types';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';

function SystemNodeCard({ id, data, selected }: NodeProps & { data: SystemNodeData }) {
  const config = useMapStore((s) => s.config);
  const setSelectedNodeId = useMapStore((s) => s.setSelectedNodeId);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const duplicateNode = useMapStore((s) => s.duplicateNode);

  const categoryColor = getCategoryColor(config.categories, data.category);
  const categoryLabel = config.categories.find((c) => c.id === data.category)?.label ?? 'Uncategorized';

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Simple: just select on right click; context menu could be added later
      setSelectedNodeId(id);
    },
    [id, setSelectedNodeId],
  );

  return (
    <div
      className={`
        relative min-w-[180px] max-w-[260px] rounded-lg bg-white shadow-md border-2 
        transition-shadow hover:shadow-lg
        ${selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
      `}
      style={{ borderColor: categoryColor }}
      onContextMenu={handleContextMenu}
    >
      {/* Category bar */}
      <div
        className="rounded-t-md px-3 py-1 text-xs font-medium text-white flex items-center justify-between"
        style={{ backgroundColor: categoryColor }}
      >
        <span>{categoryLabel}</span>
        <div className="flex gap-1 ml-2">
          <button
            className="hover:bg-white/30 rounded px-1 text-[10px]"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicateNode(id);
            }}
          >
            ⧉
          </button>
          <button
            className="hover:bg-white/30 rounded px-1 text-[10px]"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-3 py-2 font-semibold text-sm text-gray-800 border-b border-gray-100">
        {data.title}
      </div>

      {/* Increases */}
      {data.increases.length > 0 && (
        <div className="px-3 pt-1.5">
          <div className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-0.5">
            ▲ Increases
          </div>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {data.increases.map((item, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decreases */}
      {data.decreases.length > 0 && (
        <div className="px-3 pt-1.5 pb-2">
          <div className="text-[10px] font-medium text-red-500 uppercase tracking-wide mb-0.5">
            ▼ Decreases
          </div>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {data.decreases.map((item, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.increases.length === 0 && data.decreases.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400 italic">No effects listed</div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />
    </div>
  );
}

export default memo(SystemNodeCard);
