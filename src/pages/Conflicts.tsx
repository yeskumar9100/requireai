import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, GitMerge, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { callAIChat } from "../lib/ai-provider";
import { motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function Conflicts() {
  const { id: projectId } = useParams();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) loadConflicts();
  }, [projectId]);

  const loadConflicts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('conflicts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    console.log('Conflicts:', data, error);

    if (error) {
      console.error('Conflicts error:', error);
      setLoading(false);
      return;
    }

    setConflicts(data || []);
    setLoading(false);
  };

  if (loading) return (
    <motion.div 
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}
    >
      <Loader2 className="animate-spin" style={{ color: "var(--blue)" }} />
    </motion.div>
  );

  const handleAskAI = async (id: string) => {
      const conflict = conflicts.find(c => c.id === id);
      if (!conflict) return;
      
      // Set loading state
      setConflicts(conflicts.map(c => c.id === id ? { ...c, aiLoading: true } : c));

      try {
        const prompt = `You are a business analyst resolving a requirement conflict.

Conflict description: ${conflict.description || 'Unknown conflict'}
Severity: ${conflict.severity || 'Medium'}
${conflict.sourceA ? `Source A: ${conflict.sourceA.text}` : ''}
${conflict.sourceB ? `Source B: ${conflict.sourceB.text}` : ''}

Provide a specific, actionable resolution in 2-3 sentences. Focus on how to reconcile the conflicting requirements while preserving business value.`;

        const suggestion = await callAIChat([
          { role: 'user', text: prompt }
        ]);

        setConflicts(conflicts.map(c => c.id === id ? { ...c, aiSuggestion: suggestion, aiLoading: false } : c));
        
        // Persist to DB
        await supabase.from('conflicts').update({ suggested_fix: suggestion }).eq('id', id);
      } catch (err) {
        console.error('AI resolution error:', err);
        setConflicts(conflicts.map(c => c.id === id ? { ...c, aiSuggestion: 'Failed to get AI suggestion. Please check your API configuration and try again.', aiLoading: false } : c));
      }
  };

  const markResolved = async (id: string) => {
      await supabase.from('conflicts').delete().eq('id', id);
      setConflicts(conflicts.filter(c => c.id !== id));
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '64px' }}
    >
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                          <button onClick={() => markResolved(c.id)} className="btn-primary"><CheckCircle size={16}/> Mark Resolved</button>
                          <button onClick={() => handleAskAI(c.id)} className="btn-secondary" disabled={c.aiLoading}>
                            {c.aiLoading ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : <><Sparkles size={16}/> Ask AI</>}
                          </button>
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
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '50vh',
              gap: 12
            }}>
              <div style={{
                width: 48, height: 48,
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.1)',
                border: '0.5px solid rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: 'var(--green)'
              }}>✓</div>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text)'
              }}>
                No conflicts detected
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text2)'
              }}>
                Your requirements are consistent
              </div>
            </div>
          )}
       </div>
    </motion.div>
  );
}
