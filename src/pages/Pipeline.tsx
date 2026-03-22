import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Settings, FileSearch, Filter, ListChecks, Users, CheckSquare, Calendar, AlertTriangle, FileText, Loader2, Eye, Network } from "lucide-react";
import { supabase } from "../lib/supabase";

const PHASES = [
  { id: 1, name: "Project Coordinator", agent: "Coordinator Agent", desc: "Setting up pipeline and loading sources", icon: Settings, color: "var(--blue)", bg: "var(--selected)" },
  { id: 2, name: "Document Parser", agent: "Parser Agent", desc: "Reading and chunking uploaded files", icon: FileSearch, color: "var(--blue)", bg: "var(--selected)" },
  { id: 3, name: "Relevance Scorer", agent: "Filter Agent", desc: "Identifying project-relevant content", icon: Filter, color: "var(--blue)", bg: "var(--selected)" },
  { id: 4, name: "Requirements Extractor", agent: "Extraction Agent", desc: "Finding functional and non-functional requirements", icon: ListChecks, color: "var(--green)", bg: "rgba(16,185,129,0.15)" },
  { id: 5, name: "Stakeholder Mapper", agent: "People Agent", desc: "Identifying people, roles and influence", icon: Users, color: "var(--green)", bg: "rgba(16,185,129,0.15)" },
  { id: 6, name: "Decision Tracker", agent: "Decision Agent", desc: "Capturing confirmed decisions and rationale", icon: CheckSquare, color: "var(--green)", bg: "rgba(16,185,129,0.15)" },
  { id: 7, name: "Timeline Builder", agent: "Timeline Agent", desc: "Extracting milestones and deadlines", icon: Calendar, color: "var(--orange)", bg: "rgba(245,158,11,0.15)" },
  { id: 8, name: "Conflict Detector", agent: "Conflict Agent", desc: "Finding contradictions between requirements", icon: AlertTriangle, color: "var(--red)", bg: "rgba(239,68,68,0.15)" },
  { id: 9, name: "Document Generator", agent: "BRD Agent", desc: "Assembling the final BRD document", icon: FileText, color: "var(--purple)", bg: "rgba(168,85,247,0.15)" }
];

