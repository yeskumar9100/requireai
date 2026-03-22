import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, animate } from "framer-motion";
import { Zap, FileSearch, CheckSquare, AlertTriangle, FileText, Network } from "lucide-react";

const ParticleCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9F0A', '#FF3B30', '#5AC8FA'];
    let mouse = { x: -1000, y: -1000 };
    
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random()
      });
    }

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for(let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for(let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        p.opacity += Math.sin(Date.now() / 1000 + i) * 0.01;
        if (p.opacity > 1) p.opacity = 1;
        if (p.opacity < 0.2) p.opacity = 0.2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255,255,255,${0.15 - (dist/100)*0.15})`;
            ctx.stroke();
          }
        }

        const dxMouse = p.x - mouse.x;
        const dyMouse = p.y - mouse.y;
        const distMouse = Math.sqrt(dxMouse*dxMouse + dyMouse*dyMouse);
        if (distMouse < 150) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255,255,255,${0.3 - (distMouse/150)*0.3})`;
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, background: '#000000', pointerEvents: 'auto' }} />;
};

const Counter = ({ to, suffix = "", duration = 2 }: { to: number, suffix?: string, duration?: number }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(nodeRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (inView && nodeRef.current) {
      const controls = animate(0, to, {
        duration,
        ease: "easeOut",
        onUpdate: (value) => {
          if (nodeRef.current) {
            nodeRef.current.textContent = Math.round(value).toString() + suffix;
          }
        }
      });
      return controls.stop;
    }
  }, [inView, to, suffix, duration]);

  return <span ref={nodeRef}>0{suffix}</span>;
}

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: FileSearch, color: '#007AFF', bg: 'rgba(0,122,255,0.15)', title: 'Multi-source ingestion', desc: 'Upload emails, meeting transcripts, and chat logs' },
    { icon: Zap, color: '#34C759', bg: 'rgba(52,199,89,0.15)', title: '9-phase AI pipeline', desc: 'Specialized agents handle every extraction task' },
    { icon: Network, color: '#AF52DE', bg: 'rgba(175,82,222,0.15)', title: 'Knowledge graph', desc: 'Visual map linking requirements to sources' },
    { icon: AlertTriangle, color: '#FF3B30', bg: 'rgba(255,59,48,0.15)', title: 'Conflict detection', desc: 'Catch contradictions before they cost you' },
    { icon: CheckSquare, color: '#FF9F0A', bg: 'rgba(255,159,10,0.15)', title: 'Full traceability', desc: 'Every requirement links to source evidence' },
    { icon: FileText, color: '#5AC8FA', bg: 'rgba(90,200,250,0.15)', title: 'One-click export', desc: 'PDF, Markdown, or DOCX with full appendix' },
  ];

  const phases = [
    { name: 'Project Coordinator', agent: 'Coordinator Agent', bg: '#007AFF' },
    { name: 'Document Parser', agent: 'Parser Agent', bg: '#007AFF' },
    { name: 'Relevance Scorer', agent: 'Filter Agent', bg: '#34C759' },
    { name: 'Requirements Extractor', agent: 'Extraction Agent', bg: '#34C759' },
    { name: 'Stakeholder Mapper', agent: 'People Agent', bg: '#34C759' },
    { name: 'Decision Tracker', agent: 'Decision Agent', bg: '#FF9F0A' },
    { name: 'Timeline Builder', agent: 'Timeline Agent', bg: '#FF9F0A' },
    { name: 'Conflict Detector', agent: 'Conflict Agent', bg: '#FF3B30' },
    { name: 'Document Generator', agent: 'BRD Agent', bg: '#AF52DE' },
  ];

  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif]">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 flex items-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', height: '52px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
          <div className="text-white font-bold text-lg cursor-pointer" onClick={() => navigate('/dashboard')}>
            Require<span style={{ color: '#007AFF' }}>AI</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm text-white/70">
            <a href="#" className="hover:text-white transition-colors">Features</a>
            <a href="#" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#" className="hover:text-white transition-colors">Docs</a>
          </div>
          <button onClick={() => navigate('/dashboard')} className="transition-opacity hover:opacity-85 active:opacity-75" style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 500 }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* SECTION 1 - ANIMATED PARTICLE HERO */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center pt-[52px]" style={{ zIndex: 1 }}>
        <ParticleCanvas />
        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center w-full h-full pointer-events-none">
          <div className="mb-8 p-[1px] rounded-[20px] inline-block pointer-events-auto" style={{ background: 'rgba(0,122,255,0.4)' }}>
             <div className="flex items-center gap-2 px-4 py-1.5 rounded-[20px]" style={{ background: 'rgba(0,122,255,0.15)' }}>
               <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 rounded-full" style={{ background: '#007AFF', boxShadow: '0 0 8px #007AFF' }} />
               <span className="text-sm font-medium text-blue-100">Powered by Claude + Gemini</span>
             </div>
          </div>
          
          <h1 className="serif text-[42px] md:text-[72px] font-bold text-white tracking-[-0.03em] leading-[1.1] mb-6 max-w-4xl pointer-events-auto">
            Turn business chaos <br className="hidden md:block"/>
            into clear <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">requirements</span>
          </h1>
          
          <p className="text-[18px] text-[rgba(255,255,255,0.6)] max-w-2xl mb-10 pointer-events-auto">
            9 AI agents extract requirements, stakeholders, and decisions from your emails, meetings, and chats
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pointer-events-auto">
            <button onClick={() => navigate('/dashboard')} className="btn-primary !h-[52px] !px-10 !text-[16px] !rounded-xl">
              Start for free
            </button>
            <button style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '14px 32px', fontSize: '15px', fontWeight: 500 }} className="hover:bg-white/5 transition-colors active:scale-95">
              See how it works
            </button>
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60 pointer-events-auto">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
               <div className="w-2 h-2 rounded-full bg-white/80" />
            </motion.div>
            <span className="text-[10px] text-white/80 uppercase tracking-widest font-semibold">Scroll</span>
          </div>
        </div>
      </section>

      {/* SECTION 2 - STATS BAR */}
      <section className="relative z-10 py-16 grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-4 px-8 text-center" style={{ background: '#0A0A0A', borderTop: '0.5px solid #1C1C1E', borderBottom: '0.5px solid #1C1C1E' }}>
        <div className="flex flex-col items-center"><div className="text-[40px] font-bold" style={{ color: '#007AFF' }}><Counter to={9}/></div><div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-1 tracking-wide">AI Agents</div></div>
        <div className="flex flex-col items-center"><div className="text-[40px] font-bold" style={{ color: '#007AFF' }}><Counter to={500} suffix="+"/></div><div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-1 tracking-wide">Documents Processed</div></div>
        <div className="flex flex-col items-center"><div className="text-[40px] font-bold" style={{ color: '#007AFF' }}><Counter to={12}/></div><div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-1 tracking-wide">Data Tables</div></div>
        <div className="flex flex-col items-center"><div className="text-[40px] font-bold" style={{ color: '#007AFF' }}><Counter to={3}/></div><div className="text-[12px] text-[rgba(255,255,255,0.5)] mt-1 tracking-wide">Export Formats</div></div>
      </section>

      {/* SECTION 3 - FEATURES GRID */}
      <section className="py-24 px-6 md:px-12 lg:px-24 relative" style={{ background: '#000000' }}>
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-indigo-400 bg-indigo-500/10 text-[10px] font-bold uppercase tracking-[0.15em] mb-4 border border-indigo-500/20">Platform Abilities</span>
            <h2 className="serif text-4xl md:text-5xl font-bold text-white mb-6">Everything a BRD needs</h2>
            <p className="text-[18px] text-white/50 max-w-2xl mx-auto">From raw noise to structured intelligence, powered by agentic workflows.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group relative"
                style={{ background: '#0D0D0F', border: '0.5px solid #1C1C1E', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,122,255,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1C1C1E'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: f.bg }}>
                  <f.icon style={{ color: f.color }} size={24} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-[rgba(255,255,255,0.6)] text-[14px] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - PIPELINE VISUALIZATION */}
      <section className="py-24 px-6 md:px-12 lg:px-24 relative" style={{ background: '#040404' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">AI Analysis Pipeline</h2>
          </div>
          
          <div className="relative pl-6 md:pl-12 py-4">
            {/* Gradient timeline line */}
            <div className="absolute left-[38px] md:left-[62px] top-[16px] bottom-[16px] w-[3px]" style={{ background: 'linear-gradient(to bottom, #007AFF, #34C759, #FF9F0A, #FF3B30, #AF52DE)', borderRadius: '2px', opacity: 0.4 }} />
            
            {phases.map((phase, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="flex items-center gap-6 mb-8 relative z-10"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-2xl overflow-hidden relative" style={{ background: '#111118', border: '1px solid var(--border)' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-500/20" />
                  <span className="relative z-10">{i + 1}</span>
                </div>
                <div className="mac-card mac-card-hover flex-1 flex items-center justify-between !py-4">
                  <div>
                    <h4 className="text-white font-semibold text-[15px]">{phase.name}</h4>
                    <p className="text-white/40 font-medium text-[12px]">{phase.agent}</p>
                  </div>
                  <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: `${phase.bg}40`, color: phase.bg, background: `${phase.bg}10` }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: phase.bg, boxShadow: `0 0 8px ${phase.bg}` }}></div>
                    Ready
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 - SAMPLE BRD PREVIEW */}
      <section className="py-24 px-6 md:px-12 lg:px-24 relative overflow-hidden" style={{ background: '#000000' }}>
        <div className="max-w-[900px] mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Production-Ready Output</h2>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="rounded-[16px] overflow-hidden shadow-[0_0_40px_rgba(0,122,255,0.1)]" 
            style={{ border: '0.5px solid #1C1C1E', background: '#0D0D0F' }}
          >
            {/* Mac Titlebar */}
            <div className="px-4 py-3 flex items-center" style={{ background: '#1C1C1E', borderBottom: '1px solid #2C2C2E' }}>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28C840]"></div>
              </div>
              <div className="flex-1 text-center font-medium text-[13px] text-white/70">Sample BRD — E-Commerce Redesign</div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] whitespace-nowrap min-w-[700px]">
                <thead className="text-[rgba(255,255,255,0.5)] border-b border-[#1C1C1E] bg-[#0A0A0C]">
                  <tr>
                    <th className="py-4 px-6 font-medium uppercase tracking-wider text-[11px]">ID</th>
                    <th className="py-4 px-6 font-medium uppercase tracking-wider text-[11px]">Requirement</th>
                    <th className="py-4 px-6 font-medium uppercase tracking-wider text-[11px]">Priority</th>
                    <th className="py-4 px-6 font-medium uppercase tracking-wider text-[11px]">Category</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr style={{ background: '#0D0D0F', borderBottom: '0.5px solid #1C1C1E' }}>
                    <td className="py-4 px-6 font-semibold" style={{ color: '#007AFF' }}>REQ-001</td>
                    <td className="py-4 px-6 font-medium text-[13px]">OAuth login via Google and GitHub</td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#FF3B30]/20 text-[#FF3B30]">High</span></td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#007AFF]/20 text-[#007AFF]">Functional</span></td>
                  </tr>
                  <tr style={{ background: '#0D0D0F', borderBottom: '0.5px solid #1C1C1E' }}>
                    <td className="py-4 px-6 font-semibold" style={{ color: '#007AFF' }}>REQ-002</td>
                    <td className="py-4 px-6 font-medium text-[13px]">Handle 10,000 concurrent users</td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#FF3B30]/20 text-[#FF3B30]">High</span></td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#AF52DE]/20 text-[#AF52DE]">Performance</span></td>
                  </tr>
                  <tr style={{ background: '#0D0D0F', borderBottom: '0.5px solid #1C1C1E' }}>
                    <td className="py-4 px-6 font-semibold" style={{ color: '#007AFF' }}>REQ-003</td>
                    <td className="py-4 px-6 font-medium text-[13px]">Fully responsive on mobile</td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#34C759]/20 text-[#34C759]">Medium</span></td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#FF9F0A]/20 text-[#FF9F0A]">Non-functional</span></td>
                  </tr>
                  <tr style={{ background: '#0D0D0F' }}>
                    <td className="py-4 px-6 font-semibold" style={{ color: '#007AFF' }}>REQ-004</td>
                    <td className="py-4 px-6 font-medium text-[13px]">API response under 200ms at p95</td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#FF3B30]/20 text-[#FF3B30]">High</span></td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold tracking-wide bg-[#AF52DE]/20 text-[#AF52DE]">Performance</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 - CTA BANNER */}
      <section className="py-32 px-6 text-center" style={{ background: '#007AFF' }}>
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-[40px] font-bold text-white mb-6 leading-tight tracking-[-1px]">Ready to write your AI-powered BRD?</h2>
          <p className="text-[20px] text-white/90 mb-10 font-medium">Free to use. No credit card required.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-white text-[#007AFF] font-bold py-[14px] px-[32px] rounded-[10px] text-[16px] shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
            Get started for free
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 md:px-12 flex flex-col sm:flex-row justify-between items-center gap-6" style={{ background: '#000000', borderTop: '0.5px solid #1C1C1E' }}>
        <div className="text-white hidden sm:block font-bold text-[16px] cursor-pointer" onClick={() => navigate('/')}>
          Require<span style={{ color: '#007AFF' }}>AI</span>
        </div>
        <div className="text-[rgba(255,255,255,0.5)] text-[13px] text-center font-medium">
          Powered by Anthropic Claude + Google Gemini
        </div>
      </footer>
    </div>
  );
}
