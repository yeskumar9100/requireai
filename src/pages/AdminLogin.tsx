import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../lib/admin-auth';
import { motion } from 'framer-motion';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const success = await adminLogin(password);
    if (success) {
      navigate('/admin');
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: 24
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 40,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ 
          fontSize: 32, 
          fontWeight: 800, 
          letterSpacing: '-1px', 
          color: 'var(--text)',
          marginBottom: 8
        }}>
          Require<span style={{ color: 'var(--blue)' }}>AI</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32 }}>Admin Portal</div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 8, marginLeft: 4 }}>ADMIN PASSWORD</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--bg3)',
                border: error ? '1px solid var(--red)' : '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text)',
                fontSize: 16,
                outline: 'none',
              }}
              autoFocus
            />
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8, marginLeft: 4 }}>Invalid password. Please try again.</div>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: 15, 
              fontWeight: 600,
              marginTop: 8
            }}
          >
            {loading ? 'Authenticating...' : 'Access Terminal'}
          </button>
        </form>
      </motion.div>

      <button 
        onClick={() => navigate('/dashboard')}
        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}
      >
        Back to App
      </button>
    </div>
  );
}
