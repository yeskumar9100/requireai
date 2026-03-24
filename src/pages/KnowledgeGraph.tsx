import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";
import * as d3 from "d3-force";
import { supabase } from "../lib/supabase";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function KnowledgeGraph() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-200);
      fgRef.current.d3Force('link').distance(80);
      fgRef.current.d3Force('collide', d3.forceCollide().radius((node: any) => Math.sqrt(node.val || 5) * 4 + 8).iterations(2));
    }
  }, [graphData, filter]);

  useEffect(() => {
    if (projectId) loadGraphData();
  }, [projectId]);

  const loadGraphData = async () => {
    setLoading(true);
    console.log("Loading graph for project:", projectId);

    try {
      const [reqRes, stakeRes, decRes, srcRes, confRes] = await Promise.all([
        supabase.from("requirements").select("*").eq("project_id", projectId),
        supabase.from("stakeholders").select("*").eq("project_id", projectId),
        supabase.from("decisions").select("*").eq("project_id", projectId),
        supabase.from("sources").select("*").eq("project_id", projectId),
        supabase.from("conflicts").select("*").eq("project_id", projectId),
      ]);

      console.log("Graph data loaded:", {
        requirements: reqRes.data?.length || 0,
        stakeholders: stakeRes.data?.length || 0,
        decisions: decRes.data?.length || 0,
        sources: srcRes.data?.length || 0,
        conflicts: confRes.data?.length || 0,
      });

      const requirements = reqRes.data || [];
      const stakeholders = stakeRes.data || [];
      const decisions = decRes.data || [];
      const sources = srcRes.data || [];
      const conflicts = confRes.data || [];

      const totalItems = requirements.length + stakeholders.length + decisions.length;

      if (totalItems === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Build nodes
      const nodes: any[] = [
        ...requirements.map((r: any) => ({
          id: "req-" + r.id,
          name: r.text ? r.text.substring(0, 45) + (r.text.length > 45 ? "..." : "") : "Requirement",
          type: "requirement",
          color: "#6366F1",
          val: r.priority === "high" ? 10 : r.priority === "medium" ? 7 : 5,
          data: r,
        })),
        ...stakeholders.map((s: any) => ({
          id: "stake-" + s.id,
          name: s.name || "Stakeholder",
          type: "stakeholder",
          color: "#10B981",
          val: s.influence === "high" ? 12 : s.influence === "medium" ? 8 : 5,
          data: s,
        })),
        ...decisions.map((d: any) => ({
          id: "dec-" + d.id,
          name: d.text ? d.text.substring(0, 45) + (d.text.length > 45 ? "..." : "") : "Decision",
          type: "decision",
          color: "#A855F7",
          val: 7,
          data: d,
        })),
        ...conflicts.map((c: any) => ({
          id: "conf-" + c.id,
          name: (c.description || c.text || "Conflict").substring(0, 45) + "...",
          type: "conflict",
          color: "#EF4444",
          val: 8,
          data: c,
        })),
        ...sources.map((s: any) => ({
          id: "src-" + s.id,
          name: s.file_name || "Source",
          type: "source",
          color: "#8585A0",
          val: 4,
          data: s,
        })),
      ];

      // Build links
      const links: any[] = [];

      // Requirements → Sources
      requirements.forEach((r: any) => {
        if (r.source_id && sources.find((s: any) => s.id === r.source_id)) {
          links.push({ source: "req-" + r.id, target: "src-" + r.source_id, value: 1, color: "rgba(99,102,241,0.3)" });
        }
      });

      // Decisions → Sources
      decisions.forEach((d: any) => {
        if (d.source_id && sources.find((s: any) => s.id === d.source_id)) {
          links.push({ source: "dec-" + d.id, target: "src-" + d.source_id, value: 1, color: "rgba(168,85,247,0.3)" });
        }
      });

      // Conflicts → Requirements
      conflicts.forEach((c: any) => {
        if (c.requirement_ids && Array.isArray(c.requirement_ids)) {
          c.requirement_ids.forEach((rid: string) => {
            if (requirements.find((r: any) => r.id === rid)) {
              links.push({ source: "conf-" + c.id, target: "req-" + rid, value: 2, color: "rgba(239,68,68,0.4)" });
            }
          });
        }
      });

      // Fallback: if no links, connect requirements together
      if (links.length === 0 && requirements.length > 1) {
        requirements.slice(0, 5).forEach((r: any, i: number) => {
          if (i > 0) {
            links.push({ source: "req-" + requirements[0].id, target: "req-" + r.id, value: 1, color: "rgba(99,102,241,0.2)" });
          }
        });
      }

      // Also connect stakeholders to first source if no other links for them
      if (stakeholders.length > 0 && sources.length > 0) {
        stakeholders.forEach((s: any) => {
          links.push({ source: "stake-" + s.id, target: "src-" + sources[0].id, value: 1, color: "rgba(16,185,129,0.2)" });
        });
      }

      // Connect decisions to stakeholders by name match
      decisions.forEach((d: any) => {
        const match = stakeholders.find(
          (s: any) => d.decided_by && s.name && d.decided_by.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
          links.push({ source: "dec-" + d.id, target: "stake-" + match.id, value: 1, color: "rgba(168,85,247,0.2)" });
        }
      });

      console.log("Graph built:", { nodes: nodes.length, links: links.length });
      setGraphData({ nodes, links });
    } catch (err: any) {
      console.error("Graph load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered data for display
  const filteredData = {
    nodes: filter === "all" ? graphData.nodes : graphData.nodes.filter((n: any) => n.type === filter),
    links:
      filter === "all"
        ? graphData.links
        : graphData.links.filter((l: any) => {
            const srcId = typeof l.source === "object" ? l.source.id : l.source;
            const tgtId = typeof l.target === "object" ? l.target.id : l.target;
            const srcNode = graphData.nodes.find((n: any) => n.id === srcId);
            const tgtNode = graphData.nodes.find((n: any) => n.id === tgtId);
            return srcNode?.type === filter || tgtNode?.type === filter;
          }),
  };

  // ─── LOADING ───
  if (loading) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}
      >
        <div style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 13, color: "var(--text2)" }}>Loading knowledge graph...</div>
      </motion.div>
    );
  }

  // ─── NO DATA ───
  if (!hasData) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16, padding: 24 }}
      >
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>◎</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>No graph data yet</div>
        <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
          Run the AI pipeline first to extract requirements, stakeholders, and decisions. The knowledge graph will appear here once analysis is complete.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => navigate(`/pipeline/${projectId}`)} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Run Pipeline
          </button>
          <button onClick={() => navigate(`/upload/${projectId}`)} style={{ background: "transparent", color: "var(--text)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>
            Upload Files
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── FILTER ITEMS ───
  const filterItems = [
    { key: "all", label: "All Nodes", color: "#8585A0", count: graphData.nodes.length },
    { key: "requirement", label: "Requirements", color: "#6366F1", count: graphData.nodes.filter((n: any) => n.type === "requirement").length },
    { key: "stakeholder", label: "Stakeholders", color: "#10B981", count: graphData.nodes.filter((n: any) => n.type === "stakeholder").length },
    { key: "decision", label: "Decisions", color: "#A855F7", count: graphData.nodes.filter((n: any) => n.type === "decision").length },
    { key: "conflict", label: "Conflicts", color: "#EF4444", count: graphData.nodes.filter((n: any) => n.type === "conflict").length },
    { key: "source", label: "Sources", color: "#8585A0", count: graphData.nodes.filter((n: any) => n.type === "source").length },
  ];

  const legendItems = [
    { color: "#6366F1", label: "Requirement" },
    { color: "#10B981", label: "Stakeholder" },
    { color: "#A855F7", label: "Decision" },
    { color: "#EF4444", label: "Conflict" },
    { color: "#8585A0", label: "Source file" },
  ];

  // ─── MAIN RENDER ───
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: "grid", gridTemplateColumns: "200px 1fr 280px", height: "calc(100vh - 52px)", gap: 0, margin: "-24px -28px" }}
    >
      {/* LEFT FILTER PANEL */}
      <div style={{ background: "var(--bg2)", borderRight: "0.5px solid var(--border)", padding: 16, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Filter Nodes</div>
        {filterItems.map((f) => (
          <div
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              background: filter === f.key ? "var(--selected)" : "transparent",
              border: filter === f.key ? "0.5px solid rgba(99,102,241,0.3)" : "0.5px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: filter === f.key ? "var(--blue)" : "var(--text2)" }}>{f.label}</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg)", padding: "1px 6px", borderRadius: 4 }}>{f.count}</span>
          </div>
        ))}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Legend</div>
          {legendItems.map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 11, color: "var(--text2)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER GRAPH CANVAS */}
      <div style={{ background: "#050508", position: "relative", overflow: "hidden" }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={filteredData}
          cooldownTicks={100}
          backgroundColor="#050508"
          nodeColor={(node: any) => node.color || "#6366F1"}
          nodeVal={(node: any) => node.val || 5}
          nodeLabel={(node: any) => node.name}
          linkColor={(link: any) => link.color || "rgba(255,255,255,0.1)"}
          linkWidth={1}
          onNodeClick={(node: any) => setSelectedNode(node)}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.name;
            const fontSize = Math.max(10 / globalScale, 8);
            const r = Math.sqrt(node.val || 5) * 4;

            ctx.beginPath();
            ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
            ctx.fillStyle = node.color || "#6366F1";
            ctx.fill();

            if (globalScale > 0.8) {
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillStyle = "rgba(255,255,255,0.8)";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              const shortName = label && label.length > 20 ? label.substring(0, 20) + "..." : label || "";
              ctx.fillText(shortName, node.x!, node.y! + r + fontSize);
            }
          }}
        />

        <div style={{ position: "absolute", bottom: 16, left: 16, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          {filteredData.nodes.length} nodes · {filteredData.links.length} links · Scroll to zoom · Drag to pan
        </div>
      </div>

      {/* RIGHT DETAIL PANEL */}
      <div style={{ background: "var(--bg2)", borderLeft: "0.5px solid var(--border)", padding: 16, overflowY: "auto" }}>
        {selectedNode ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: "0.5px solid var(--border)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: selectedNode.color, flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {selectedNode.type}
              </div>
            </div>

            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, marginBottom: 16 }}>
              {selectedNode.data?.text || selectedNode.data?.name || selectedNode.data?.milestone || selectedNode.data?.file_name || selectedNode.name}
            </div>

            {selectedNode.data?.priority && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Priority</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: selectedNode.data.priority === "high" ? "rgba(239,68,68,0.15)" : selectedNode.data.priority === "medium" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                  color: selectedNode.data.priority === "high" ? "#EF4444" : selectedNode.data.priority === "medium" ? "#F59E0B" : "#10B981",
                }}>
                  {selectedNode.data.priority}
                </span>
              </div>
            )}

            {selectedNode.data?.category && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Category</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818CF8" }}>
                  {selectedNode.data.category}
                </span>
              </div>
            )}

            {selectedNode.data?.confidence != null && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Confidence</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>{Math.round(selectedNode.data.confidence * 100)}%</span>
              </div>
            )}

            {selectedNode.data?.role && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Role</span>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{selectedNode.data.role}</span>
              </div>
            )}

            {selectedNode.data?.influence && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Influence</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#10B981" }}>
                  {selectedNode.data.influence}
                </span>
              </div>
            )}

            {selectedNode.data?.decided_by && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Decided by</span>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{selectedNode.data.decided_by}</span>
              </div>
            )}

            <button onClick={() => setSelectedNode(null)}
              style={{ marginTop: 16, background: "transparent", color: "var(--text3)", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", width: "100%" }}>
              Clear selection
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, opacity: 0.5 }}>
            <div style={{ fontSize: 28, color: "var(--text3)" }}>◎</div>
            <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>Click any node to see details</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
