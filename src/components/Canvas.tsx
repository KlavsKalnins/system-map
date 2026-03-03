import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMapStore } from '../store/useMapStore';
import SystemNodeCard from './nodes/SystemNodeCard';
import PolarityEdge from './edges/PolarityEdge';
import CategoryBlobs from './blobs/CategoryBlobs';
import { getCategoryColor } from '../lib/colors';

const nodeTypes: NodeTypes = {
  system: SystemNodeCard as unknown as NodeTypes['default'],
};

const edgeTypes: EdgeTypes = {
  polarity: PolarityEdge as unknown as EdgeTypes['default'],
};

export default function Canvas() {
  const {
    nodes,
    edges,
    config,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    deleteNode,
    deleteEdge,
    setViewport,
    autoSave,
    autoLoad,
  } = useMapStore();

  const { fitView } = useReactFlow();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-load on mount
  useEffect(() => {
    autoLoad();
    // Small delay, then fit view
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [autoLoad, fitView]);

  // Auto-save every 2 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      autoSave();
    }, 2000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoSave]);

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedNodeId, nodes: currentNodes, edges: currentEdges } = useMapStore.getState();
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
        } else {
          // Delete selected edges
          const selectedEdge = currentEdges.find(
            (edge) => currentNodes.length > 0 && edge.selected,
          );
          if (selectedEdge) deleteEdge(selectedEdge.id);
        }
      }

      // Ctrl+S / Cmd+S: save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        autoSave();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteNode, deleteEdge, autoSave]);

  // Minimap color
  const minimapNodeColor = useCallback(
    (node: { data?: { category?: string } }) => {
      if (!node.data?.category) return '#6b7280';
      return getCategoryColor(config.categories, node.data.category);
    },
    [config.categories],
  );

  // Snap to grid
  const snapGrid = useMemo(
    (): [number, number] => [config.gridSize, config.gridSize],
    [config.gridSize],
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={config.snapToGrid}
        snapGrid={snapGrid}
        connectionMode={ConnectionMode.Loose}
        fitView
        deleteKeyCode={null} // we handle delete ourselves
        className="bg-gray-50"
      >
        <CategoryBlobs />
        <Background variant={BackgroundVariant.Dots} gap={config.gridSize} size={1} color="#d1d5db" />
        <Controls className="!bg-white !shadow-md !border !border-gray-200 !rounded-lg" />
        <MiniMap
          nodeColor={minimapNodeColor}
          className="!bg-white !shadow-md !border !border-gray-200 !rounded-lg"
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
    </div>
  );
}
