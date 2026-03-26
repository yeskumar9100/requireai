import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { adminLogout } from '../lib/admin-auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'overview' | 'keys' | 'logs' | 'system';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>({ users: 0, projects: 0, runs: 0, brds: 0 });
  const [providers, setProviders] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === 'overview') {
      const { count: projects } = await supabase.from('projects').select('*', { count: 'exact', head: true });
      const { count: runs } = await supabase.from('extraction_runs').select('*', { count: 'exact', head: true });
      const { count: brds } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('type', 'BRD');
      const { count: reqs } = await supabase.from('requirements').select('*', { count: 'exact', head: true });
      setStats({ projects, runs, brds, reqs });
    } else if (activeTab === 'keys') {
      const { data } = await supabase.from('ai_providers').select('*').order('priority', { ascending: true });
      setProviders(data || []);
    } else if (activeTab === 'logs') {
      const { data } = await supabase.from('extraction_runs').select('*, projects(name)').order('started_at', { ascending: false }).limit(50);
      setRuns(data || []);
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 280, borderRight: '1px solid var(--border)', padding: '32px 24px', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 48, letterSpacing: '-1px' }}>
          Require<span style={{ color: 'var(--blue)' }}>AI</span> <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 400 }}>Admin</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon="" label="Overview" />
          <NavButton active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} icon="" label="API Key Management" />
          <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon="" label="Pipeline Logs" />
          <NavButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon="" label="System Config" />
        </div>

        <button onClick={handleLogout} style={{ 
          marginTop: 'auto', padding: '12px', background: 'transparent', border: '1px solid var(--border)', 
          borderRadius: 8, color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontWeight: 600 
        }}>
          Logout Session
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <button onClick={fetchData} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Refresh Data</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && <OverviewTab stats={stats} />}
            {activeTab === 'keys' && <KeysTab providers={providers} onUpdate={fetchData} />}
            {activeTab === 'logs' && <LogsTab runs={runs} />}
            {activeTab === 'system' && <SystemTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: 'none',
      background: active ? 'var(--blue)' : 'transparent', color: active ? 'white' : 'var(--text2)',
      cursor: 'pointer', transition: '0.2s', width: '100%', textAlign: 'left', fontSize: 14, fontWeight: active ? 600 : 500
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

function OverviewTab({ stats }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
      <StatCard label="Total Projects" value={stats.projects} icon="" />
      <StatCard label="Successful Runs" value={stats.runs} icon="" />
      <StatCard label="Documents Generated" value={stats.brds} icon="" />
      <StatCard label="Requirements Found" value={stats.reqs} icon="" />
    </div>
  );
}

