import { useState, useCallback, useEffect } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';

export default function NodeEditor() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const config = useMapStore((s) => s.config);
  const updateNodeData = useMapStore((s) => s.updateNodeData);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const setSelectedNodeId = useMapStore((s) => s.setSelectedNodeId);

  const node = nodes.find((n) => n.id === selectedNodeId);

  const [newIncrease, setNewIncrease] = useState('');
  const [newDecrease, setNewDecrease] = useState('');

  // Reset inputs when node changes
  useEffect(() => {
    setNewIncrease('');
    setNewDecrease('');
  }, [selectedNodeId]);

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

  const addIncrease = useCallback(() => {
    if (!node || !newIncrease.trim()) return;
    updateNodeData(node.id, { increases: [...node.data.increases, newIncrease.trim()] });
    setNewIncrease('');
  }, [node, newIncrease, updateNodeData]);

  const removeIncrease = useCallback(
    (index: number) => {
      if (!node) return;
      updateNodeData(node.id, {
        increases: node.data.increases.filter((_, i) => i !== index),
      });
    },
    [node, updateNodeData],
  );

  const addDecrease = useCallback(() => {
    if (!node || !newDecrease.trim()) return;
    updateNodeData(node.id, { decreases: [...node.data.decreases, newDecrease.trim()] });
    setNewDecrease('');
  }, [node, newDecrease, updateNodeData]);

  const removeDecrease = useCallback(
    (index: number) => {
      if (!node) return;
      updateNodeData(node.id, {
        decreases: node.data.decreases.filter((_, i) => i !== index),
      });
    },
    [node, updateNodeData],
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

        {/* Increases */}
        <div>
          <label className="block text-xs font-medium text-green-600 mb-1">▲ Increases</label>
          <div className="space-y-1 mb-2">
            {node.data.increases.map((item, i) => (
              <div key={i} className="flex items-center gap-1 group">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-xs text-gray-700 flex-1">{item}</span>
                <button
                  onClick={() => removeIncrease(i)}
                  className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newIncrease}
              onChange={(e) => setNewIncrease(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIncrease()}
              placeholder="Add increase..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400"
            />
            <button
              onClick={addIncrease}
              className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100"
            >
              +
            </button>
          </div>
        </div>

        {/* Decreases */}
        <div>
          <label className="block text-xs font-medium text-red-500 mb-1">▼ Decreases</label>
          <div className="space-y-1 mb-2">
            {node.data.decreases.map((item, i) => (
              <div key={i} className="flex items-center gap-1 group">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-xs text-gray-700 flex-1">{item}</span>
                <button
                  onClick={() => removeDecrease(i)}
                  className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newDecrease}
              onChange={(e) => setNewDecrease(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDecrease()}
              placeholder="Add decrease..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <button
              onClick={addDecrease}
              className="px-2 py-1 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100"
            >
              +
            </button>
          </div>
        </div>

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
