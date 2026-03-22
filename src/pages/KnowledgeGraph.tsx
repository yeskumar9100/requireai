import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import { X, Network, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function KnowledgeGraph() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGraphData = async () => {
      if (!projectId) return;

      const [reqs, stakes, decs, confs, sources] = 
        await Promise.all([
          supabase.from('requirements').select('*').eq('project_id', projectId),
          supabase.from('stakeholders').select('*').eq('project_id', projectId),
          supabase.from('decisions').select('*').eq('project_id', projectId),
          supabase.from('conflicts').select('*').eq('project_id', projectId),
          supabase.from('sources').select('*').eq('project_id', projectId)
        ]);

      const nodes = [
        ...(reqs.data||[]).map(r => ({
          id: `req-${r.id}`,
          name: r.text.substring(0,40)+'...',
          type: 'requirement',
          color: 'var(--blue)',
          val: r.priority==='high' ? 8 : 5,
          fullText: r.text
        })),
        ...(stakes.data||[]).map(s => ({
          id: `stake-${s.id}`,
          name: s.name,
          type: 'stakeholder',
          color: 'var(--green)',
          val: s.influence==='high' ? 10 : 6,
          role: s.role
        })),
        ...(decs.data||[]).map(d => ({
          id: `dec-${d.id}`,
          name: d.text.substring(0,40)+'...',
          type: 'decision',
          color: 'var(--purple)',
          val: 6,
          decidedBy: d.decided_by
        })),
        ...(confs.data||[]).map(c => ({
          id: `conf-${c.id}`,
          name: c.description.substring(0,40)+'...',
          type: 'conflict',
          color: 'var(--red)',
          val: 7,
          severity: 'High'
        })),
        ...(sources.data||[]).map(s => ({
          id: `src-${s.id}`,
          name: s.file_name,
          type: 'source',
          color: 'var(--text2)',
          val: 4
        }))
      ];

      // Create links between requirements and sources
      const links = [
        ...(reqs.data||[]).map(r => ({
          source: `req-${r.id}`,
          target: `src-${r.source_id}`,
          value: 1
        })).filter(l => l.target !== 'src-null'),
        ...(confs.data||[]).flatMap(c => 
          (c.requirement_ids||[]).map((rid:any) => ({
            source: `conf-${c.id}`,
            target: `req-${rid}`,
            value: 2
          }))
        )
      ];

      setGraphData({ nodes, links });
      setLoading(false);
    };

    loadGraphData();
  }, [projectId]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
  }, []);

  if (!loading && graphData.nodes.length === 0) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'400px', gap:12
      }}>
        <div style={{fontSize:32}}>🔍</div>
        <div style={{fontSize:15,fontWeight:600, color:'var(--text)'}}>No graph data yet</div>
        <div style={{fontSize:13,color:'var(--text2)'}}>Run the AI pipeline first to generate the knowledge graph</div>
        <button
          onClick={() => navigate(`/pipeline/${projectId}`)}
          className="btn-primary"
          style={{ marginTop: 8 }}
        >
          Go to Pipeline
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', margin: '-24px -28px' }}>
      <header style={{ position: 'absolute', top: '24px', left: '28px', zIndex: 10, pointerEvents: 'none' }}>
          <h1 className="mac-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Network size={20} style={{ color: "var(--blue)" }}/> Traceability Graph
          </h1>
      </header>

      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', cursor: 'grab' }}>
         {loading ? <Loader2 className="animate-spin" style={{ color: "var(--blue)" }} /> : (
             <ForceGraph2D
               graphData={graphData}
               nodeColor={node => node.color}
               nodeRelSize={8}
               linkColor={() => {
                 return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
               }} 
               linkWidth={1.5}
               linkDirectionalParticles={2}
               linkDirectionalParticleSpeed={0.005}
               onNodeClick={handleNodeClick}
               backgroundColor="transparent"
             />
         )}
      </div>

      {selectedNode && (
          <div className="mac-card" style={{ position: 'absolute', right: '28px', top: '24px', bottom: '24px', width: '320px', display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: 'var(--shadow)', background: 'var(--bg2)', opacity: 0.95 }}>
              <button onClick={() => setSelectedNode(null)} className="btn-icon !border-0" style={{ position: 'absolute', top: '16px', right: '16px' }}>
                 <X size={16}/>
              </button>
              <div className="badge badge-gray" style={{ width: 'max-content', marginBottom: '16px', background: 'var(--bg)' }}>
                 <span style={{ color: "var(--text)" }}>{selectedNode.type}</span>
              </div>
              <h2 className="mac-section-title" style={{ fontSize: '18px', marginBottom: '16px' }}>{selectedNode.name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="mac-body">
                  <p><strong style={{ color: "var(--text)" }}>Node ID:</strong> {selectedNode.id}</p>
                  {selectedNode.fullText && <p><strong style={{ color: "var(--text)" }}>Data:</strong> {selectedNode.fullText}</p>}
                  {selectedNode.role && <p><strong style={{ color: "var(--text)" }}>Role:</strong> {selectedNode.role}</p>}
                  {selectedNode.decidedBy && <p><strong style={{ color: "var(--text)" }}>Decided By:</strong> {selectedNode.decidedBy}</p>}
                  {selectedNode.severity && <p><strong style={{ color: "var(--red)" }}>Severity:</strong> {selectedNode.severity}</p>}
              </div>
              
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '0.5px solid var(--border)' }}>
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>View Details</button>
              </div>
          </div>
      )}
    </div>
  );
}