function StatCard({ label, value, icon }: any) {
  return (
    <div style={{ background: 'var(--bg2)', padding: 24, borderRadius: 20, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value || 0}</div>
    </div>
  );
}

function KeysTab({ providers, onUpdate }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState<any>({ name: '', provider: 'gemini', model: '', api_key: '', enabled: true, priority: 1, base_url: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('ai_providers').insert([newProvider]);
    setShowAdd(false);
    onUpdate();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase.from('ai_providers').update({ enabled: !enabled }).eq('id', id);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      await supabase.from('ai_providers').delete().eq('id', id);
      onUpdate();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <p style={{ color: 'var(--text2)' }}>Manage the AI models and API keys used by the application pipeline.</p>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Provider</button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg2)', padding: 24, borderRadius: 20, border: '1px solid var(--blue)', marginBottom: 24 }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <input placeholder="Name (e.g. Gemini Primary)" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} style={inputStyle} required />
            <select value={newProvider.provider} onChange={e => setNewProvider({...newProvider, provider: e.target.value})} style={inputStyle}>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="nvidia">NVIDIA</option>
            </select>
            <input placeholder="Model ID (e.g. gemini-2.0-flash)" value={newProvider.model} onChange={e => setNewProvider({...newProvider, model: e.target.value})} style={inputStyle} required />
            <input placeholder="API Key" type="password" value={newProvider.api_key} onChange={e => setNewProvider({...newProvider, api_key: e.target.value})} style={inputStyle} required />
            <input placeholder="Priority (1-10)" type="number" value={newProvider.priority} onChange={e => setNewProvider({...newProvider, priority: parseInt(e.target.value)})} style={inputStyle} />
            <input placeholder="Base URL (Optional)" value={newProvider.base_url} onChange={e => setNewProvider({...newProvider, base_url: e.target.value})} style={inputStyle} />
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12 }}>
              <button type="submit" className="btn-primary">Save Provider</button>
              <button type="button" onClick={() => setShowAdd(false)} style={cancelStyle}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {providers.map((p: any) => (
          <div key={p.id} style={{ background: 'var(--bg2)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</span>
                <span style={{ fontSize: 11, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{p.provider}</span>
                {!p.enabled && <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>DISABLED</span>}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Model: {p.model} | Priority: {p.priority}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handleToggle(p.id, p.enabled)} style={{ ...actionBtnStyle, color: p.enabled ? 'var(--red)' : 'var(--green)' }}>{p.enabled ? 'Disable' : 'Enable'}</button>
              <button onClick={() => handleDelete(p.id)} style={{ ...actionBtnStyle, color: 'var(--text3)' }}>Delete</button>
            </div>
          </div>
        ))}
        {providers.length === 0 && <div style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border)', borderRadius: 16, color: 'var(--text3)' }}>No providers configured. Using .env fallbacks.</div>}
      </div>
    </div>
  );
}

function LogsTab({ runs }: any) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Project</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Phase</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r: any) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={tdStyle}>{r.projects?.name || 'Unknown'}</td>
              <td style={tdStyle}>
                <span style={{ 
                  padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                  background: r.status === 'complete' ? 'rgba(16,185,129,0.1)' : r.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                  color: r.status === 'complete' ? 'var(--green)' : r.status === 'failed' ? 'var(--red)' : 'var(--blue)'
                }}>
                  {r.status.toUpperCase()}
                </span>
              </td>
              <td style={tdStyle}>Phase {r.current_phase}/9</td>
              <td style={tdStyle}>{new Date(r.started_at).toLocaleString()}</td>
              <td style={tdStyle}>{Math.round((r.processed_chunks / (r.total_chunks || 1)) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SystemTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--bg2)', padding: 32, borderRadius: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 24 }}>Environment Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, fontSize: 14 }}>
          <div style={{ fontWeight: 600, color: 'var(--text3)' }}>App Version</div>
          <div>v2.4.0-stable</div>
          <div style={{ fontWeight: 600, color: 'var(--text3)' }}>Supabase URL</div>
          <div style={{ fontFamily: 'monospace' }}>{import.meta.env.VITE_SUPABASE_URL}</div>
          <div style={{ fontWeight: 600, color: 'var(--text3)' }}>Mode</div>
          <div>{import.meta.env.DEV ? 'Development' : 'Production'}</div>
          <div style={{ fontWeight: 600, color: 'var(--text3)' }}>Client IP</div>
          <div style={{ color: 'var(--blue)' }}>Internal Mesh v4</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', padding: 32, borderRadius: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 16, color: 'var(--red)' }}>Danger Zone</h3>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>Critical system actions that affect the entire application state.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button style={{ background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', padding: '10px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Reset Global Cache</button>
          <button style={{ background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', padding: '10px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Wipe System Logs</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 16px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none'
};

const cancelStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 20px',
  color: 'var(--text)',
  cursor: 'pointer'
};

const actionBtnStyle = {
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '4px 8px'
};

const thStyle: any = { textAlign: 'left', padding: '16px 20px', color: 'var(--text3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' };
const tdStyle: any = { padding: '16px 20px', borderBottom: '1px solid var(--border)' };
