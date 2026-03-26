import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
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
  const { user } = useAuth();
  const initial = user?.email ? user.email[0].toUpperCase() : 'U';

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
      title={user?.email || 'Guest'}
    >
      {initial}
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
      <div className="no-print" style={{
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
        <div className="no-print"><Sidebar /></div>
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.04) 0%, transparent 60%)',
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
