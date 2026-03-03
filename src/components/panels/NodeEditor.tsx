import { useCallback, useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';

/** Helper: select a single edge by dispatching edge changes via the store. */
function selectEdge(edgeId: string) {
  const { edges, onEdgesChange } = useMapStore.getState();
  const changes: Array<{ id: string; type: 'select'; selected: boolean }> = [];
  for (const e of edges) {
    if (e.id === edgeId && !e.selected) changes.push({ id: e.id, type: 'select', selected: true });
    if (e.id !== edgeId && e.selected) changes.push({ id: e.id, type: 'select', selected: false });
  }
  if (changes.length) onEdgesChange(changes);
}

export default function NodeEditor() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const config = useMapStore((s) => s.config);
  const updateNodeData = useMapStore((s) => s.updateNodeData);
  const updateEdgeData = useMapStore((s) => s.updateEdgeData);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const deleteEdge = useMapStore((s) => s.deleteEdge);
  const reverseEdge = useMapStore((s) => s.reverseEdge);
  const setSelectedNodeId = useMapStore((s) => s.setSelectedNodeId);

  const node = nodes.find((n) => n.id === selectedNodeId);

  // Currently selected edge (when no node is selected)
  const selectedEdge = useMemo(
    () => (!node ? edges.find((e) => e.selected) ?? null : null),
    [node, edges],
  );

  // Neighboring edges — share a source or target node with the selected edge
  const neighborEdges = useMemo(() => {
    if (!selectedEdge) return [];
    return edges.filter(
      (e) =>
        e.id !== selectedEdge.id &&
        (e.source === selectedEdge.source ||
          e.target === selectedEdge.target ||
          e.source === selectedEdge.target ||
          e.target === selectedEdge.source),
    );
  }, [selectedEdge, edges]);

  // Derive connections from edges (for node editing)
  const connections = useMemo(() => {
    if (!node) return { incoming: [], outgoing: [] };
    const incoming = edges
      .filter((e) => e.target === node.id)
      .map((e) => {
        const source = nodes.find((n) => n.id === e.source);
        return {
          edgeId: e.id,
          nodeId: e.source,
          label: source?.data?.title ?? '?',
          polarity: (e.data?.polarity as '+' | '-') ?? '+',
        };
      });
    const outgoing = edges
      .filter((e) => e.source === node.id)
      .map((e) => {
        const target = nodes.find((n) => n.id === e.target);
        return {
          edgeId: e.id,
          nodeId: e.target,
          label: target?.data?.title ?? '?',
          polarity: (e.data?.polarity as '+' | '-') ?? '+',
        };
      });
    return { incoming, outgoing };
  }, [node, edges, nodes]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (node) updateNodeData(node.id, { title: e.target.value });
    },
    [node, updateNodeData],
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (node) updateNodeData(node.id, { category: e.target.value });
    },
    [node, updateNodeData],
  );

  const togglePolarity = useCallback(
    (edgeId: string, current: '+' | '-') => {
      updateEdgeData(edgeId, { polarity: current === '+' ? '-' : '+' });
    },
    [updateEdgeData],
  );

  // ── Edge selected (no node selected) — show edge editor ────────────────

  if (!node && selectedEdge) {
    const srcNode = nodes.find((n) => n.id === selectedEdge.source);
    const tgtNode = nodes.find((n) => n.id === selectedEdge.target);
    const srcLabel = srcNode?.data?.title ?? '?';
    const tgtLabel = tgtNode?.data?.title ?? '?';
    const pol = (selectedEdge.data?.polarity as '+' | '-') ?? '+';
    const isPos = pol === '+';

    return (
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between text-white text-sm font-medium shrink-0"
          style={{ backgroundColor: isPos ? '#22c55e' : '#ef4444' }}
        >
          <span>Edit Edge</span>
          <button
            onClick={() => {
              // Deselect edge
              const { edges: all, onEdgesChange: d } = useMapStore.getState();
              d(all.filter((e) => e.selected).map((e) => ({ id: e.id, type: 'select' as const, selected: false })));
            }}
            className="hover:bg-white/20 rounded px-1.5 py-0.5 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Fixed controls section */}
        <div className="p-4 space-y-4 shrink-0">
          {/* Connection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Connection</label>
            <div className="flex items-center gap-1.5 text-sm text-gray-800">
              <span className="truncate flex-1">{srcLabel}</span>
              <span className="text-gray-400">→</span>
              <span className="truncate flex-1 text-right">{tgtLabel}</span>
            </div>
          </div>

          {/* Polarity + Reverse + Delete */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePolarity(selectedEdge.id, pol)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold text-white transition-colors ${
                isPos ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isPos ? '+ Positive' : '− Negative'}
            </button>
            <button
              onClick={() => reverseEdge(selectedEdge.id)}
              className="py-1.5 px-3 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              title="Reverse direction"
            >
              ⇄
            </button>
            <button
              onClick={() => deleteEdge(selectedEdge.id)}
              className="py-1.5 px-3 rounded-md text-xs font-medium bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
              title="Delete edge"
            >
              ✕
            </button>
          </div>

          {/* Go to Source / Target nodes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nodes</label>
            <div className="space-y-1">
              {srcNode && (
                <button
                  onClick={() => setSelectedNodeId(srcNode.id)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors truncate"
                >
                  <span className="text-gray-400 mr-1">Source:</span> {srcLabel}
                </button>
              )}
              {tgtNode && (
                <button
                  onClick={() => setSelectedNodeId(tgtNode.id)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors truncate"
                >
                  <span className="text-gray-400 mr-1">Target:</span> {tgtLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Nearby edges — fills remaining space and scrolls independently */}
        <div className="flex flex-col min-h-0 flex-1 px-4 pb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1 shrink-0">
            Nearby Edges ({neighborEdges.length})
          </label>
          {neighborEdges.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No neighboring edges</p>
          ) : (
            <div className="space-y-1 overflow-y-auto min-h-0 flex-1">
              {neighborEdges.map((ne) => {
                const s = nodes.find((n) => n.id === ne.source);
                const t = nodes.find((n) => n.id === ne.target);
                const sL = s?.data?.title ?? '?';
                const tL = t?.data?.title ?? '?';
                const p = (ne.data?.polarity as '+' | '-') ?? '+';
                return (
                  <button
                    key={ne.id}
                    onClick={() => selectEdge(ne.id)}
                    className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-400 transition-colors group"
                  >
                    <span
                      className={`w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 ${
                        p === '+' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {p}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">
                      {sL} → {tL}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No selection — empty state ──────────────────────────────────────────

  if (!node) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col items-center justify-center text-gray-400 text-sm p-6">
        <div className="text-3xl mb-2">◇</div>
        <p>Select a node or edge to edit</p>
        <p className="text-xs mt-1">or click "+ Node" to create one</p>
      </div>
    );
  }

  // ── Node selected — show node editor ────────────────────────────────────

  const categoryColor = getCategoryColor(config.categories, node.data.category);

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between text-white text-sm font-medium"
        style={{ backgroundColor: categoryColor }}
      >
        <span>Edit Node</span>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="hover:bg-white/20 rounded px-1.5 py-0.5 text-xs"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
          <input
            type="text"
            value={node.data.title}
            onChange={handleTitleChange}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={node.data.category}
            onChange={handleCategoryChange}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          >
            {config.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Incoming connections */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Affected by ({connections.incoming.length})
          </label>
          {connections.incoming.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No incoming connections</p>
          ) : (
            <div className="space-y-1">
              {connections.incoming.map((c) => (
                <div key={c.edgeId} className="flex items-center gap-1.5 group">
                  <button
                    onClick={() => togglePolarity(c.edgeId, c.polarity)}
                    className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      c.polarity === '+' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                    }`}
                    title="Toggle polarity"
                  >
                    {c.polarity}
                  </button>
                  <span className="text-xs text-gray-700 flex-1 truncate">{c.label}</span>
                  <span className="text-gray-300 text-xs">→ this</span>
                  <button
                    onClick={() => deleteEdge(c.edgeId)}
                    className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove connection"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing connections */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Affects ({connections.outgoing.length})
          </label>
          {connections.outgoing.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No outgoing connections</p>
          ) : (
            <div className="space-y-1">
              {connections.outgoing.map((c) => (
                <div key={c.edgeId} className="flex items-center gap-1.5 group">
                  <span className="text-gray-300 text-xs">this →</span>
                  <button
                    onClick={() => togglePolarity(c.edgeId, c.polarity)}
                    className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      c.polarity === '+' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                    }`}
                    title="Toggle polarity"
                  >
                    {c.polarity}
                  </button>
                  <span className="text-xs text-gray-700 flex-1 truncate">{c.label}</span>
                  <button
                    onClick={() => deleteEdge(c.edgeId)}
                    className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove connection"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          Drag from handle ● to handle ● to create connections
        </p>

        {/* Delete */}
        <button
          onClick={() => deleteNode(node.id)}
          className="w-full py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
