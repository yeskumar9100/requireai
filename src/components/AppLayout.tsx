import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "../context/ThemeContext";
import CopilotFAB from "./CopilotFAB";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      style={{
        width: 28, height: 28,
        borderRadius: 6,
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text2)',
        fontSize: 14
      }}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

function UserAvatar() {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate('/settings')}
      style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: 'var(--blue)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 600,
        border: '0.5px solid var(--border)',
        cursor: 'pointer'
      }}
    >
      U
    </div>
  );
}

export default function AppLayout() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg)',
      overflow: 'hidden'
    }}>
      {/* TITLEBAR */}
      <div style={{
        height: '52px',
        background: 'var(--titlebar-bg)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '8px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100
      }}>
        {/* Traffic light dots */}
        <div style={{display:'flex',gap:'6px',marginRight:'8px'}}>
          <div style={{width:12,height:12,borderRadius:'50%',
            background:'#FF5F57',border:'0.5px solid rgba(0,0,0,0.15)'}} />
          <div style={{width:12,height:12,borderRadius:'50%',
            background:'#FEBC2E',border:'0.5px solid rgba(0,0,0,0.15)'}} />
          <div style={{width:12,height:12,borderRadius:'50%',
            background:'#28C840',border:'0.5px solid rgba(0,0,0,0.15)'}} />
        </div>

        {/* App name centered */}
        <div className="serif" style={{
          position:'absolute', left:'50%',
          transform:'translateX(-50%)',
          fontSize:'18px', fontWeight:600,
          color:'var(--text)',
          letterSpacing: '-0.02em'
        }}>
          Require<span style={{ color: 'var(--blue)' }}>AI</span>
        </div>

        {/* Right side: theme toggle + user */}
        <div style={{
          marginLeft:'auto', display:'flex',
          alignItems:'center', gap:'8px'
        }}>
          <ThemeToggle />
          <UserAvatar />
        </div>
      </div>

      {/* BODY: sidebar + content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
          padding: '24px 28px',
          position: 'relative'
        }}>
          <Outlet />
          <CopilotFAB />
        </main>
      </div>
    </div>
  );
}
