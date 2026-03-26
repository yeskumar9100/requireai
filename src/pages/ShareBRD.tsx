import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ShareBRD() {
  const { token } = useParams();

  const [project, setProject] = useState<any>(null);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [requirements, setRequirements] = useState<any[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (token) loadBRDData();
  }, [token]);

  const loadBRDData = async () => {
    setLoading(true);
    try {
      // Step 1: Look up project by share_token
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('share_token', token)
        .single();

      if (projectError || !projectData) {
        console.error('Share BRD: Project not found for token:', token, projectError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProject(projectData);
      const projectId = projectData.id;

      // Step 2: Load all related data using the resolved project ID
      const [docRes, reqRes, stakeRes, decRes, timelineRes, conflictRes] = await Promise.all([
        supabase.from('documents').select('*').eq('project_id', projectId).eq('type', 'BRD').order('generated_at', { ascending: false }).limit(1).maybeSingle().then(r => r, e => ({ data: null, error: e })),
        supabase.from('requirements').select('*').eq('project_id', projectId).order('priority', { ascending: false }).then(r => r, e => ({ data: null, error: e })),
        supabase.from('stakeholders').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('decisions').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('timeline_events').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('conflicts').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e }))
      ]);

      if (docRes.data?.content) {
        const content = docRes.data.content;
        if (typeof content === 'object' && content.executiveSummary) {
          setExecutiveSummary(content.executiveSummary);
        } else if (typeof content === 'string') {
          setExecutiveSummary(content);
        }
      } else if (reqRes.data && reqRes.data.length > 0) {
        setExecutiveSummary(
          `This BRD contains ${reqRes.data.length} requirements extracted from uploaded business communications.`
        );
      }

      setRequirements(reqRes.data || []);
      setStakeholders(stakeRes.data || []);
      setDecisions(decRes.data || []);
      setTimeline(timelineRes.data || []);
      setConflicts(conflictRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Share BRD load error:', err);
      setNotFound(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#0A0A0F', color: '#fff' }}>
        <Loader2 className="animate-spin" style={{ color: '#6366F1', width: 24, height: 24 }} />
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading shared BRD...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#0A0A0F', color: '#fff' }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>—</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>BRD Not Found</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 320, textAlign: 'center' }}>This BRD doesn't exist or has been removed by its owner.</div>
        <a href="/" style={{ marginTop: 12, color: '#6366F1', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>← Back to RequireAI</a>
      </div>
    );
  }

  const functionalReqs = requirements.filter(r => r.category?.toLowerCase() === 'functional' || r.category === 'Functional');
  const nonFunctionalReqs = requirements.filter(r => r.category?.toLowerCase() !== 'functional' && r.category !== 'Functional');

  // Idea Validator Score
  const completeness = Math.min(100, Math.round((requirements.length / 10) * 100));
  const feasibility = conflicts.length === 0 ? 95 : Math.max(40, 95 - (conflicts.length * 15));
  const clarity = requirements.length > 0 ? Math.round(requirements.reduce((s, r) => s + (r.confidence || 0.8), 0) / requirements.length * 100) : 0;
  const coverage = Math.min(100, ((stakeholders.length > 0 ? 25 : 0) + (decisions.length > 0 ? 25 : 0) + (requirements.length > 0 ? 25 : 0) + (timeline.length > 0 ? 25 : 0)));
  const overall = Math.round((completeness + feasibility + clarity + coverage) / 4);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', color: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <nav style={{ height: 52, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          Require<span style={{ color: '#007AFF' }}>AI</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shared BRD</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>READ ONLY</span>
        </div>
      </nav>

      <article style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px 80px', display: 'flex', flexDirection: 'column', gap: 48 }}>
        {/* Header */}
        <header style={{ paddingBottom: 32, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Business Requirements Document</div>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>{project?.name || 'Project BRD'}</h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {requirements.length} requirements · {stakeholders.length} stakeholders · {decisions.length} decisions
          </div>
        </header>

        {/* Score Card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06))', border: '0.5px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Idea Validator Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: overall >= 70 ? '#10B981' : overall >= 40 ? '#F59E0B' : '#EF4444', letterSpacing: '-2px' }}>{overall}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>/ 100</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Completeness', value: completeness, color: '#6366F1' },
                { label: 'Feasibility', value: feasibility, color: '#10B981' },
                { label: 'Clarity', value: clarity, color: '#06B6D4' },
                { label: 'Coverage', value: coverage, color: '#A855F7' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${s.value}%`, background: s.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Executive Summary</h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>{executiveSummary}</p>
        </section>

        {/* Functional Requirements */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Functional Requirements ({functionalReqs.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {functionalReqs.map((r, i) => (
              <div key={i} style={{ background: '#111118', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6366F1' }}>REQ-{String(i+1).padStart(3,'0')}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', background: r.priority === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: r.priority === 'high' ? '#EF4444' : '#F59E0B' }}>{r.priority}</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>{r.text}</p>
              </div>
            ))}
            {functionalReqs.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No functional requirements</div>}
          </div>
        </section>

        {/* Non-Functional Requirements */}
        {nonFunctionalReqs.length > 0 && (
          <section>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Non-Functional Requirements ({nonFunctionalReqs.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {nonFunctionalReqs.map((r, i) => (
                <div key={i} style={{ background: '#111118', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#A855F7' }}>NFR-{String(i+1).padStart(3,'0')}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{r.category}</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>{r.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stakeholders */}
        {stakeholders.length > 0 && (
          <section>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Stakeholders ({stakeholders.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {stakeholders.map((s, i) => (
                <div key={i} style={{ background: '#111118', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{s.role} · {s.influence} influence</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conflicts */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Conflicts</h2>
          {conflicts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', background: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
              <CheckCircle size={20} style={{ color: '#10B981' }} />
              <span style={{ color: '#10B981', fontWeight: 600, fontSize: 14 }}>No conflicts detected — requirements are consistent</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conflicts.map((c, i) => (
                <div key={i} style={{ background: '#111118', borderLeft: '3px solid #EF4444', borderRadius: 10, padding: '14px 16px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>{c.severity || 'Medium'}</span>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 32, borderTop: '0.5px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          Generated by <a href="/" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>RequireAI</a> — AI-powered Business Requirements Document
        </div>
      </article>
    </div>
  );
}
