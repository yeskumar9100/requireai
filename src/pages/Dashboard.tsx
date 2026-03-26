import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { supabase } from '../lib/supabase';
import {
  Plus, Search, Zap, TrendingUp, TrendingDown,
  Users, FileText, AlertTriangle, Activity, Sparkles, Trash2, RotateCcw
} from 'lucide-react';

import NewProjectModal from '../components/NewProjectModal';
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

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
  const [projectStatusData, setProjectStatusData] = useState<any[]>([]);
  const [weeklyActivityData, setWeeklyActivityData] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const channelRef                = useRef<any>(null);

  const fetchAll = async () => {
    const { data: projs, error } = await supabase
      .from('projects')
      .select(`*, extraction_runs(current_phase, total_chunks, processed_chunks, status)`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching projects:", error);
    }
    
    if (projs) setProjects(projs);

    const pid = selectedProject !== 'all' ? selectedProject : undefined;
    const reqQ = pid ? supabase.from('requirements').select('*', { count: 'exact', head: true }).eq('project_id', pid) : supabase.from('requirements').select('*', { count: 'exact', head: true });
    const stkQ = pid ? supabase.from('stakeholders').select('*', { count: 'exact', head: true }).eq('project_id', pid) : supabase.from('stakeholders').select('*', { count: 'exact', head: true });
    const decQ = pid ? supabase.from('decisions').select('*', { count: 'exact', head: true }).eq('project_id', pid) : supabase.from('decisions').select('*', { count: 'exact', head: true });
    const conQ = pid ? supabase.from('conflicts').select('*', { count: 'exact', head: true }).eq('project_id', pid) : supabase.from('conflicts').select('*', { count: 'exact', head: true });

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

    // Calculate Project Status Data
    if (projs) {
      let ready = 0;
      let processing = 0;
      let draft = 0;
      projs.forEach(p => {
        if (p.status === 'ready') ready++;
        else if (p.status === 'processing' || p.status === 'extracting') processing++;
        else draft++;
      });
      setProjectStatusData([
        { name: 'Completed', value: ready, fill: '#10B981' },
        { name: 'Processing', value: processing, fill: '#6366F1' },
        { name: 'Draft', value: draft, fill: '#8585A0' }
      ].filter(entry => entry.value > 0));
    }

    // Calculate Weekly Activity Data
    const weeklyStart = new Date();
    weeklyStart.setDate(weeklyStart.getDate() - 7);
    const { data: recentReqs } = await supabase
      .from('requirements')
      .select('created_at')
      .gte('created_at', weeklyStart.toISOString())
      .order('created_at', { ascending: true });
    
    if (recentReqs) {
      const days: Record<string, number> = {};
      // Initialize last 7 days to 0
      for (let i = 6; i >= 0; i--) {
        const tempDate = new Date();
        tempDate.setDate(tempDate.getDate() - i);
        days[tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
      }
      recentReqs.forEach(req => {
        const dateStr = new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (days[dateStr] !== undefined) {
          days[dateStr]++;
        }
      });
      setWeeklyActivityData(Object.entries(days).map(([date, count]) => ({ date, count })));
    }
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
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Dashboard</span>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Project
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 52, opacity: 0.2 }}>—</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>Start Your Intelligence Journey</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Redefine your requirements process with AI agents.</div>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12, height: 40 }}>
            <Plus size={16} /> Create Your First Project
          </button>
        </div>
        {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleProjectCreated} />}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
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
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Project Status</div>
            {projectStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>No projects yet</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="mac-card">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>Requirements Extractions (7 Days)</div>
            {weeklyActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyActivityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Area type="monotone" dataKey="count" stroke="#10B981" fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>No activity data yet</div>
            )}
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
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group relative">
                    <div onClick={() => navigate(`/upload/${p.id}`)} className="flex items-center gap-4 flex-1 cursor-pointer">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }} className="group-hover:text-indigo-400 transition-colors">{p.name}</span>
                      <div style={{ width: 120 }}>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #818CF8)` }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color: statusColor, background: `${statusColor}15`, textTransform: 'uppercase' }}>{p.status}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this project? All data (requirements, BRD, etc.) will be permanently removed.')) {
                            // Cascade delete all related data first
                            const pid = p.id;
                            await Promise.all([
                              supabase.from('requirements').delete().eq('project_id', pid),
                              supabase.from('stakeholders').delete().eq('project_id', pid),
                              supabase.from('decisions').delete().eq('project_id', pid),
                              supabase.from('timeline_events').delete().eq('project_id', pid),
                              supabase.from('conflicts').delete().eq('project_id', pid),
                              supabase.from('documents').delete().eq('project_id', pid),
                              supabase.from('chat_messages').delete().eq('project_id', pid),
                              supabase.from('sources').delete().eq('project_id', pid),
                            ]);
                            // Delete extraction runs and their logs
                            const { data: runs } = await supabase.from('extraction_runs').select('id').eq('project_id', pid);
                            if (runs && runs.length > 0) {
                              await Promise.all(runs.map(r => supabase.from('agent_logs').delete().eq('extraction_run_id', r.id)));
                              await supabase.from('extraction_runs').delete().eq('project_id', pid);
                            }
                            // Finally delete the project
                            await supabase.from('projects').delete().eq('id', pid);
                            fetchAll();
                          }
                        }}
                        className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from('projects').update({ status: 'draft' }).eq('id', p.id);
                          navigate(`/upload/${p.id}`);
                        }}
                        className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        title="Rerun Project Pipeline"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
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
    </motion.div>
  );
}
