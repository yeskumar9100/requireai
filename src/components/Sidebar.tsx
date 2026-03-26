import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, FolderOpen, Upload, Zap, 
  FileText, GitBranch, MessageCircle, AlertTriangle, 
  Settings, Shield
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  useAuth();
  const [projectName, setProjectName] = useState("");

  // Extract projectId from the current URL path
  const pathSegments = location.pathname.split('/');
  const projectRoutes = ['upload', 'pipeline', 'brd', 'graph', 'chat', 'conflicts'];
  const routeIndex = pathSegments.findIndex(seg => projectRoutes.includes(seg));
  const projectId = routeIndex !== -1 ? pathSegments[routeIndex + 1] : undefined;

  useEffect(() => {
    if (projectId) {
      supabase.from('projects').select('name').eq('id', projectId).single()
        .then(({ data }) => {
          if (data) {
             let name = data.name;
             if (name.length > 18) name = name.substring(0, 18) + "...";
             setProjectName(name);
          }
        });
    } else {
      setProjectName("");
    }
  }, [projectId]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path);

  const navItemStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    margin: '0 4px 1px',
    borderRadius: '6px',
    fontSize: '13px',
    color: active ? 'var(--blue)' : 'var(--text)',
    background: active ? 'var(--selected)' : 'transparent',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    userSelect: 'none' as const,
    textDecoration: 'none'
  });

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text3)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '12px 14px 4px',
      userSelect: 'none'
    }}>
      {children}
    </div>
  );

  const Divider = () => (
    <div style={{
      height: '0.5px',
      background: 'var(--border)',
      margin: '6px 10px'
    }} />
  );

  return (
    <aside style={{
      width: '220px',
      background: 'linear-gradient(180deg, var(--sidebar-bg) 0%, var(--bg) 100%)',
      borderRight: '0.5px solid var(--border)',
      height: '100%',
      overflowY: 'auto',
      padding: '8px 0',
      flexShrink: 0
    }}>
      <SectionLabel>GENERAL</SectionLabel>
      <div onClick={() => navigate('/dashboard')} style={navItemStyle(isActive('/dashboard'))} className="hoverable-nav">
         <LayoutDashboard size={15} /> Dashboard
      </div>
      <div onClick={() => navigate('/projects')} style={navItemStyle(isActive('/projects'))} className="hoverable-nav">
         <FolderOpen size={15} /> All Projects
      </div>

      {projectId && (
        <>
          <Divider />
          <SectionLabel>{projectName || "PROJECT"}</SectionLabel>
          <div onClick={() => navigate(`/upload/${projectId}`)} style={navItemStyle(isActive(`/upload/${projectId}`))} className="hoverable-nav">
             <Upload size={15} /> Upload
          </div>
          <div onClick={() => navigate(`/pipeline/${projectId}`)} style={navItemStyle(isActive(`/pipeline/${projectId}`))} className="hoverable-nav">
             <Zap size={15} /> Pipeline
          </div>
          <div onClick={() => navigate(`/brd/${projectId}`)} style={navItemStyle(isActive(`/brd/${projectId}`))} className="hoverable-nav">
             <FileText size={15} /> BRD Viewer
          </div>
          <div onClick={() => navigate(`/graph/${projectId}`)} style={navItemStyle(isActive(`/graph/${projectId}`))} className="hoverable-nav">
             <GitBranch size={15} /> Knowledge Graph
          </div>
          <div onClick={() => navigate(`/chat/${projectId}`)} style={navItemStyle(isActive(`/chat/${projectId}`))} className="hoverable-nav">
             <MessageCircle size={15} /> AI Chat
          </div>
          <div onClick={() => navigate(`/conflicts/${projectId}`)} style={navItemStyle(isActive(`/conflicts/${projectId}`))} className="hoverable-nav">
             <AlertTriangle size={15} /> Conflicts
          </div>
        </>
      )}

      <Divider />
      <SectionLabel>ACCOUNT</SectionLabel>
      <div onClick={() => navigate('/admin')} style={navItemStyle(isActive('/admin'))} className="hoverable-nav">
         <Shield size={15} style={{ color: 'var(--blue)' }} /> Admin Portal
      </div>
      <div onClick={() => navigate('/settings')} style={navItemStyle(isActive('/settings'))} className="hoverable-nav">
         <Settings size={15} /> Settings
      </div>

      <style>{`
        .hoverable-nav:hover { background: var(--hover) !important; }
      `}</style>
    </aside>
  );
}
