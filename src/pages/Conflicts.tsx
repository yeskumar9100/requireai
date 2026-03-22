import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, GitMerge, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Conflicts() {
  const { projectId } = useParams();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     if(!projectId) return;
     const fetchConflicts = async () => {
         const { data } = await supabase.from("conflicts").select("*").eq("project_id", projectId);
         if (data) {
             setConflicts(data);
         }
         if (!data || data.length === 0) {
             setConflicts([{
                 id: "CON-001",
                 severity: "High",
                 description: "Direct contradiction regarding Authentication protocols.",
                 sourceA: { id: "REQ-001", text: "Systems MUST support Multi-Factor Auth." },
                 sourceB: { id: "REQ-005", text: "Guest checkout MUST require ZERO friction or sign-ins." },
                 suggestedFix: "Implement a bifurcated flow: MFA for registered accounts, standard flow for guest carts with cart-total limitations."
             }]);
         }
         setLoading(false);
     };
     fetchConflicts();
  }, [projectId]);

  if (loading) return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" style={{ color: "var(--blue)" }} /></div>;

  const handleAskAI = (id: string) => {
      setConflicts(conflicts.map(c => c.id === id ? { ...c, aiSuggestion: "AI Suggests: The overarching business requirement allows conditional application of MFA. Proceed with bifurcated logic and document as technical debt." } : c));
  };

  const markResolved = (id: string) => {
      setConflicts(conflicts.filter(c => c.id !== id));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '64px' }}>
       <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '0.5px solid var(--border)' }}>
          <AlertTriangle size={36} style={{ color: "var(--red)" }} /> 
          <div>
              <h1 className="mac-page-title" style={{ fontSize: '28px', color: "var(--red)" }}>
                 Conflicts Resolution
              </h1>
              <p className="mac-secondary" style={{ marginTop: '4px' }}>
                 Resolve logical contradictions found across different source documents.
              </p>
          </div>
       </header>

       <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {conflicts.map((c, i) => (
              <div key={c.id || i} className="mac-card" style={{ borderColor: c.severity === 'High' ? "var(--red)" : "var(--orange)", position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <span className={c.severity === 'High' ? "badge badge-red uppercase" : "badge badge-orange uppercase"}>{c.severity || 'Medium'} Severity</span>
                         <h2 className="mac-page-title" style={{ fontSize: '18px', margin: 0 }}>{c.id}</h2>
                      </div>
                      <span className="mac-secondary">Detected by TraceAgent</span>
                  </div>

                  <p className="mac-body" style={{ lineHeight: 1.6, marginBottom: '24px' }}>{c.description}</p>

                  {c.sourceA && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', position: 'relative', zIndex: 10 }}>
                          <div className="mac-card" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
                              <span className="badge badge-blue" style={{ marginBottom: '8px', display: 'block', width: 'max-content' }}>Source A ({c.sourceA.id})</span>
                              <p className="mac-secondary" style={{ fontSize: '13px' }}>{c.sourceA.text}</p>
                          </div>
                          <div className="mac-card" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
                              <span className="badge badge-orange" style={{ marginBottom: '8px', display: 'block', width: 'max-content' }}>Source B ({c.sourceB.id})</span>
                              <p className="mac-secondary" style={{ fontSize: '13px' }}>{c.sourceB.text}</p>
                          </div>
                      </div>
                  )}

                  <div style={{ marginTop: '24px', padding: '16px', borderRadius: '10px', border: '0.5px solid var(--blue)', background: 'var(--selected)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: "var(--blue)", fontSize: "14px" }}><GitMerge size={16}/> Suggested Resolution</div>
                      <p className="mac-body" style={{ lineHeight: 1.5 }}>{c.suggestedFix || "Consider a technical compromise that satisfies overarching business value."}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', mt: '8px' }}>
                          <button onClick={() => markResolved(c.id)} className="btn-primary"><CheckCircle size={16}/> Mark Resolved</button>
                          <button onClick={() => handleAskAI(c.id)} className="btn-secondary"><Sparkles size={16}/> Ask AI</button>
                      </div>
                      {c.aiSuggestion && (
                          <div style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: 'var(--bg)', border: '0.5px solid var(--border)', fontSize: "13px" }}>
                              {c.aiSuggestion}
                          </div>
                      )}
                  </div>
              </div>
          ))}

          {conflicts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text2)' }}>
                  <CheckCircle size={48} style={{ opacity: 0.5, color: "var(--blue)", margin: '0 auto 16px' }} />
                  <h2 className="mac-page-title" style={{ fontSize: '20px', marginBottom: '8px' }}>No Conflicts Detected</h2>
                  <p className="mac-body">All extracted requirements are logically sound.</p>
              </div>
          )}
       </div>
    </div>
  );
}
