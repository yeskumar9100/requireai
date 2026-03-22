import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user);
      } else {
        // Auth is not required, set a guest profile
        setUser({ id: 'guest', email: 'guest@example.com' });
      }
      setLoading(false);
    });

    const { data: listener } = 
      supabase.auth.onAuthStateChange((_, session) => {
        if (session) {
          setUser(session.user);
        } else {
          // Fallback to guest if explicitly signed out
          setUser({ id: 'guest', email: 'guest@example.com' });
        }
      });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center',
      justifyContent:'center', height:'100vh',
      background:'var(--bg)'
    }}>
      <div style={{
        width:20, height:20,
        border:'2px solid var(--border)',
        borderTopColor:'var(--blue)',
        borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }} />
    </div>
  );

  return user ? <>{children}</> : null;
}
