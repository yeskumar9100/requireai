import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UploadCloud, AlertTriangle, File, Sparkles, X, Text, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { runExtractionClientSide } from "../lib/extraction";
import { rateLimiter } from "../lib/rate-limiter";
import { motion, AnimatePresence } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

interface PendingFile {
  id: string;
  name: string;
  size: number;
  content: string;
  type: string;
}

export default function Upload() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // NEW STATES
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [manualNotes, setManualNotes] = useState("");
  const [activeTab, setActiveTab] = useState('Email');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [hasExistingFiles, setHasExistingFiles] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DEPRECATED
  // const [text, setText] = useState("");
  // const [fileName, setFileName] = useState('pasted_text.txt');

  // Verify project exists
  useEffect(() => {
    if (!projectId) {
      navigate('/dashboard');
      return;
    }

    const init = async () => {
      // Verify project
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('id', projectId)
        .single();

      if (projErr || !proj) {
        console.error('Project not found:', projErr);
        navigate('/dashboard');
        return;
      }

      setProject(proj);

      // Load existing sources
      const { data: sources } = await supabase
        .from('sources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (sources && sources.length > 0) {
        setUploadedFiles(sources);
        setHasExistingFiles(true);
      }

      setPageLoading(false);
    };

    init();
  }, [projectId, navigate]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setPendingFiles((prev: PendingFile[]) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            content
          }
        ]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev: PendingFile[]) => prev.filter((f: PendingFile) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleStart = async () => {
    // Combine all sources
    const fileContents = pendingFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n');
    const fullText = (fileContents + (manualNotes ? `\n\n--- MANUAL NOTES ---\n${manualNotes}` : '')).trim();
    
    if (!projectId || !fullText) return;
    setLoading(true);
    try {
      const summaryFileName = pendingFiles.length > 0 
        ? (pendingFiles.length === 1 ? pendingFiles[0].name : `${pendingFiles.length} files`)
        : 'manual_input.txt';

      const { data: sourceData } = await supabase
        .from('sources')
        .insert({
          project_id: projectId,
          type: 'text',
          file_name: summaryFileName,
          content: fullText,
          is_processed: false
        })
        .select()
        .single();

      const sourceId = sourceData?.id || crypto.randomUUID();

      const { data: runData } = await supabase
        .from('extraction_runs')
        .insert({ 
          project_id: projectId, 
          status: 'running', 
          current_phase: 1, 
          total_chunks: Math.ceil(fullText.split(/\s+/).length / 2000), 
          processed_chunks: 0, 
          started_at: new Date().toISOString() 
        })
        .select()
        .single();

      const runIdStr = runData?.id || crypto.randomUUID();

      await supabase.from('projects').update({ status: 'processing' }).eq('id', projectId);

      runExtractionClientSide(projectId, sourceId, fullText, runIdStr);
      navigate(`/pipeline/${projectId}?runId=${runIdStr}`);
    } catch (e) {
      console.error("Failed to start pipeline", e);
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{
          width: 20, height: 20,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 40 }}
    >
      <div style={{ marginBottom: '32px' }}>
        <h1 className="mac-page-title" style={{ fontSize: 24 }}>
          {project?.name ? `Ingest Sources — ${project.name}` : 'Ingest Sources'}
        </h1>
        <p className="mac-secondary" style={{ marginTop: '6px', fontSize: 14 }}>
          Assemble your documents, transcripts, and notes. The AI will weave them into a unified BRD.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 32, flex: 1 }}>
        {/* LEFT COLUMN: INPUTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* DRAG & DROP ZONE */}
          <div
            className={`mac-card ${isDragging ? 'is-dragging' : ''}`}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 16px', 
              textAlign: 'center', 
              cursor: 'pointer',
              border: isDragging ? '2px dashed var(--blue)' : '1px dashed var(--border)',
              background: isDragging ? 'var(--selected)' : 'var(--bg2)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ 
              width: 64, height: 64, 
              borderRadius: '50%', 
              background: 'var(--selected)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 16,
              color: 'var(--blue)'
            }}>
              <UploadCloud size={28} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Upload Documents</div>
            <div className="mac-secondary" style={{ marginTop: '8px' }}>
              Drag PDFs, Word docs, or Text files here<br />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Or click to browse your computer</span>
            </div>
            <input type="file" multiple style={{ display: "none" }} ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {/* MANUAL NOTES AREA */}
          <div className="mac-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text size={16} style={{ color: 'var(--blue)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Manual Context & Notes</h3>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Email', 'Meeting', 'Chat'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: activeTab === tab ? 'var(--blue)' : 'var(--bg3)',
                      color: activeTab === tab ? '#fff' : 'var(--text2)',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder={`Paste your raw ${activeTab.toLowerCase()} text here (transcripts, emails, scratchpad)...`}
              className="mac-input"
              style={{ height: '180px', padding: '16px', resize: 'none', background: 'var(--bg)', border: 'none', fontSize: 13, lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: QUEUE & SUMMARY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* FILE QUEUE */}
          <div className="mac-card" style={{ flex: 1, minHeight: 300, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Sparkles size={16} style={{ color: 'var(--purple)' }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Analysis Queue</h3>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pendingFiles.length} files currently staged</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {pendingFiles.map((file: PendingFile) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '12px', 
                      background: 'var(--bg3)', 
                      borderRadius: '12px',
                      border: '0.5px solid var(--border)'
                    }}
                  >
                    <div style={{ 
                      width: 32, height: 32, 
                      borderRadius: '8px', 
                      background: 'var(--hover)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--text2)'
                    }}>
                      <File size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="btn-icon"
                      style={{ border: 'none', opacity: 0.6 }}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {pendingFiles.length === 0 && !manualNotes.trim() && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.4, padding: 40 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px dashed var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} style={{ color: 'var(--text3)' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                    No sources added yet.<br />Add files or paste notes to begin analysis.
                  </div>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            {(() => {
              const fileWords = pendingFiles.reduce((sum: number, f: PendingFile) => sum + f.content.split(/\s+/).length, 0);
              const noteWords = manualNotes.trim() ? manualNotes.trim().split(/\s+/).length : 0;
              const totalWords = fileWords + noteWords;
              
              if (totalWords === 0) return null;

              const estimatedChunks = Math.ceil(totalWords / 2000);
              const estimatedMinutes = Math.ceil(rateLimiter.estimateTime(estimatedChunks) / 60);
              const isLarge = totalWords > 5000;

              return (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '0.5px solid var(--border)' }}>
                  {isLarge && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px', borderRadius: 10,
                      background: 'rgba(245,158,11,0.08)',
                      border: '0.5px solid rgba(245,158,11,0.2)',
                      marginBottom: 16
                    }}>
                      <AlertTriangle size={14} style={{ color: 'var(--orange)', marginTop: 2 }} />
                      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--orange)' }}>Large analysis volume.</strong> Process will be split into {estimatedChunks} chunks and take ~{estimatedMinutes} min to stay within API rate limits.
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ lineHeight: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ready for Synthetic Analysis</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{totalWords.toLocaleString()} words across {pendingFiles.length} sources</div>
                    </div>
                  </div>

                  <button 
                    onClick={handleStart} 
                    disabled={loading} 
                    className="btn-primary" 
                    style={{ width: '100%', height: 44, fontSize: 15 }}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Initializing Pipeline...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Launch AI Pipeline
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>

          {/* PREVIOUS SOURCES (Small list) */}
          {hasExistingFiles && (
            <div className="mac-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Previous Ingestions
                </h3>
                <span className="badge badge-gray">{uploadedFiles.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {uploadedFiles.slice(0, 3).map((file: any) => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                    <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {file.file_name}
                    </div>
                  </div>
                ))}
                {uploadedFiles.length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 4 }}>
                    + {uploadedFiles.length - 3} more sources
                  </div>
                )}
                <button 
                  onClick={() => navigate(`/pipeline/${projectId}`)} 
                  className="btn-secondary" 
                  style={{ marginTop: 12, width: '100%', height: 28, fontSize: 11 }}
                >
                  View Current State
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
