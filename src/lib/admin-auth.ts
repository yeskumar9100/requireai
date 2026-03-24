import { supabase } from './supabase';

const ADMIN_TOKEN_KEY = 'requireai_admin_token';

export async function adminLogin(password: string): Promise<boolean> {
  try {
    const { data: config, error } = await supabase
      .from('admin_config')
      .select('password_hash')
      .maybeSingle(); // Better than .single() as it won't error if 0 rows

    if (error) {
      if (error.code === 'PGRST116') {
        console.error('Admin config table found but empty');
      } else {
        console.error('Database error:', error.message, error.details);
      }
      return false;
    }

    if (!config) {
      console.error('Admin config not found in database. Make sure you ran the SQL setup in Supabase.');
      return false;
    }

    if (config.password_hash === password) {
      const token = btoa(JSON.stringify({ isAdmin: true, timestamp: Date.now() }));
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('Unexpected Login error:', err.message);
    return false;
  }
}

export function isAdminLoggedIn(): boolean {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return false;
  
  try {
    const parsed = JSON.parse(atob(token));
    const age = Date.now() - parsed.timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      adminLogout();
      return false;
    }
    return parsed.isAdmin === true;
  } catch {
    return false;
  }
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}