export default function Pipeline() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [currentPhase, setCurrentPhase] = useState(1);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [errorObj, setError] = useState("");
  const [runInstance, setRunInstance] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, currentPhase]);

  const startPipelineMocking = (startProgress: number) => {
    let p = startProgress;
    const interval = setInterval(() => {
        p += 5;
        if (p > 100) p = 100;
        
        const phaseNum = Math.min(9, Math.floor((p / 100) * 9) + 1);
        
        setProgress(p);
        setCurrentPhase(phaseNum);
        
        const phaseInfo = PHASES[phaseNum - 1];
        setLogs(prev => [...prev, { 
            agent_name: phaseInfo.agent, 
            message: `Executing task in phase ${phaseNum}... Tensor vectors optimized.`, 
            created_at: new Date().toISOString() 
        }]);

        if (p >= 100) clearInterval(interval);
    }, 1200);
  };

  useEffect(() => {
    if (!projectId) return;

    const checkAndStart = async () => {
      // First check if sources exist for this project
      const { data: sources } = await supabase.from('sources').select('id').eq('project_id', projectId);
      
      if (!sources || sources.length === 0) {
        setError('No files uploaded yet. Redirecting back to upload...');
        setTimeout(() => navigate(`/upload/${projectId}`), 2000);
        return;
      }

      // Check if pipeline already ran
      const { data: existingRun } = await supabase
        .from('extraction_runs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existingRun && existingRun.status === 'complete') {
         setCurrentPhase(9);
         setProgress(100);
         const { data: fetchLogs } = await supabase.from('agent_logs').select('*').eq('extraction_run_id', existingRun.id).order('created_at', { ascending: true });
         if (fetchLogs) setLogs(fetchLogs);
         return;
      }

      if (existingRun && (existingRun.status === 'running' || existingRun.status === 'pending')) {
         setRunInstance(existingRun.id);
         setCurrentPhase(existingRun.current_phase || 1);
         setProgress(existingRun.progress || 0);

         const { data: fetchLogs } = await supabase.from('agent_logs').select('*').eq('extraction_run_id', existingRun.id).order('created_at', { ascending: true });
         if (fetchLogs) setLogs(fetchLogs);
         
         // In a real environment, this listens. For now, simulate resume.
         startPipelineMocking(existingRun.progress || 0);
         return;
      }
      
      // If we fall through but have files, assume it's starting fresh
      startPipelineMocking(0);
    };

    checkAndStart();
  }, [projectId]);

  const isComplete = progress >= 100;

  if (errorObj) {
     return <div className="mac-card" style={{ margin: '24px', borderColor: 'var(--red)', color: 'var(--red)' }}>{errorObj}</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '64px' }}>
         <div className="mac-card" style={{ marginBottom: '24px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                 <div>
                     <h1 className="mac-page-title">{isComplete ? "Analysis Complete!" : "AI Analysis in Progress"}</h1>
                     <p className="mac-secondary" style={{ marginTop: '4px' }}>{isComplete ? "Your BRD is ready to view" : "Analyzing your documents..."}</p>
                 </div>
                 {!isComplete && (
                     <div style={{ textAlign: 'right' }}>
                         <div style={{ fontSize: "24px", fontWeight: 600, color: "var(--blue)", letterSpacing: "-0.5px" }}>{progress}% complete</div>
                         <div className="mac-secondary">~2 minutes remaining</div>
                     </div>
                 )}
             </div>

             <div style={{ height: "6px", background: "var(--bg3)", borderRadius: "3px", overflow: "hidden" }}>
                 <div style={{ height: "100%", width: `${progress}%`, background: isComplete ? "var(--green)" : "var(--blue)", transition: "width 1s ease" }}></div>
             </div>

             {isComplete && (
                 <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
                     <button onClick={() => navigate(`/brd/${projectId}`)} className="btn-primary">
                         <Eye size={16}/> View BRD
                     </button>
                     <button onClick={() => navigate(`/graph/${projectId}`)} className="btn-secondary">
                         <Network size={16}/> View Knowledge Graph
                     </button>
                 </div>
             )}
         </div>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {PHASES.map((phase) => {
                 const status = phase.id < currentPhase ? "done" : phase.id === currentPhase ? (isComplete ? "done" : "active") : "pending";
                 const Icon = phase.icon;
                 
                 return (
                     <div key={phase.id} className="mac-card" style={{ padding: 0, opacity: status === 'pending' ? 0.6 : 1, borderColor: status === 'active' ? 'var(--blue)' : 'var(--border)' }}>
                         <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: status === 'pending' ? 'var(--hover)' : phase.bg, color: status === 'pending' ? 'var(--text2)' : phase.color }}>
                                 <Icon size={18} />
                             </div>

                             <div style={{ flex: 1 }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>{phase.name}</span>
                                    <span className="badge badge-gray" style={{ background: 'var(--bg)' }}>{phase.agent}</span>
                                 </div>
                                 <div className="mac-secondary">{phase.desc}</div>
                             </div>

                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                 {status === 'pending' && <span className="mac-secondary">Pending</span>}
                                 {status === 'active' && <span style={{ color: "var(--blue)", fontWeight: 500 }}>Running...</span>}
                                 {status === 'done' && <Check size={16} style={{ color: "var(--green)" }}/>}
                             </div>
                         </div>

                         <AnimatePresence>
                             {status === 'active' && !isComplete && (
                                 <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: 'hidden', background: 'var(--bg)', borderTop: '0.5px solid var(--border)' }}>
                                     <div style={{ padding: '12px', height: '112px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text)' }}>
                                         {logs.filter(l => l.agent_name === phase.agent || !l.agent_name).map((log, i) => (
                                             <div key={i} style={{ marginBottom: '4px' }}>
                                                 <span style={{ color: "var(--green)", opacity: 0.8, marginRight: "4px" }}>
                                                     [{new Date(log.created_at || Date.now()).toLocaleTimeString()}]
                                                 </span>
                                                 {log.message}
                                             </div>
                                         ))}
                                         <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: "var(--blue)", opacity: 0.7 }}>
                                             <Loader2 size={12} className="animate-spin"/> processing knowledge extraction...
                                         </div>
                                         <div ref={logsEndRef} />
                                     </div>
                                 </motion.div>
                             )}
                         </AnimatePresence>
                     </div>
                 );
             })}
         </div>

    </div>
  );
}
