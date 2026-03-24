import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Search, Trash2, RotateCcw } from 'lucide-react';
import NewProjectModal from '../components/NewProjectModal';
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

const PROJECT_COLORS = [
  '#818CF8','#10B981','#A855F7','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6',
];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchAll = async () => {
    const { data: projs } = await supabase
      .from('projects')
      .select(`*, extraction_runs(current_phase, total_chunks, processed_chunks, status)`)
      .order('created_at', { ascending: false });
    if (projs) setProjects(projs);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleProjectCreated = (id: string) => {
    setShowModal(false);
    navigate(`/upload/${id}`);
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
      <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginRight: 16 }}>All Projects</span>
        <div style={{ flex: 1, position: 'relative', maxWidth: 400 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input className="mac-input" placeholder="Search projects by name…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, height: 32, fontSize: 13, width: '100%' }} />
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)} style={{ height: 32 }}>
          <Plus size={14} /> New Project
        </button>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="mac-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Project Repository</span>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>{filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} found</span>
          </div>

          {filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>
              No projects match your search criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredProjects.map((p, i) => {
                const run = p.extraction_runs?.[0];
                const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
                const progress = run?.total_chunks ? Math.round((run.processed_chunks / run.total_chunks) * 100) : (p.status === 'ready' ? 100 : 0);
                const statusColor = ({ ready: '#10B981', processing: '#6366F1', draft: '#8585A0', failed: '#EF4444' } as any)[p.status] || '#8585A0';
                
                return (
                  <div key={p.id} className="flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition-all group relative border border-white/5">
                    <div onClick={() => navigate(`/upload/${p.id}`)} className="flex items-center gap-6 flex-1 cursor-pointer">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600 }} className="group-hover:text-indigo-400 transition-colors">{p.name}</span>
                        {p.description && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.description}</span>}
                      </div>

                      <div style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text2)', fontWeight: 600 }}>
                          <span>Pipeline Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #818CF8)` }} />
                        </div>
                      </div>

                      <span style={{ minWidth: 80, textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color: statusColor, background: `${statusColor}15`, textTransform: 'uppercase' }}>
                        {p.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from('projects').update({ status: 'draft' }).eq('id', p.id);
                          navigate(`/upload/${p.id}`);
                        }}
                        className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        title="Rerun Project Pipeline"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to completely delete this project and all its generated documents?')) {
                            await supabase.from('projects').delete().eq('id', p.id);
                            fetchAll();
                          }
                        }}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete Project permanently"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleProjectCreated} />}
    </motion.div>
  );
}
