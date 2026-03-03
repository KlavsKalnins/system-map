import { ReactFlowProvider } from '@xyflow/react';
import Canvas from './components/Canvas';
import Toolbar from './components/panels/Toolbar';
import NodeEditor from './components/panels/NodeEditor';
import ConfigPanel from './components/panels/ConfigPanel';

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen">
        {/* Main canvas area */}
        <div className="flex-1 relative">
          <Canvas />
          <Toolbar />
          <ConfigPanel />
        </div>

        {/* Right sidebar */}
        <NodeEditor />
      </div>
    </ReactFlowProvider>
  );
}
