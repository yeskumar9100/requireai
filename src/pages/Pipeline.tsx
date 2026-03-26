import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { runPipeline } from "../lib/extraction";
import { pipelineController } from "../lib/pipeline-controller";
import { rateLimiter } from "../lib/rate-limiter";
import { motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

const PHASES = [
  { num: 1, name: "Project Coordinator", agent: "Coordinator Agent", desc: "Setting up pipeline and loading sources" },
  { num: 2, name: "Document Parser", agent: "Parser Agent", desc: "Reading and chunking uploaded files" },
  { num: 3, name: "Relevance Scorer", agent: "Filter Agent", desc: "Identifying project-relevant content" },
  { num: 4, name: "Requirements Extractor", agent: "Extraction Agent", desc: "Finding requirements in your documents" },
  { num: 5, name: "Stakeholder Mapper", agent: "People Agent", desc: "Identifying people, roles and influence" },
  { num: 6, name: "Decision Tracker", agent: "Decision Agent", desc: "Capturing confirmed decisions" },
  { num: 7, name: "Timeline Builder", agent: "Timeline Agent", desc: "Extracting milestones and deadlines" },
  { num: 8, name: "Conflict Detector", agent: "Conflict Agent", desc: "Finding contradictions between requirements" },
  { num: 9, name: "Document Generator", agent: "BRD Agent", desc: "Assembling the final BRD document" },
];

export default function Pipeline() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);
  const [status, setStatus] = useState<string>("starting");
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasStarted = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRunId = useRef<string | null>(null);
  const logsChannelRef = useRef<any>(null);
  const runChannelRef = useRef<any>(null);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (logsChannelRef.current) {
        supabase.removeChannel(logsChannelRef.current);
        logsChannelRef.current = null;
      }
      if (runChannelRef.current) {
        supabase.removeChannel(runChannelRef.current);
        runChannelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, phase]);

  useEffect(() => {
    if (!projectId) {
      navigate("/dashboard");
      return;
    }
    initPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);


  const initPipeline = async () => {
    console.log('Pipeline init for:', projectId);
    
    if (!projectId) {
      navigate('/dashboard');
      return;
    }

    try {
      // STEP 1: Check project status first
      const { data: proj, error: projErr } = 
        await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

      if (projErr || !proj) {
        setError('Project not found');
        return;
      }
      setProject(proj);

      // If project is already ready - show complete
      // immediately without restarting anything
      if (proj.status === 'ready') {
        console.log('Project already complete');
        setStatus('complete');
        setPhase(9);
        setProgress(100);
        
        // Load existing logs to show history
        const { data: existingRun } = await supabase
          .from('extraction_runs')
          .select('*')
          .eq('project_id', projectId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingRun) {
          const { data: existingLogs } = await supabase
            .from('agent_logs')
            .select('*')
            .eq('extraction_run_id', existingRun.id)
            .order('created_at', { ascending: true });
          setLogs(existingLogs || []);
        }
        return; // STOP HERE - do not restart
      }

      // STEP 2: Check for existing running run
      const { data: existingRun } = await supabase
        .from('extraction_runs')
        .select('*')
        .eq('project_id', projectId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRun) {
        setPhase(existingRun.current_phase || 0);

        const total = existingRun.total_chunks || 1;
        const done = existingRun.processed_chunks || 0;
        setTotalChunks(total);
        setProcessedChunks(done);
        setProgress(Math.round((done / total) * 100));

        // Load existing logs
        const { data: existingLogs } = await supabase
          .from('agent_logs')
          .select('*')
          .eq('extraction_run_id', existingRun.id)
          .order('created_at', { ascending: true });
        setLogs(existingLogs || []);

        if (existingRun.status === 'complete') {
          setStatus('complete');
          setProgress(100);
          setPhase(9);
          return; // Already done - show complete
        }

        if (existingRun.status === 'cancelled') {
          setStatus('cancelled');
          return; // Show cancelled state
        }

        if (existingRun.status === 'running') {
          setStatus('running');
          subscribeToRun(existingRun.id);
          return; // Still running - just resubscribe
        }

        if (existingRun.status === 'failed' || existingRun.status === 'superseded') {
          console.log('Previous run failed or superseded - will start fresh');
          // Fall through to startFresh below
        }
      }

      // STEP 3: Check sources exist before starting
      const { data: sources } = await supabase
        .from('sources')
        .select('id, file_name')
        .eq('project_id', projectId);

      if (!sources || sources.length === 0) {
        setError(
          'No files uploaded. Please upload files first.'
        );
        return;
      }

      // STEP 4: Only start fresh if truly new
      if (!hasStarted.current) {
        await startFresh();
      }

    } catch (err: any) {
      console.error('Pipeline init error:', err);
      setError('Error: ' + err.message);
    }
  };

  const startFresh = async () => {
    console.log("=== START FRESH ===");
    if (hasStarted.current) {
      console.log("Already started — skipping");
      return;
    }
    hasStarted.current = true;

    setStatus("running");
    setLogs([]);
    setPhase(1);
    setProgress(0);

    try {
      console.log("Calling runPipeline with projectId:", projectId);
      const { runId } = await runPipeline(projectId!);
      console.log("✅ Pipeline started! runId:", runId);

      // Subscribe to real-time updates
      subscribeToRun(runId);
    } catch (err: any) {
      console.error("=== START FRESH CRASHED ===", err);
      setError("Failed to start pipeline: " + err.message);
      setStatus("error");
    }
  };

  const handleCancelPipeline = async () => {
    if (isCancelling) return;
    if (!window.confirm('Stop the pipeline? Partial data will be preserved — you can view what was extracted so far or restart later.')) return;
    
    setIsCancelling(true);
    try {
      await pipelineController.cancel();
      setStatus('cancelled');
      // Stop polling
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err: any) {
      console.error('Cancel failed:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const rerunPipeline = async () => {
    if (!projectId) return;
    if (!window.confirm('This will delete all existing extracted data and restart the pipeline from scratch. Continue?')) return;
    
    try {
      setStatus('starting');
      setLogs([]);
      setPhase(0);
      setProgress(0);
      setTotalChunks(0);
      setProcessedChunks(0);
      hasStarted.current = false;

      // Clear old data
      await Promise.all([
        supabase.from('requirements').delete().eq('project_id', projectId),
        supabase.from('stakeholders').delete().eq('project_id', projectId),
        supabase.from('decisions').delete().eq('project_id', projectId),
        supabase.from('timeline_events').delete().eq('project_id', projectId),
        supabase.from('conflicts').delete().eq('project_id', projectId),
        supabase.from('documents').delete().eq('project_id', projectId),
        supabase.from('extraction_runs').delete().eq('project_id', projectId),
      ]);

      // Reset project status to draft
      await supabase.from('projects').update({ status: 'draft' }).eq('id', projectId);
      
      // Start fresh
      await startFresh();
    } catch (err: any) {
      setError('Rerun failed: ' + err.message);
    }
  };

  const handleRunUpdate = (updated: any) => {
    if (updated.current_phase) setPhase(updated.current_phase);
    const total = updated.total_chunks || 1;
    const done = updated.processed_chunks || 0;
    setTotalChunks(total);
    setProcessedChunks(done);
    setProgress(Math.round((done / total) * 100));
    if (updated.status) {
      setStatus(updated.status);
      if (updated.status === "complete") {
        setProgress(100);
        setPhase(9);
        // Stop polling once complete
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
      if (updated.status === "cancelled") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }
  };

  const pollForCompletion = (runId: string) => {
    // Clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const { data: run } = await supabase
          .from('extraction_runs')
          .select('*')
          .eq('id', runId)
          .single();

        if (!run) return;
        handleRunUpdate(run);

        // Also fetch any new logs we might have missed
        const { data: latestLogs } = await supabase
          .from('agent_logs')
          .select('*')
          .eq('extraction_run_id', runId)
          .order('created_at', { ascending: true });
        if (latestLogs) setLogs(latestLogs);

        if (run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000); // poll every 5 seconds
  };

  const subscribeToRun = (runId: string) => {
    console.log("Subscribing to run:", runId);
    currentRunId.current = runId;

    if (logsChannelRef.current) {
      supabase.removeChannel(logsChannelRef.current);
      logsChannelRef.current = null;
    }
    if (runChannelRef.current) {
      supabase.removeChannel(runChannelRef.current);
      runChannelRef.current = null;
    }

    logsChannelRef.current = supabase
      .channel("logs-" + runId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "agent_logs",
        filter: `extraction_run_id=eq.${runId}`,
      }, (payload) => {
        setLogs((prev) => [...prev, payload.new]);
      })
      .subscribe();

    runChannelRef.current = supabase
      .channel("run-" + runId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "extraction_runs",
        filter: `id=eq.${runId}`,
      }, (payload) => {
        handleRunUpdate(payload.new as any);
      })
      .subscribe();

    // Start polling as a fallback in case Realtime drops
    pollForCompletion(runId);
  };

  // Estimate remaining time
  const getEstimatedTime = () => {
    const remaining = totalChunks - processedChunks;
    if (remaining <= 0) return null;
    const seconds = rateLimiter.estimateTime(remaining);
    const minutes = Math.ceil(seconds / 60);
    if (minutes <= 1) return '< 1 min remaining';
    return `~${minutes} min remaining`;
  };

  // ─── ERROR STATE ───
  if (error) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16, padding: 24 }}
      >
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--red)" }}>!</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Pipeline Error</div>
        <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>{error}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => navigate(`/upload/${projectId}`)} className="btn-primary">Go to Upload</button>
          <button onClick={() => { setError(null); hasStarted.current = false; initPipeline(); }}
            style={{ background: "transparent", color: "var(--text)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>
            Retry
          </button>
          <button onClick={() => navigate("/dashboard")}
            style={{ background: "transparent", color: "var(--text2)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>
            Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── CANCELLED STATE ───
  if (status === "cancelled") {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--bg2)", border: "0.5px solid rgba(245,158,11,0.4)", borderRadius: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "0.5px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, color: "var(--orange)" }}>⏹</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Pipeline Stopped</div>
          <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 8 }}>
            The pipeline was stopped at Phase {phase} of 9 ({processedChunks} of {totalChunks} chunks processed).
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 28 }}>
            Partial data has been preserved. You can view what was extracted so far or restart from scratch.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate(`/brd/${projectId}`)}
              style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>
              View Partial Results
            </button>
            <button onClick={rerunPipeline}
              style={{ background: "transparent", color: "var(--orange)", border: "0.5px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
              Restart Pipeline
            </button>
            <button onClick={() => navigate("/dashboard")}
              style={{ background: "transparent", color: "var(--text2)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
              Dashboard
            </button>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Agent Logs</div>
        <div style={{ background: "var(--bg2)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: 300, overflowY: "auto" }}>
          {logs.map((log: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "0.5px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--blue)", fontWeight: 600, minWidth: 140 }}>{log.agent_name}</span>
              <span style={{ color: "var(--text2)" }}>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </motion.div>
    );
  }

  // ─── COMPLETE STATE ───
  if (status === "complete") {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--bg2)", border: "0.5px solid var(--border)", borderRadius: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, color: "var(--green)" }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Analysis Complete!</div>
          <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 28 }}>Your BRD has been generated successfully</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => navigate(`/brd/${projectId}`)} className="btn-primary">View BRD</button>
            <button onClick={() => navigate(`/graph/${projectId}`)}
              style={{ background: "transparent", color: "var(--text)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
              Knowledge Graph
            </button>
            <button onClick={rerunPipeline}
              style={{ background: "transparent", color: "var(--orange)", border: "0.5px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
              Rerun Pipeline
            </button>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Agent Logs</div>
        <div style={{ background: "var(--bg2)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: 300, overflowY: "auto" }}>
          {logs.map((log: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "0.5px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--blue)", fontWeight: 600, minWidth: 140 }}>{log.agent_name}</span>
              <span style={{ color: "var(--text2)" }}>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </motion.div>
    );
  }

  // ─── RUNNING / STARTING STATE ───
  const estimatedTime = getEstimatedTime();

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ maxWidth: 800, margin: "0 auto", padding: "0 0 64px 0" }}
    >
      <div className="mac-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <h1 className="mac-page-title">AI Analysis in Progress</h1>
            <p className="mac-secondary" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {project?.name ? `Processing: ${project.name}` : "Analyzing your documents..."}
              <span style={{ color: "var(--blue)", fontWeight: 500, fontSize: "11px", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 4, marginLeft: 4 }}>
                Keep tab open during analysis
              </span>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--blue)", letterSpacing: "-0.5px" }}>{progress}%</div>
            <div className="mac-secondary">Phase {phase} of 9</div>
          </div>
        </div>
        <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--blue)", transition: "width 0.8s ease", borderRadius: 3 }}></div>
        </div>

        {/* Chunk progress + estimated time + stop button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {totalChunks > 0 && (
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "monospace" }}>
                Chunk {processedChunks}/{totalChunks}
              </span>
            )}
            {estimatedTime && (
              <span style={{ fontSize: 11, color: "var(--text3)", background: "rgba(99,102,241,0.06)", padding: "2px 8px", borderRadius: 4 }}>
                ⏱ {estimatedTime}
              </span>
            )}
          </div>
          <button
            onClick={handleCancelPipeline}
            disabled={isCancelling}
            style={{
              background: "transparent",
              color: "var(--red, #ef4444)",
              border: "0.5px solid rgba(239,68,68,0.4)",
              borderRadius: 8,
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 500,
              cursor: isCancelling ? "not-allowed" : "pointer",
              opacity: isCancelling ? 0.6 : 1,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isCancelling ? (
              <>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.4)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}></span>
                Stopping...
              </>
            ) : (
              <>⏹ Stop Pipeline</>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PHASES.map((p) => {
          const isDone = phase > p.num;
          const isActive = phase === p.num;
          const phaseLogs = logs.filter((l: any) => l.agent_name === p.agent);

          return (
            <div key={p.num} style={{
              background: "var(--bg2)",
              border: `0.5px solid ${isActive ? "rgba(99,102,241,0.4)" : isDone ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
              borderRadius: 12, padding: "14px 16px",
              opacity: !isDone && !isActive ? 0.5 : 1,
              transition: "all 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: isDone ? "rgba(16,185,129,0.15)" : isActive ? "rgba(99,102,241,0.15)" : "var(--bg)",
                  border: `0.5px solid ${isDone ? "rgba(16,185,129,0.4)" : isActive ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  color: isDone ? "var(--green)" : isActive ? "var(--blue)" : "var(--text3)",
                }}>
                  {isDone ? "✓" : p.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "var(--green)" : isActive ? "var(--text)" : "var(--text3)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{p.desc}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: isDone ? "var(--green)" : isActive ? "var(--blue)" : "var(--text3)" }}>
                  {isDone ? "Done" : isActive ? "Running..." : "Waiting"}
                </div>
              </div>

              {(isActive || isDone) && phaseLogs.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)", maxHeight: 100, overflowY: "auto" }}>
                  {phaseLogs.map((log: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text2)", padding: "2px 0", fontFamily: "monospace" }}>
                      <span style={{ color: "var(--green)", opacity: 0.7, marginRight: 4 }}>
                        [{new Date(log.created_at || Date.now()).toLocaleTimeString()}]
                      </span>
                      {log.message}
                    </div>
                  ))}
                  {isActive && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--blue)", opacity: 0.6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid var(--blue)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}></span>
                      processing...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div ref={logsEndRef} />
    </motion.div>
  );
}
