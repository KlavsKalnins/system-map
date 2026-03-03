import { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import ConfigPanel from './ConfigPanel';
import { serializeSave, downloadJson, uploadJson, deserializeSave } from '../../lib/io';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toJpeg } from 'html-to-image';

export default function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addNode = useMapStore((s) => s.addNode);
  const config = useMapStore((s) => s.config);
  const setConfig = useMapStore((s) => s.setConfig);
  const getSaveData = useMapStore((s) => s.getSaveData);
  const loadSaveData = useMapStore((s) => s.loadSaveData);
  const autoLayout = useMapStore((s) => s.autoLayout);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const undoCount = useMapStore((s) => s.undoCount);
  const redoCount = useMapStore((s) => s.redoCount);
  const resetEdgeControlPoints = useMapStore((s) => s.resetEdgeControlPoints);
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

  const handleAutoLayout = () => {
    autoLayout('TB');
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  };

  const handleUndo = () => undo();
  const handleRedo = () => redo();

  const handleExportJpg = async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return;

    const nodes = useMapStore.getState().nodes;
    if (nodes.length === 0) {
      alert('Nothing to export — add some nodes first.');
      return;
    }

    const IMAGE_WIDTH = 4096;
    const IMAGE_HEIGHT = 3072;

    const nodesBounds = getNodesBounds(nodes);
    const { x, y, zoom } = getViewportForBounds(
      nodesBounds,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
      0.5,
      2,
      0.2,
    );

    try {
      // Hide edge labels (polarity/reverse buttons) during capture
      const edgeLabels = viewport.querySelectorAll<HTMLElement>('.react-flow__edgelabel-renderer');
      edgeLabels.forEach((el) => (el.style.visibility = 'hidden'));

      // Clone category blobs SVG into the viewport so html-to-image captures them.
      // The blobs normally live outside .react-flow__viewport and use a live viewport
      // transform, so we need to re-transform them to match the export transform.
      let blobClone: SVGSVGElement | null = null;
      const rfContainer = viewport.closest('.react-flow');
      const blobSvg = rfContainer?.querySelector<SVGSVGElement>(':scope > svg.pointer-events-none');
      if (blobSvg) {
        blobClone = blobSvg.cloneNode(true) as SVGSVGElement;
        // Replace the live viewport transform with identity — the export already
        // applies its own translate/scale via the style override on the viewport.
        const g = blobClone.querySelector('g');
        if (g) g.setAttribute('transform', `translate(0, 0) scale(1)`);
        // Position absolutely within the viewport
        blobClone.style.position = 'absolute';
        blobClone.style.inset = '0';
        blobClone.style.width = '100%';
        blobClone.style.height = '100%';
        blobClone.style.overflow = 'visible';
        blobClone.style.zIndex = '0';
        viewport.insertBefore(blobClone, viewport.firstChild);
      }

      const dataUrl = await toJpeg(viewport, {
        quality: 0.95,
        backgroundColor: '#f8fafc',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      });

      // Restore edge labels
      edgeLabels.forEach((el) => (el.style.visibility = ''));
      // Remove temporary blob clone
      if (blobClone) blobClone.remove();

      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `systems-map-${date}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      // Restore edge labels on failure too
      const edgeLabels = viewport.querySelectorAll<HTMLElement>('.react-flow__edgelabel-renderer');
      edgeLabels.forEach((el) => (el.style.visibility = ''));
      // Remove temporary blob clone on failure too
      if (blobClone) blobClone.remove();
      alert(`JPG export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white rounded-lg shadow-md border border-gray-200 px-2 py-1.5">
      {/* Undo */}
      <button
        onClick={handleUndo}
        disabled={undoCount === 0}
        className="px-2 py-1.5 text-xs font-medium rounded-md transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>

      {/* Redo */}
      <button
        onClick={handleRedo}
        disabled={redoCount === 0}
        className="px-2 py-1.5 text-xs font-medium rounded-md transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪ Redo
      </button>

      <div className="w-px h-6 bg-gray-200" />

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

      {/* Auto handles toggle */}
      <button
        onClick={() => setConfig({ autoHandles: !config.autoHandles })}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          config.autoHandles
            ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Auto-adjust arrow sides on node move"
      >
        ⇄ Arrows
      </button>

      {/* Dual handles toggle */}
      <button
        onClick={() => setConfig({ dualHandles: !config.dualHandles })}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          config.dualHandles
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Toggle dual-color offset handles (green source / red target)"
      >
        ◉ Dual
      </button>

      {/* Fit view */}
      <button
        onClick={handleFitView}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Fit view to all nodes"
      >
        ⊡ Fit
      </button>

      {/* Auto Layout */}
      <button
        onClick={handleAutoLayout}
        className="px-2.5 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors"
        title="Auto-arrange nodes based on causal flow"
      >
        ⊞ Auto Layout
      </button>

      {/* Reset All Curves (bezier mode only) */}
      {config.edgeStyle === 'bezier' && (
        <button
          onClick={resetEdgeControlPoints}
          className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
          title="Reset all bezier control points to default"
        >
          ↺ Reset Curves
        </button>
      )}

      <div className="w-px h-6 bg-gray-200" />

      {/* Export JSON */}
      <button
        onClick={handleExport}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Export as JSON"
      >
        ↓ JSON
      </button>

      {/* Export JPG */}
      <button
        onClick={handleExportJpg}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Export as JPG image"
      >
        ↓ JPG
      </button>

      {/* Import */}
      <button
        onClick={handleImport}
        className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        title="Import from JSON"
      >
        ↑ Import
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* Settings */}
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          settingsOpen
            ? 'bg-gray-200 text-gray-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="Settings"
      >
        ⚙ Settings
      </button>
      <ConfigPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
