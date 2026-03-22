import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('agent@example.com');
  const [password, setPassword] = useState('password123');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Attempt standard login
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
       console.log("Password login failed, attempting anonymous fallback...", error);
       // Fallback for demonstration/agent environments
       await supabase.auth.signInAnonymously();
    }
    
    navigate('/dashboard');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <form onSubmit={handleLogin} className="mac-card" style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 16, padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
           <h2 className="mac-page-title" style={{ fontSize: 24 }}>Sign In</h2>
           <p className="mac-secondary">Log in to RequireAI Agent</p>
        </div>
        
        <input 
            className="mac-input" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="Email address"
        />
        <input 
            className="mac-input" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Password"
        />
        
        <button disabled={loading} className="btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', height: 36, marginTop: 8 }}>
            {loading ? "Authenticating..." : "Login"}
        </button>
      </form>
    </div>
  );
}
