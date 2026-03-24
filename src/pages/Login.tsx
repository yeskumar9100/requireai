import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, y: 0,
    transition: { duration: 0.25, ease: [0.2,0,0,1] as any }
  },
  exit: { opacity: 0, y: -8 }
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter email and password.");
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    let result;
    if (isSignUp) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    
    setLoading(false);

    if (result.error) {
      setErrorMsg(result.error.message);
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
    
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}
    >
      <div className="mac-card" style={{ width: 380, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
           <h2 className="mac-page-title" style={{ fontSize: 24, marginBottom: 8 }}>{isSignUp ? "Create an Account" : "Welcome Back"}</h2>
           <p className="mac-secondary">Sign in to RequireAI Agent</p>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239,68,68,0.1)", color: "var(--red)", padding: "12px", borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, 
            padding: '10px', borderRadius: 8, background: 'var(--bg2)', 
            border: '0.5px solid var(--border)', color: 'var(--text)', 
            fontWeight: 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
          }}
          className="hover:bg-[var(--selected)]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238598)">
              <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
              <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.369 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
              <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
              <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
            </g>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
           <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
           <span style={{ fontSize: 12, color: 'var(--text2)' }}>or continue with email</span>
           <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
              className="mac-input" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Email address"
              required
          />
          <input 
              className="mac-input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password"
              required
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? "Authenticating..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span 
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ color: 'var(--blue)', cursor: 'pointer', fontWeight: 500 }}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
