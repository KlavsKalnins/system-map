import { useState, useCallback } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { v4 as uuid } from 'uuid';

interface ConfigPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ConfigPanel({ open, onClose }: ConfigPanelProps) {
  const config = useMapStore((s) => s.config);
  const setConfig = useMapStore((s) => s.setConfig);

  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  const addCategory = useCallback(() => {
    if (!newCatLabel.trim()) return;
    const id = `cat-${uuid().slice(0, 8)}`;
    setConfig({
      categories: [...config.categories, { id, label: newCatLabel.trim(), color: newCatColor }],
    });
    setNewCatLabel('');
  }, [newCatLabel, newCatColor, config.categories, setConfig]);

  const removeCategory = useCallback(
    (id: string) => {
      setConfig({ categories: config.categories.filter((c) => c.id !== id) });
    },
    [config.categories, setConfig],
  );

  const updateCategoryColor = useCallback(
    (id: string, color: string) => {
      setConfig({
        categories: config.categories.map((c) =>
          c.id === id ? { ...c, color } : c,
        ),
      });
    },
    [config.categories, setConfig],
  );

  if (!open) return null;

  return (
    <div className="absolute top-14 left-3 z-20 w-64 bg-white rounded-lg shadow-md border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-700">Settings</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Grid size */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Grid Size: {config.gridSize}px</label>
        <input
          type="range"
          min={10}
          max={50}
          value={config.gridSize}
          onChange={(e) => setConfig({ gridSize: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Edge style */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Edge Style</label>
        <div className="flex gap-1 mt-1">
          {(['classic', 'bezier'] as const).map((style) => (
            <button
              key={style}
              onClick={() => setConfig({ edgeStyle: style })}
              className={`flex-1 px-2 py-1 text-xs rounded border transition-colors capitalize ${
                config.edgeStyle === style
                  ? 'bg-indigo-100 border-indigo-400 text-indigo-700 font-semibold'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Blob padding */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Blob Padding: {config.blobPadding ?? 40}px</label>
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={config.blobPadding ?? 40}
          onChange={(e) => setConfig({ blobPadding: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Categories */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Categories</label>
        <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
          {config.categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5 group">
              <input
                type="color"
                value={cat.color}
                onChange={(e) => updateCategoryColor(cat.id, e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-xs text-gray-700 flex-1">{cat.label}</span>
              <button
                onClick={() => removeCategory(cat.id)}
                className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 p-0"
          />
          <input
            type="text"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="Category name..."
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={addCategory}
            className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
