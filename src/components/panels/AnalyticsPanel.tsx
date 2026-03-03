import { useCallback, useMemo, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { getCategoryColor } from '../../lib/colors';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

interface AnalyticsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function AnalyticsPanel({ open, onClose }: AnalyticsPanelProps) {
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const config = useMapStore((s) => s.config);

  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const positiveEdges = edges.filter((e) => (e.data?.polarity ?? '+') === '+').length;
    const negativeEdges = totalEdges - positiveEdges;

    // Per-node connection counts
    const nodeStats = nodes.map((n) => {
      const title = n.data.title || 'Untitled';
      const category = n.data.category;
      const incoming = edges.filter((e) => e.target === n.id);
      const outgoing = edges.filter((e) => e.source === n.id);
      const inPos = incoming.filter((e) => (e.data?.polarity ?? '+') === '+').length;
      const inNeg = incoming.length - inPos;
      const outPos = outgoing.filter((e) => (e.data?.polarity ?? '+') === '+').length;
      const outNeg = outgoing.length - outPos;
      return {
        id: n.id,
        title,
        category,
        inCount: incoming.length,
        outCount: outgoing.length,
        total: incoming.length + outgoing.length,
        inPos,
        inNeg,
        outPos,
        outNeg,
        // Net polarity influence: positive inputs boost, negative inputs reduce
        netInfluence: inPos - inNeg,
      };
    });

    // Sort by total connections desc
    const byConnections = [...nodeStats].sort((a, b) => b.total - a.total);

    // By category
    const categoryGroups: Record<string, { count: number; label: string; color: string }> = {};
    for (const n of nodes) {
      const cat = n.data.category;
      if (!categoryGroups[cat]) {
        const catDef = config.categories.find((c) => c.id === cat);
        categoryGroups[cat] = {
          count: 0,
          label: catDef?.label ?? cat,
          color: getCategoryColor(config.categories, cat),
        };
      }
      categoryGroups[cat].count++;
    }

    // Feedback loops: find cycles (simple: A→B→A)
    const mutualPairs: { a: string; b: string; aToB: '+' | '-'; bToA: '+' | '-' }[] = [];
    const seen = new Set<string>();
    for (const e1 of edges) {
      for (const e2 of edges) {
        if (e1.source === e2.target && e1.target === e2.source && e1.id !== e2.id) {
          const key = [e1.source, e1.target].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            mutualPairs.push({
              a: e1.source,
              b: e1.target,
              aToB: (e1.data?.polarity as '+' | '-') ?? '+',
              bToA: (e2.data?.polarity as '+' | '-') ?? '+',
            });
          }
        }
      }
    }

    // Generate insights
    const insights: string[] = [];

    if (totalNodes === 0) {
      insights.push('Add nodes and edges to see system analytics.');
    } else {
      const ratio = totalEdges > 0 ? positiveEdges / totalEdges : 0;
      if (ratio > 0.7) {
        insights.push('The system is predominantly reinforcing — most relationships are positive (+), suggesting growth or escalation dynamics.');
      } else if (ratio < 0.3) {
        insights.push('The system is predominantly balancing — most relationships are negative (−), suggesting self-correcting or dampening dynamics.');
      } else {
        insights.push('The system has a balanced mix of reinforcing (+) and balancing (−) relationships, suggesting complex feedback dynamics.');
      }

      const isolated = nodeStats.filter((n) => n.total === 0);
      if (isolated.length > 0) {
        insights.push(`${isolated.length} node${isolated.length > 1 ? 's are' : ' is'} isolated with no connections.`);
      }

      const hubs = nodeStats.filter((n) => n.total >= 4);
      if (hubs.length > 0) {
        insights.push(`Key leverage point${hubs.length > 1 ? 's' : ''}: ${hubs.map((h) => h.title).join(', ')} — highly connected node${hubs.length > 1 ? 's' : ''} that influence many parts of the system.`);
      }

      const sinks = nodeStats.filter((n) => n.inCount > 0 && n.outCount === 0);
      if (sinks.length > 0) {
        insights.push(`Outcome variable${sinks.length > 1 ? 's' : ''}: ${sinks.map((s) => s.title).join(', ')} — receive input but don't drive other factors.`);
      }

      const sources = nodeStats.filter((n) => n.outCount > 0 && n.inCount === 0);
      if (sources.length > 0) {
        insights.push(`Root cause${sources.length > 1 ? 's' : ''}: ${sources.map((s) => s.title).join(', ')} — drive other factors but aren't influenced by the system.`);
      }

      for (const pair of mutualPairs) {
        const aName = nodes.find((n) => n.id === pair.a)?.data?.title ?? '?';
        const bName = nodes.find((n) => n.id === pair.b)?.data?.title ?? '?';
        const bothPos = pair.aToB === '+' && pair.bToA === '+';
        const bothNeg = pair.aToB === '-' && pair.bToA === '-';
        if (bothPos) {
          insights.push(`Reinforcing loop: ${aName} ↔ ${bName} — mutual positive feedback creating exponential growth or decline.`);
        } else if (bothNeg) {
          insights.push(`Reinforcing loop: ${aName} ↔ ${bName} — double negative creates reinforcing dynamic.`);
        } else {
          insights.push(`Balancing loop: ${aName} ↔ ${bName} — mixed polarity creates self-correcting behavior.`);
        }
      }
    }

    return {
      totalNodes,
      totalEdges,
      positiveEdges,
      negativeEdges,
      byConnections,
      categoryGroups,
      mutualPairs,
      insights,
    };
  }, [nodes, edges, config.categories]);

  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = useCallback(async (format: 'pdf' | 'jpg') => {
    const el = contentRef.current;
    if (!el) return;

    try {
      // Temporarily expand the container so everything renders without scroll clipping
      const parent = el.parentElement as HTMLElement | null;
      const origMaxH = parent?.style.maxHeight ?? '';
      const origH = el.style.maxHeight;
      const origOverflow = el.style.overflow;
      if (parent) parent.style.maxHeight = 'none';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';

      const dataUrl = await toJpeg(el, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      // Restore
      if (parent) parent.style.maxHeight = origMaxH;
      el.style.maxHeight = origH;
      el.style.overflow = origOverflow;

      const date = new Date().toISOString().slice(0, 10);

      if (format === 'jpg') {
        const link = document.createElement('a');
        link.download = `system-analytics-${date}.jpg`;
        link.href = dataUrl;
        link.click();
        return;
      }

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      // A4 landscape-ish proportions, fit content
      const pxW = img.naturalWidth;
      const pxH = img.naturalHeight;
      const pdfW = 210; // A4 width mm
      const pdfH = (pxH / pxW) * pdfW;

      const pdf = new jsPDF({
        orientation: pdfH > pdfW ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfW, pdfH + 10], // small bottom margin
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 5, pdfW, pdfH);
      pdf.save(`system-analytics-${date}.pdf`);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  if (!open) return null;

  const maxConnections = Math.max(1, ...stats.byConnections.map((n) => n.total));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[680px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">System Analytics</h2>
            <p className="text-xs text-gray-400 mt-0.5">Structure, polarity, and feedback insights</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadImage('jpg')}
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
              title="Download as JPG"
            >
              ↓ JPG
            </button>
            <button
              onClick={() => handleDownloadImage('pdf')}
              className="px-2.5 py-1 text-xs font-medium bg-cyan-100 text-cyan-700 rounded-md hover:bg-cyan-200 transition-colors"
              title="Download as PDF"
            >
              ↓ PDF
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div ref={contentRef} className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Nodes" value={stats.totalNodes} color="#3b82f6" />
            <StatCard label="Edges" value={stats.totalEdges} color="#8b5cf6" />
            <StatCard label="Positive (+)" value={stats.positiveEdges} color="#22c55e" />
            <StatCard label="Negative (−)" value={stats.negativeEdges} color="#ef4444" />
          </div>

          {/* Polarity ratio bar */}
          {stats.totalEdges > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Polarity Balance</label>
              <div className="flex h-6 rounded-full overflow-hidden border border-gray-200">
                <div
                  className="flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{
                    width: `${(stats.positiveEdges / stats.totalEdges) * 100}%`,
                    backgroundColor: '#22c55e',
                    minWidth: stats.positiveEdges > 0 ? '24px' : '0',
                  }}
                >
                  {stats.positiveEdges > 0 && `+${stats.positiveEdges}`}
                </div>
                <div
                  className="flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{
                    width: `${(stats.negativeEdges / stats.totalEdges) * 100}%`,
                    backgroundColor: '#ef4444',
                    minWidth: stats.negativeEdges > 0 ? '24px' : '0',
                  }}
                >
                  {stats.negativeEdges > 0 && `−${stats.negativeEdges}`}
                </div>
              </div>
            </div>
          )}

          {/* Nodes by category */}
          {Object.keys(stats.categoryGroups).length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Nodes by Category</label>
              <div className="space-y-1.5">
                {Object.values(stats.categoryGroups)
                  .sort((a, b) => b.count - a.count)
                  .map((cat) => (
                    <div key={cat.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-gray-700 w-24 truncate">{cat.label}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                          style={{
                            width: `${(cat.count / stats.totalNodes) * 100}%`,
                            backgroundColor: cat.color,
                            opacity: 0.7,
                            minWidth: '20px',
                          }}
                        >
                          <span className="text-[10px] font-bold text-white">{cat.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Connections per node bar chart */}
          {stats.byConnections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Connections per Node
              </label>
              <div className="space-y-1">
                {stats.byConnections.map((n) => (
                  <div key={n.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-28 truncate text-right" title={n.title}>
                      {n.title}
                    </span>
                    <div className="flex-1 flex h-4 gap-px">
                      {/* Positive in */}
                      {n.inPos > 0 && (
                        <div
                          className="h-full rounded-l-sm"
                          style={{
                            width: `${(n.inPos / maxConnections) * 100}%`,
                            backgroundColor: '#86efac',
                          }}
                          title={`${n.inPos} positive incoming`}
                        />
                      )}
                      {/* Negative in */}
                      {n.inNeg > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(n.inNeg / maxConnections) * 100}%`,
                            backgroundColor: '#fca5a5',
                          }}
                          title={`${n.inNeg} negative incoming`}
                        />
                      )}
                      {/* Positive out */}
                      {n.outPos > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(n.outPos / maxConnections) * 100}%`,
                            backgroundColor: '#22c55e',
                          }}
                          title={`${n.outPos} positive outgoing`}
                        />
                      )}
                      {/* Negative out */}
                      {n.outNeg > 0 && (
                        <div
                          className="h-full rounded-r-sm"
                          style={{
                            width: `${(n.outNeg / maxConnections) * 100}%`,
                            backgroundColor: '#ef4444',
                          }}
                          title={`${n.outNeg} negative outgoing`}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 w-5 text-right">{n.total}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#86efac' }} /> +in
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#fca5a5' }} /> −in
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} /> +out
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} /> −out
                </span>
              </div>
            </div>
          )}

          {/* Feedback loops */}
          {stats.mutualPairs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Feedback Loops ({stats.mutualPairs.length})
              </label>
              <div className="space-y-1.5">
                {stats.mutualPairs.map((pair, i) => {
                  const aName = nodes.find((n) => n.id === pair.a)?.data?.title ?? '?';
                  const bName = nodes.find((n) => n.id === pair.b)?.data?.title ?? '?';
                  const isReinforcing =
                    (pair.aToB === '+' && pair.bToA === '+') ||
                    (pair.aToB === '-' && pair.bToA === '-');
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                        isReinforcing
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      <span className="font-medium">{isReinforcing ? '🔄 R' : '⚖️ B'}</span>
                      <span className="truncate">
                        {aName}{' '}
                        <span className={pair.aToB === '+' ? 'text-green-600' : 'text-red-500'}>
                          {pair.aToB === '+' ? '→+→' : '→−→'}
                        </span>{' '}
                        {bName}{' '}
                        <span className={pair.bToA === '+' ? 'text-green-600' : 'text-red-500'}>
                          {pair.bToA === '+' ? '→+→' : '→−→'}
                        </span>{' '}
                        {aName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          {stats.insights.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">System Insights</label>
              <div className="space-y-2">
                {stats.insights.map((insight, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 leading-relaxed"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-gray-500 font-medium mt-0.5">{label}</div>
    </div>
  );
}
