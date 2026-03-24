import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = (supaUser: any): AuthUser => ({
    id: supaUser.id,
    email: supaUser.email || '',
    user_metadata: supaUser.user_metadata || {}
  } as any);

  useEffect(() => {
    const init = async () => {
      // Check existing session
      const { data } = await supabase.auth.getSession();
      
      if (data.session?.user) {
        setUser(data.session.user as any);
      } else {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Error signing in anonymously:", error);
      }
      setLoading(false);
    };

    init();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) console.error("Error creating new anonymous session:", error);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
