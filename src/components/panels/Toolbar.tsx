import { useMapStore } from '../../store/useMapStore';
import { serializeSave, downloadJson, uploadJson, deserializeSave } from '../../lib/io';
import { useReactFlow } from '@xyflow/react';

export default function Toolbar() {
  const addNode = useMapStore((s) => s.addNode);
  const config = useMapStore((s) => s.config);
  const setConfig = useMapStore((s) => s.setConfig);
  const getSaveData = useMapStore((s) => s.getSaveData);
  const loadSaveData = useMapStore((s) => s.loadSaveData);
  const { fitView, screenToFlowPosition } = useReactFlow();

  const handleAddNode = () => {
    // Place node in the center of the current viewport
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode({}, center);
  };

  const handleExport = () => {
    const save = getSaveData();
    const json = serializeSave(save);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(json, `systems-map-${date}.json`);
  };

  const handleImport = async () => {
    try {
      const json = await uploadJson();
      const save = deserializeSave(json);
      loadSaveData(save);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const toggleBlobs = () => {
    setConfig({ blobsEnabled: !config.blobsEnabled });
  };

  const toggleSnap = () => {
    setConfig({ snapToGrid: !config.snapToGrid });
  };

  const handleFitView = () => {
    fitView({ padding: 0.2 });
  };

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white rounded-lg shadow-md border border-gray-200 px-2 py-1.5">
      {/* Add Node */}
      <button
        onClick={handleAddNode}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        title="Add new node"
      >
        <span className="text-sm">+</span> Node
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* Blobs toggle */}
      <button
        onClick={toggleBlobs}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          config.blobsEnabled
            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Toggle category blobs"
      >
        ◎ Blobs
      </button>

      {/* Snap toggle */}
      <button
        onClick={toggleSnap}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          config.snapToGrid
            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Toggle snap to grid"
      >
        ⊞ Snap
      </button>

      {/* Fit view */}
      <button
        onClick={handleFitView}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Fit view to all nodes"
      >
        ⊡ Fit
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* Export */}
      <button
        onClick={handleExport}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Export as JSON"
      >
        ↓ Export
      </button>

      {/* Import */}
      <button
        onClick={handleImport}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Import from JSON"
      >
        ↑ Import
      </button>
    </div>
  );
}
