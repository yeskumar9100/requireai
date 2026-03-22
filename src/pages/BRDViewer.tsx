import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, FileAudio, Users, ShieldAlert, GitMerge, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function BRDViewer() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const fetchBRD = async () => {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: reqs } = await supabase.from('requirements').select('*').eq('project_id', projectId);
        const { data: stks } = await supabase.from('stakeholders').select('*').eq('project_id', projectId);
        
        setProject(proj);
        if (reqs) setRequirements(reqs);
        if (stks) setStakeholders(stks);
        setLoading(false);
    }
    fetchBRD();
  }, [projectId]);

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return "badge-green";
    if (conf >= 0.5) return "badge-orange";
    return "badge-red";
  };

  const exportPDF = () => window.print();

  if (loading) {
     return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" style={{ color: "var(--blue)", width: 24, height: 24 }} /></div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '32px', borderBottom: '0.5px solid var(--border)' }}>
            <div>
              <div className="badge badge-gray" style={{ marginBottom: '12px', border: '0.5px solid var(--border)' }}>BUSINESS REQUIREMENTS DOCUMENT</div>
              <h1 className="mac-page-title" style={{ fontSize: '32px' }}>{project?.name || "Project BRD"}</h1>
            </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <button onClick={exportPDF} className="btn-primary" style={{ width: '100%' }}><Download size={14}/> Export PDF</button>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button onClick={() => {
                   const a = document.createElement('a');
                   a.href = URL.createObjectURL(new Blob(['Mock DOCX'], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
                   a.download = 'brd.docx'; a.click();
                 }} className="btn-secondary" style={{ flex: 1, fontSize: '12px' }}>DOCX</button>
                 
                 <button onClick={() => {
                   const a = document.createElement('a');
                   a.href = URL.createObjectURL(new Blob(['# Mock MD'], {type: 'text/markdown'}));
                   a.download = 'brd.md'; a.click();
                 }} className="btn-secondary" style={{ flex: 1, fontSize: '12px' }}>Markdown</button>
               </div>
            </div>
        </header>

        <div style={{ display: 'flex', gap: '40px' }}>
          <aside style={{ width: '200px', flexShrink: 0, position: 'sticky', top: '16px', height: 'max-content' }}>
            <h3 className="mac-section-title">Table of Contents</h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }} className="mac-body">
              <li><a href="#executive-summary" style={{ textDecoration: 'none', color: 'var(--text2)' }}>Executive Summary</a></li>
              <li><a href="#stakeholders" style={{ textDecoration: 'none', color: 'var(--text2)' }}>Stakeholder Analysis</a></li>
              <li><a href="#system-requirements" style={{ textDecoration: 'none', color: 'var(--text2)' }}>System Requirements</a></li>
              <li><a href="#conflicts" style={{ textDecoration: 'none', color: 'var(--text2)' }}>Conflict Analysis</a></li>
            </ul>
          </aside>

          <article style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '40px' }}>
           
           <section id="executive-summary" className="mac-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <h2 className="mac-page-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileAudio size={20} style={{ color: "var(--blue)" }}/> Executive Summary</h2>
              <p className="mac-body" style={{ lineHeight: 1.6 }}>
                  This document synthesizes requirements extracted dynamically from cross-functional emails, design sprints, and engineering transcripts. 
                  The primary objective of this project is to implement functionality based on the unstructured data provided during ingestion.
              </p>
           </section>

           <section id="stakeholders">
              <h2 className="mac-page-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} style={{ color: "var(--green)" }}/> Stakeholder Analysis</h2>
              <div className="mac-table-wrapper">
                 <table className="mac-table">
                    <thead>
                       <tr>
                           <th>Name</th>
                           <th>Role</th>
                           <th>Influence</th>
                       </tr>
                    </thead>
                    <tbody>
                       {stakeholders.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text2)' }}>No stakeholders detected</td></tr>}
                       {stakeholders.map((s,i) => (
                           <tr key={i} className="hoverable">
                               <td style={{ fontWeight: 500 }}>{s.name}</td>
                               <td className="mac-secondary">{s.role}</td>
                               <td>
                                  <span className="badge badge-blue">{s.influence}</span>
                               </td>
                           </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </section>

           <section id="system-requirements">
              <h2 className="mac-page-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={20} style={{ color: "var(--orange)" }}/> System Requirements</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {requirements.length === 0 && <div className="mac-secondary">No system requirements detected</div>}
                 {requirements.map((req, idx) => (
                     <div key={req.id || idx} className="mac-card mac-card-hover">
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 600, color: "var(--blue)" }}>REQ-{idx+1}</span>
                                <span className="badge badge-gray" style={{ textTransform: 'uppercase' }}>{req.category}</span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`badge ${
                                   req.priority === 'high' ? 'badge-red' : 
                                   req.priority === 'medium' ? 'badge-orange' : 
                                   'badge-blue'
                                }`} style={{ textTransform: 'uppercase' }}>{req.priority}</span>
                                <span className={`badge ${getConfidenceColor(req.confidence)}`}>
                                   Conf: {(req.confidence*100).toFixed(0)}%
                                </span>
                             </div>
                         </div>
                         <p className="mac-body" style={{ lineHeight: 1.6 }}>{req.text}</p>
                     </div>
                 ))}
              </div>
           </section>

           <section id="conflicts" className="mac-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: "var(--red)", background: "var(--selected)" }}>
               <div>
                  <h3 className="mac-page-title" style={{ fontSize: "18px", marginBottom: "4px", color: "var(--red)", display: 'flex', alignItems: 'center', gap: '8px' }}><GitMerge size={20}/> Conflict Analysis Pending</h3>
                  <p className="mac-secondary">AI has flagged areas requiring human review.</p>
               </div>
               <button onClick={() => navigate(`/conflicts/${projectId}`)} className="btn-danger">Resolve Conflicts</button>
           </section>

          </article>
        </div>
    </div>
  );
}
