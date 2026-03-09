# System Map

An open-source, browser-based tool for creating interactive **systems diagrams** and **causal loop diagrams**. Visualize complex relationships, feedback loops, and system dynamics — all from your browser with no backend required.

## ✨ Features

- **Infinite Canvas** — Pan, zoom, and drag on a boundless workspace powered by React Flow
- **Custom Nodes** — Create nodes with structured data: title, "increases" effects, "decreases" effects, and category
- **Directed Edges with Polarity** — Draw causal links between nodes and toggle **reinforcing (+)** or **balancing (−)** polarity
- **Category Visualization** — Assign categories (Economic, Social, Environmental, Political, Technological, or custom) with color-coded blob overlays using convex hulls
- **Auto Layout** — Automatically arrange your diagram with the Dagre layered graph algorithm
- **Export / Import** — Save and load your maps as validated JSON files
- **Auto-Save** — Your work is continuously saved to browser localStorage
- **Undo / Redo** — Full history support (up to 50 snapshots)
- **Keyboard Shortcuts** — `Ctrl+S` to save, `Delete`/`Backspace` to remove selected elements
- **Snap to Grid** — Toggle grid snapping for precise node alignment
- **MiniMap & Fit View** — Navigate large diagrams with ease
- **Analytics Panel** — View advanced metrics and insights about your system map

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [TypeScript](https://www.typescriptlang.org/) | Type-safe development |
| [React 19](https://react.dev/) | UI framework |
| [Vite](https://vite.dev/) | Build tool with fast HMR |
| [React Flow (@xyflow/react)](https://reactflow.dev/) | Interactive node-graph canvas |
| [Zustand](https://zustand.docs.pmnd.rs/) | Lightweight state management |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [Zod](https://zod.dev/) | Runtime JSON schema validation |
| [Dagre](https://github.com/dagrejs/dagre) | Automatic graph layout |
| [d3-shape](https://d3js.org/d3-shape) | Convex hull & curve generation for blob overlays |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 16 or later
- [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/KlavsKalnins/system-map.git
cd system-map

# Install dependencies
pnpm install
```

### Development

```bash
# Start the dev server with hot module replacement
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# Create an optimized production build
pnpm build

# Preview the production build locally
pnpm preview
```

The output in the `dist/` folder is a static site that can be deployed to any hosting provider (Vercel, Netlify, GitHub Pages, etc.).

### Linting

```bash
pnpm lint
```

## 📖 Usage

1. **Add a Node** — Click the **+ Node** button in the toolbar to create a new system element.
2. **Edit a Node** — Select a node to open the right-side editor panel. Set the title, category, and add "increases" / "decreases" effects.
3. **Connect Nodes** — Drag from a node's handle to another node to create a causal edge.
4. **Set Polarity** — Click the **+** or **−** label on an edge to toggle between reinforcing and balancing relationships.
5. **Toggle Blobs** — Use the toolbar to show or hide category blob overlays that group related nodes visually.
6. **Auto Layout** — Click the layout button to automatically arrange your diagram.
7. **Export / Import** — Save your map as a JSON file or load a previously saved one.

## 📁 Project Structure

```
src/
├── main.tsx                        # Application entry point
├── App.tsx                         # Root component layout
├── index.css                       # Tailwind CSS & React Flow style overrides
├── components/
│   ├── Canvas.tsx                  # React Flow canvas with controls & shortcuts
│   ├── nodes/
│   │   └── SystemNodeCard.tsx      # Custom node (title, effects, category)
│   ├── edges/
│   │   └── PolarityEdge.tsx        # Custom edge with +/− polarity toggle
│   ├── blobs/
│   │   └── CategoryBlobs.tsx       # SVG convex-hull category overlays
│   └── panels/
│       ├── Toolbar.tsx             # Top toolbar (actions & toggles)
│       ├── NodeEditor.tsx          # Right sidebar node editor
│       ├── ConfigPanel.tsx         # Settings (grid size, categories)
│       └── AnalyticsPanel.tsx      # System metrics & analytics
├── store/
│   └── useMapStore.ts              # Zustand store (state, actions, history)
├── lib/
│   ├── hull.ts                     # Graham scan convex hull algorithm
│   ├── colors.ts                   # Category color definitions
│   ├── io.ts                       # JSON serialization with Zod validation
│   └── autoLayout.ts              # Dagre-based automatic layout
└── types/
    └── index.ts                    # TypeScript type definitions
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature or fix: `git checkout -b feature/my-feature`
3. **Make your changes** and ensure `pnpm lint` passes
4. **Commit** with a descriptive message: `git commit -m "Add my feature"`
5. **Push** to your fork: `git push origin feature/my-feature`
6. **Open a Pull Request** against `main`

### Areas for Contribution

- 🌙 Dark mode support
- 🎞️ Animated edge transitions
- 🏷️ Free-text edge labels
- 🖼️ PNG / SVG export
- 🔍 Search and filter nodes
- 📊 Simulation and what-if analysis
- 🧪 Unit and integration tests (Vitest + React Testing Library)

## 🗺️ Roadmap

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the detailed technical specification and future plans.

Planned enhancements include:

- Dark mode theming
- Real-time collaboration (WebSocket + Yjs CRDT)
- AI-powered analysis (LLM integration)
- Subgraph nesting and grouping
- Image and SVG export

## 📄 License

This project is open source. A formal license file has not yet been added — if you plan to use or contribute to this project, please open an issue or check back for updates. Common choices for open-source projects include [MIT](https://choosealicense.com/licenses/mit/), [Apache 2.0](https://choosealicense.com/licenses/apache-2.0/), and [GPL-3.0](https://choosealicense.com/licenses/gpl-3.0/).

---

Built with ❤️ for systems thinkers, researchers, and anyone mapping complexity.
