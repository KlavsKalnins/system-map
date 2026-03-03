import { useCallback, useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';

export default function NodeEditor() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const config = useMapStore((s) => s.config);
  const updateNodeData = useMapStore((s) => s.updateNodeData);
  const updateEdgeData = useMapStore((s) => s.updateEdgeData);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const deleteEdge = useMapStore((s) => s.deleteEdge);
  const setSelectedNodeId = useMapStore((s) => s.setSelectedNodeId);

  const node = nodes.find((n) => n.id === selectedNodeId);

  // Derive connections from edges
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

  if (!node) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col items-center justify-center text-gray-400 text-sm p-6">
        <div className="text-3xl mb-2">◇</div>
        <p>Select a node to edit</p>
        <p className="text-xs mt-1">or click "+ Node" to create one</p>
      </div>
    );
  }

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
