import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { supabase } from "../lib/supabase";
import { runExtractionClientSide } from "../lib/extraction";

export default function Upload() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [hasExistingFiles, setHasExistingFiles] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setText((prev) => prev + "\n" + ev.target?.result);
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setText((prev) => prev + "\n" + ev.target?.result);
      reader.readAsText(file);
    }
  };

  const handleStart = async () => {
    if (!projectId || !text.trim()) return;
    setLoading(true);
    try {
      const { data: sourceData } = await supabase
        .from('sources')
        .insert({
          project_id: projectId,
          type: 'document',
          file_name: 'pasted_text.txt',
          content: text,
          is_processed: false
        })
        .select()
        .single();

      const sourceId = sourceData?.id || crypto.randomUUID();

      const { data: runData } = await supabase
        .from('extraction_runs')
        .insert({ project_id: projectId, status: 'running', current_phase: 1, progress: 0 })
        .select()
        .single();

      const runIdStr = runData?.id || crypto.randomUUID();

      await supabase.from('projects').update({ status: 'processing' }).eq('id', projectId);

      runExtractionClientSide(projectId, sourceId, text, runIdStr);
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
    <>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="mac-page-title">
          {project?.name ? `Ingestion — ${project.name}` : 'Ingestion'}
        </h1>
        <p className="mac-secondary" style={{ marginTop: '4px' }}>
          Provide raw transcripts, documents, or notes for the AI to analyze.
        </p>
      </div>

      {hasExistingFiles && (
        <div className="mac-card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Previously uploaded files
          </div>
          {uploadedFiles.map(file => (
            <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{file.file_name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-green">{file.type}</span>
                <span className="mac-secondary">Uploaded</span>
              </div>
            </div>
          ))}
          <button onClick={() => navigate(`/pipeline/${projectId}`)} className="btn-primary" style={{ marginTop: 16 }}>
            Continue to Pipeline
          </button>
        </div>
      )}

      <div
        className="mac-card mac-card-hover"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', marginBottom: '24px', textAlign: 'center', cursor: 'pointer' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={36} style={{ color: "var(--blue)", marginBottom: '12px' }} />
        <div style={{ fontSize: "14px", fontWeight: 500 }}>Drag and drop any file here</div>
        <div className="mac-secondary" style={{ marginTop: '4px' }}>Or click to select a file from your computer</div>
        <input type="file" style={{ display: "none" }} ref={fileInputRef} onChange={handleFileChange} />
      </div>

      <div className="mac-card" style={{ marginBottom: '24px' }}>
        <h2 className="mac-section-title">Source Context</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your raw text here or upload a file above..."
          className="mac-input"
          style={{ height: '180px', padding: '12px', resize: 'none' }}
        />
      </div>

      {text.trim() && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleStart} disabled={loading} className="btn-primary">
            {loading ? "Starting Processing..." : "Start AI Analysis"}
          </button>
        </div>
      )}
    </>
  );
}
