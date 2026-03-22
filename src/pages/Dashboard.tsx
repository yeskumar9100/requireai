import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line
} from 'recharts';
import { supabase } from '../lib/supabase';
import {
  Plus, Search, X, Zap, TrendingUp, TrendingDown,
  Users, FileText, AlertTriangle, Activity, Sparkles
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PROJECT_COLORS = [
  '#818CF8','#10B981','#A855F7','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6',
];

const CATEGORY_COLORS: Record<string, string> = {
  Functional: '#6366F1', 'Non-functional': '#818CF8', Business: '#A855F7',
  Technical: '#10B981', Security: '#F59E0B', Performance: '#EF4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444', medium: '#F59E0B', low: '#10B981',
};

// ── tiny sparkline ────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = (data || []).map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── modal ─────────────────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError('Not logged in. Please sign in again.');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: desc.trim() || null,
        status: 'draft',
        user_id: user.id,
        requirement_count: 0,
        stakeholder_count: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !data?.id) {
      setError('Failed to create project: ' + (insertError?.message ?? 'No ID returned'));
      setLoading(false);
      return;
    }

    setLoading(false);
    onCreated(data.id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} style={{
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        borderRadius: 16, padding: 24, width: 400,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>New Project</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Project name *</label>
          <input
            className="mac-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Product Roadmap Q2"
            required
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Description</label>
          <textarea
            className="mac-input"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn-primary"
          style={{ justifyContent: 'center', height: 38, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading && (
            <div style={{
              width: 13, height: 13,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          )}
          {loading ? 'Creating…' : 'Create Project'}
        </button>
        <button type="button" onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text2)', fontSize: 13, textAlign: 'center',
        }}>
          Cancel
        </button>
        {error && (
          <div style={{
            fontSize: 12, color: '#EF4444',
            background: 'rgba(239,68,68,0.1)',
            border: '0.5px solid rgba(239,68,68,0.3)',
            borderRadius: 6, padding: '8px 12px',
          }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects]   = useState<any[]>([]);
  const [activity, setActivity]   = useState<any[]>([]);
  const [stats, setStats]         = useState({ requirements: 0, stakeholders: 0, decisions: 0, conflicts: 0 });
  
  const [sparklines] = useState<Record<string, number[]>>({
    requirements: [2,3,5,4,8,10,12],
    stakeholders: [1,2,2,3,4,4,5],
    decisions:    [0,1,2,2,3,5,4],
    conflicts:    [3,2,4,3,5,4,6],
  });

  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const channelRef                = useRef<any>(null);

  const fetchAll = async () => {
    const { data: projs } = await supabase
      .from('projects')
      .select(`*, extraction_runs(current_phase, total_chunks, processed_chunks, status)`)
      .order('created_at', { ascending: false });
    if (projs) setProjects(projs);

    const pid = selectedProject !== 'all' ? selectedProject : undefined;
    const reqQ = pid ? supabase.from('requirements').select('id', { count: 'exact' }).eq('project_id', pid) : supabase.from('requirements').select('id', { count: 'exact' });
    const stkQ = pid ? supabase.from('stakeholders').select('id', { count: 'exact' }).eq('project_id', pid) : supabase.from('stakeholders').select('id', { count: 'exact' });
    const decQ = pid ? supabase.from('decisions').select('id', { count: 'exact' }).eq('project_id', pid) : supabase.from('decisions').select('id', { count: 'exact' });
    const conQ = pid ? supabase.from('conflicts').select('id', { count: 'exact' }).eq('project_id', pid) : supabase.from('conflicts').select('id', { count: 'exact' });

    const [r, s, d, c] = await Promise.all([reqQ, stkQ, decQ, conQ]);
    setStats({
      requirements: r.count ?? 0,
      stakeholders: s.count ?? 0,
      decisions:    d.count ?? 0,
      conflicts:    c.count ?? 0,
    });

    const catSource = pid ? supabase.from('requirements').select('category').eq('project_id', pid) : supabase.from('requirements').select('category');
    const { data: catRows } = await catSource;
    if (catRows) {
      const map: Record<string, number> = {};
      catRows.forEach((row: any) => {
        const cat = row.category || 'Other';
        map[cat] = (map[cat] || 0) + 1;
      });
      setCategoryData(Object.entries(map).map(([name, count]) => ({
        name, count, fill: CATEGORY_COLORS[name] || '#6366F1',
      })));
    }

    const { data: logs } = await supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    if (logs) setActivity(logs);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('dashboard-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchAll)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, (payload) => {
        setActivity(prev => [payload.new, ...prev.slice(0, 14)]);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, []);

  useEffect(() => { fetchAll(); }, [selectedProject]);

  const handleProjectCreated = (id: string) => {
    setShowModal(false);
    navigate(`/upload/${id}`);
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: 'Requirements', value: stats.requirements, color: '#6366F1', icon: FileText, change: '+18 this week', changeColor: '#10B981', isUp: true, spark: sparklines.requirements },
    { label: 'Stakeholders', value: stats.stakeholders, color: '#10B981', icon: Users, change: '+5 this week', changeColor: '#10B981', isUp: true, spark: sparklines.stakeholders },
    { label: 'Decisions', value: stats.decisions, color: '#A855F7', icon: Zap, change: '+3 this week', changeColor: '#10B981', isUp: true, spark: sparklines.decisions },
    { label: 'Conflicts', value: stats.conflicts, color: '#EF4444', icon: AlertTriangle, change: '+2 need review', changeColor: '#EF4444', isUp: false, spark: sparklines.conflicts },
  ];

  if (projects.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Dashboard</span>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Project
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 52 }}>✨</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>Start Your Intelligence Journey</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Redefine your requirements process with AI agents.</div>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12, height: 40 }}>
            <Plus size={16} /> Create Your First Project
          </button>
        </div>
        {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleProjectCreated} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginRight: 16 }}>Dashboard</span>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '4px 10px', outline: 'none' }}>
          <option value="all">All Pipelines</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ flex: 1, position: 'relative', maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input className="mac-input" placeholder="Search pipelines…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, height: 32, fontSize: 12, width: '100%' }} />
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)} style={{ height: 32 }}>
          <Plus size={14} /> New
        </button>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="mac-card mac-card-hover !p-0">
                <div style={{ height: 2, background: `linear-gradient(90deg, ${card.color}, transparent)` }} />
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                    <Icon size={16} style={{ color: card.color }} />
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 8 }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: card.changeColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {card.isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                    {card.change}
                  </div>
                </div>
                <div style={{ marginTop: 0 }}><Sparkline data={card.spark} color={card.color} /></div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <div className="mac-card" style={{ background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-indigo-400" />
              </div>
              <span className="serif" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Proactive Intelligence</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-orange">Risk</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Requirement Conflict</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)' }}>REQ-042 contradicts ST-15 on platform scalability limits. Suggesting review.</p>
              </div>
              <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-blue">Insight</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Stakeholder Missing</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)' }}>Legal representative hasn't been mapped to data privacy requirements.</p>
              </div>
            </div>
          </div>

          <div className="mac-card">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Requirements by Category</div>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>No category data yet</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, paddingBottom: 24 }}>
          <div className="mac-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Active Pipelines</span>
              <button className="btn-primary !h-[28px] !text-[11px] !px-3" onClick={() => setShowModal(true)}>
                <Plus size={12} /> New Pipeline
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredProjects.map((p, i) => {
                const run = p.extraction_runs?.[0];
                const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
                const progress = run?.total_chunks ? Math.round((run.processed_chunks / run.total_chunks) * 100) : (p.status === 'ready' ? 100 : 0);
                const statusColor = ({ ready: '#10B981', processing: '#6366F1', draft: '#8585A0', failed: '#EF4444' } as any)[p.status] || '#8585A0';
                return (
                  <div key={p.id} onClick={() => navigate(`/upload/${p.id}`)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500 }} className="group-hover:text-indigo-400 transition-colors">{p.name}</span>
                    <div style={{ width: 120 }}>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #818CF8)` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color: statusColor, background: `${statusColor}15`, textTransform: 'uppercase' }}>{p.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mac-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Activity size={16} className="text-indigo-400" />
              <span className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Live Events</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 400 }}>
              {activity.map((log: any, i) => (
                <div key={log.id || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: PROJECT_COLORS[i % 8], marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{log.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{log.agent_name} · {timeAgo(log.created_at)}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>No live events yet.</div>}
            </div>
          </div>
        </div>
      </div>
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleProjectCreated} />}
    </div>
  );
}
