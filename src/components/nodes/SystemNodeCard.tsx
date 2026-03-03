import { memo, useCallback, useMemo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SystemNodeData } from '../../types';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';

function SystemNodeCard({ id, data, selected }: NodeProps & { data: SystemNodeData }) {
  const config = useMapStore((s) => s.config);
  const edges = useMapStore((s) => s.edges);
  const nodes = useMapStore((s) => s.nodes);
  const setSelectedNodeId = useMapStore((s) => s.setSelectedNodeId);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const duplicateNode = useMapStore((s) => s.duplicateNode);

  const categoryColor = getCategoryColor(config.categories, data.category);
  const categoryLabel = config.categories.find((c) => c.id === data.category)?.label ?? 'Uncategorized';

  // Derive connections from edges
  const connections = useMemo(() => {
    const outgoing = edges
      .filter((e) => e.source === id)
      .map((e) => {
        const target = nodes.find((n) => n.id === e.target);
        return {
          id: e.id,
          label: target?.data?.title ?? '?',
          polarity: (e.data?.polarity as '+' | '-') ?? '+',
          direction: 'out' as const,
        };
      });
    const incoming = edges
      .filter((e) => e.target === id)
      .map((e) => {
        const source = nodes.find((n) => n.id === e.source);
        return {
          id: e.id,
          label: source?.data?.title ?? '?',
          polarity: (e.data?.polarity as '+' | '-') ?? '+',
          direction: 'in' as const,
        };
      });
    return { outgoing, incoming };
  }, [edges, nodes, id]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setSelectedNodeId(id);
    },
    [id, setSelectedNodeId],
  );

  const hasConnections = connections.outgoing.length > 0 || connections.incoming.length > 0;
  const totalConnections = connections.incoming.length + connections.outgoing.length;
  const COLLAPSE_THRESHOLD = 5;
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const isCollapsed = manualToggle !== null ? manualToggle : totalConnections >= COLLAPSE_THRESHOLD;

  // Polarity summary helper
  const polaritySummary = (items: { polarity: '+' | '-' }[]) => {
    const pos = items.filter((c) => c.polarity === '+').length;
    const neg = items.filter((c) => c.polarity === '-').length;
    const parts: string[] = [];
    if (pos > 0) parts.push(`+${pos}`);
    if (neg > 0) parts.push(`−${neg}`);
    return parts.join(' / ');
  };

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

      {/* Connections section */}
      {hasConnections && isCollapsed ? (
        /* ── Collapsed summary ── */
        <div className="px-3 py-1.5">
          {connections.incoming.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="text-[10px] font-medium text-gray-400 uppercase">Affected by</span>
              <span className="font-semibold">{connections.incoming.length}</span>
              <span className="text-[10px] text-gray-400">({polaritySummary(connections.incoming)})</span>
            </div>
          )}
          {connections.outgoing.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5">
              <span className="text-[10px] font-medium text-gray-400 uppercase">Affects</span>
              <span className="font-semibold">{connections.outgoing.length}</span>
              <span className="text-[10px] text-gray-400">({polaritySummary(connections.outgoing)})</span>
            </div>
          )}
          <button
            className="mt-1 w-full text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center justify-center gap-0.5 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setManualToggle(false); }}
          >
            <span>▼</span> Show {totalConnections} connections
          </button>
        </div>
      ) : hasConnections ? (
        /* ── Expanded lists ── */
        <div>
          {/* Incoming connections (what affects this node) */}
          {connections.incoming.length > 0 && (
            <div className="px-3 pt-1.5">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                Affected by
              </div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {connections.incoming.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <span
                      className={`text-[10px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shrink-0 ${
                        c.polarity === '+' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {c.polarity}
                    </span>
                    <span className="truncate">{c.label}</span>
                    <span className="text-gray-300">→</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outgoing connections (what this node affects) */}
          {connections.outgoing.length > 0 && (
            <div className="px-3 pt-1.5 pb-1">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                Affects
              </div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {connections.outgoing.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <span className="text-gray-300">→</span>
                    <span
                      className={`text-[10px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shrink-0 ${
                        c.polarity === '+' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {c.polarity}
                    </span>
                    <span className="truncate">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Collapse button — only show when above threshold or user manually expanded */}
          {totalConnections >= COLLAPSE_THRESHOLD && (
            <button
              className="w-full text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center justify-center gap-0.5 py-1 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setManualToggle(true); }}
            >
              <span>▲</span> Collapse
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 text-xs text-gray-400 italic">No connections yet</div>
      )}

      {/* Source handles — visible dots on all 4 sides */}
      <Handle
        type="source"
        id="s-top"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />
      <Handle
        type="source"
        id="s-bottom"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />
      <Handle
        type="source"
        id="s-left"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />
      <Handle
        type="source"
        id="s-right"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !border-white"
        style={{ backgroundColor: categoryColor }}
      />

      {/* Target handles — same positions, invisible but used by React Flow for incoming edges */}
      <Handle
        type="target"
        id="t-top"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !rounded-full !border-0"
        style={{ backgroundColor: 'transparent', pointerEvents: 'none' }}
      />
      <Handle
        type="target"
        id="t-bottom"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !rounded-full !border-0"
        style={{ backgroundColor: 'transparent', pointerEvents: 'none' }}
      />
      <Handle
        type="target"
        id="t-left"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !border-0"
        style={{ backgroundColor: 'transparent', pointerEvents: 'none' }}
      />
      <Handle
        type="target"
        id="t-right"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !border-0"
        style={{ backgroundColor: 'transparent', pointerEvents: 'none' }}
      />

      {/* Backward-compat: hidden handles with no ID for old edges that have null sourceHandle/targetHandle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

export default memo(SystemNodeCard);
