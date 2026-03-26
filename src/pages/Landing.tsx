import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const ParticleCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    const colors = ['#007AFF', '#5AC8FA', '#AF52DE', '#818CF8', '#A78BFA', '#E2E8F0'];
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
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

export default function Landing() {
  const navigate = useNavigate();

  const phases = [
    { name: 'Project Coordinator', agent: 'Coordinator Agent', bg: '#007AFF' },
    { name: 'Document Parser', agent: 'Parser Agent', bg: '#007AFF' },
    { name: 'Relevance Scorer', agent: 'Filter Agent', bg: '#5AC8FA' },
    { name: 'Requirements Extractor', agent: 'Extraction Agent', bg: '#5AC8FA' },
    { name: 'Stakeholder Mapper', agent: 'People Agent', bg: '#5AC8FA' },
    { name: 'Decision Tracker', agent: 'Decision Agent', bg: '#818CF8' },
    { name: 'Timeline Builder', agent: 'Timeline Agent', bg: '#818CF8' },
    { name: 'Conflict Detector', agent: 'Conflict Agent', bg: '#A78BFA' },
    { name: 'Document Generator', agent: 'BRD Agent', bg: '#AF52DE' },
  ];

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { 
      opacity: 1, y: 0,
      transition: { duration: 0.25, ease: [0.2,0,0,1] as any }
    },
    exit: { opacity: 0, y: -8 }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="bg-black min-h-screen text-white overflow-x-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif]"
    >
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 flex items-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', height: '52px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
          <div className="text-white font-bold text-lg cursor-pointer" onClick={() => navigate('/dashboard')}>
            Require<span style={{ color: '#007AFF' }}>AI</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm text-white/70">
          </div>
          <button onClick={() => navigate('/dashboard')} className="transition-opacity hover:opacity-85 active:opacity-75" style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 500 }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="relative w-full min-h-[85vh] flex flex-col items-center justify-center pt-[52px] pb-12" style={{ zIndex: 1 }}>
        <ParticleCanvas />
        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center w-full h-full pointer-events-none">
          <h1 className="serif text-[42px] md:text-[64px] font-bold text-white tracking-[-0.03em] leading-[1.1] mb-4 max-w-4xl pointer-events-auto">
            Turn your app idea <br className="hidden md:block"/>
            into a professional <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">blueprint</span>
          </h1>
          <p className="text-[18px] text-[rgba(255,255,255,0.6)] max-w-2xl mb-10 pointer-events-auto">
            Students, freelancers, and solo founders use RequireAI to turn raw ideas into structured plans — powered by 9 AI agents
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pointer-events-auto">
            <button onClick={() => navigate('/dashboard')} className="btn-primary !h-[52px] !px-10 !text-[16px] !rounded-xl">
              Try it — It's free
            </button>
            <button onClick={() => { const el = document.getElementById('how-it-works'); el?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '14px 32px', fontSize: '15px', fontWeight: 500 }} className="hover:bg-white/5 transition-colors active:scale-95">
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* 2. Pipeline circles row (existing) */}
      <section className="py-12 px-6 md:px-12 lg:px-24 relative" style={{ background: '#040404' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white">AI Analysis Pipeline</h2>
          </div>
          <div className="relative pl-6 md:pl-12 py-4">
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
                <div className="mac-card mac-card-hover flex-1 flex items-center justify-between !py-4" style={{ background: '#111118' }}>
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

      {/* 3. Component 7 - Live activity ticker */}
      <section style={{ position: 'relative', zIndex: 10,
        padding: '20px 0',
        background: '#0D0D14',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingLeft: 24,
          paddingRight: 24
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            background: 'rgba(6,182,212,0.1)',
            border: '0.5px solid rgba(6,182,212,0.25)',
            borderRadius: 6,
            padding: '5px 10px'
          }}>
            <div style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#06B6D4',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: '#06B6D4',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              Live
            </span>
          </div>

          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              display: 'flex',
              gap: 32,
              animation: 'tickerScroll 18s linear infinite',
              width: 'max-content'
            }}>
              {[
                'Team at Acme Corp extracted 124 requirements in 4 minutes',
                '3 conflicts auto-detected in Mobile App v2 project',
                '47 stakeholders mapped from 12 email threads',
                'BRD exported as PDF + DOCX in under 10 seconds',
                'Pipeline completed — 89 requirements, 0 conflicts',
                'New project created from Slack export successfully',
                'Team at Acme Corp extracted 124 requirements in 4 minutes',
                '3 conflicts auto-detected in Mobile App v2 project',
                '47 stakeholders mapped from 12 email threads',
                'BRD exported as PDF + DOCX in under 10 seconds',
                'Pipeline completed — 89 requirements, 0 conflicts',
                'New project created from Slack export successfully'
              ].map((item, i) => (
                <div key={i} style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 32
                }}>
                  {item}
                  {i < 11 && (
                    <span style={{
                      color: 'rgba(255,255,255,0.15)',
                      fontSize: 16
                    }}>
                      ·
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Component 5 - Animated stats */}
      <section style={{ position: 'relative', zIndex: 10,
        background: '#0A0A0F',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px]" style={{
          background: 'rgba(255,255,255,0.06)',
          maxWidth: 900,
          margin: '0 auto'
        }}>
          {[
            { n: '9',    label: 'AI Agents',      color: '#818CF8' },
            { n: '94%',  label: 'Time saved',     color: '#67E8F9' },
            { n: '5min', label: 'First BRD',      color: '#C084FC' },
            { n: '3x',   label: 'Export formats', color: '#C4B5FD' }
          ].map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{
              background: '#0A0A0F',
              padding: '40px 20px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 42,
                fontWeight: 800,
                letterSpacing: '-1.5px',
                color: s.color,
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif'
              }}>
                {s.n}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. Component 10 - Journey timeline */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 10,
        padding: '40px 64px',
        background: '#0D0D14',
        borderTop: '0.5px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: '#6366F1',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12
          }}>
            How it works
          </div>
          <div style={{
            fontSize: 36, fontWeight: 800,
            letterSpacing: '-1px',
            color: '#fff', marginBottom: 48
          }}>
            From chaos to clarity
          </div>

          <div style={{ position: 'relative', paddingLeft: 32 }}>
            <div style={{
              position: 'absolute',
              left: 7, top: 8, bottom: 8,
              width: 1,
              background: 'rgba(255,255,255,0.07)'
            }} />

            {[
              {
                title: 'Upload your communications',
                desc: 'Drop in emails, meeting transcripts, Slack exports or any text file. No formatting required — just raw business communications.',
                time: 'Takes 30 seconds',
                color: '#6366F1'
              },
              {
                title: '9 AI agents analyze everything',
                desc: 'Agents work in sequence — filtering noise, extracting requirements, mapping stakeholders, detecting conflicts and building a knowledge graph.',
                time: 'Takes 2–5 minutes',
                color: '#06B6D4'
              },
              {
                title: 'Review your structured BRD',
                desc: 'A complete, traceable BRD appears with every requirement linked to its source evidence and confidence scores shown.',
                time: 'Instant',
                color: '#A855F7'
              },
              {
                title: 'Export and share',
                desc: 'Download as PDF, Word document, or Markdown. Share with stakeholders in one click. Edit via AI chat anytime.',
                time: 'Takes 10 seconds',
                color: '#8B5CF6'
              }
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                style={{
                position: 'relative',
                marginBottom: i < 3 ? 36 : 0,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: step.color,
                  border: '2px solid #0D0D14',
                  flexShrink: 0,
                  marginLeft: -26,
                  marginTop: 3,
                  boxShadow: `0 0 12px ${step.color}60`
                }} />
                <div style={{
                  background: '#111118',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                  padding: '16px 20px',
                  flex: 1
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: '#fff', marginBottom: 6
                  }}>
                    {step.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.65,
                    marginBottom: 10
                  }}>
                    {step.desc}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: step.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <div style={{
                      width: 4, height: 4,
                      borderRadius: '50%',
                      background: step.color
                    }} />
                    {step.time}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Component 15 - All 9 agent detail cards */}
      <section style={{ position: 'relative', zIndex: 10,
        padding: '40px 64px',
        background: '#0A0A0F',
        borderTop: '0.5px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: '#6366F1',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12
          }}>
            The pipeline
          </div>
          <div style={{
            fontSize: 36, fontWeight: 800,
            letterSpacing: '-1px',
            color: '#fff', marginBottom: 12
          }}>
            Meet your AI agents
          </div>
          <div style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 48,
            lineHeight: 1.7,
            maxWidth: 460
          }}>
            9 specialized agents each focus on one task.
            Together they cover everything a senior 
            business analyst would do — in minutes.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                phase: '01',
                name: 'Project Coordinator',
                desc: 'Initializes the pipeline, loads all source files and orchestrates the full agent sequence.',
                badge: 'Coordinator',
                phaseColor: '#6366F1',
                badgeBg: 'rgba(99,102,241,0.12)',
                badgeColor: '#818CF8'
              },
              {
                phase: '02',
                name: 'Document Parser',
                desc: 'Reads every uploaded file and splits content into processable semantic chunks for analysis.',
                badge: 'Parser',
                phaseColor: '#6366F1',
                badgeBg: 'rgba(99,102,241,0.12)',
                badgeColor: '#818CF8'
              },
              {
                phase: '03',
                name: 'Relevance Scorer',
                desc: 'Scores each chunk 0–1 for business relevance. Filters out noise like lunch plans and FYIs.',
                badge: 'Filter',
                phaseColor: '#06B6D4',
                badgeBg: 'rgba(6,182,212,0.12)',
                badgeColor: '#67E8F9'
              },
              {
                phase: '04',
                name: 'Requirements Extractor',
                desc: 'Identifies functional, non-functional, business, technical and performance requirements.',
                badge: 'Extraction',
                phaseColor: '#06B6D4',
                badgeBg: 'rgba(6,182,212,0.12)',
                badgeColor: '#67E8F9'
              },
              {
                phase: '05',
                name: 'Stakeholder Mapper',
                desc: 'Maps every person mentioned — role, influence level and sentiment toward the project.',
                badge: 'People',
                phaseColor: '#06B6D4',
                badgeBg: 'rgba(6,182,212,0.12)',
                badgeColor: '#67E8F9'
              },
              {
                phase: '06',
                name: 'Decision Tracker',
                desc: 'Captures every confirmed decision with who made it, when, and the rationale behind it.',
                badge: 'Decision',
                phaseColor: '#8B5CF6',
                badgeBg: 'rgba(139,92,246,0.12)',
                badgeColor: '#C4B5FD'
              },
              {
                phase: '07',
                name: 'Timeline Builder',
                desc: 'Extracts all dates, deadlines, milestones and dependencies into a structured timeline.',
                badge: 'Timeline',
                phaseColor: '#8B5CF6',
                badgeBg: 'rgba(139,92,246,0.12)',
                badgeColor: '#C4B5FD'
              },
              {
                phase: '08',
                name: 'Conflict Detector',
                desc: 'Cross-references all requirements to find contradictions and flags them for review.',
                badge: 'Conflict',
                phaseColor: '#D946EF',
                badgeBg: 'rgba(217,70,239,0.12)',
                badgeColor: '#E879F9'
              },
              {
                phase: '09',
                name: 'Document Generator',
                desc: 'Assembles all extracted intelligence into a complete traceable BRD ready to export.',
                badge: 'Generator',
                phaseColor: '#A855F7',
                badgeBg: 'rgba(168,85,247,0.12)',
                badgeColor: '#C084FC'
              }
            ].map((agent, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}
                style={{
                background: '#111118',
                border: `0.5px solid rgba(255,255,255,0.07)`,
                borderTop: `2px solid ${agent.phaseColor}`,
                borderRadius: 10,
                padding: '18px 18px 16px',
                transition: 'border-color 0.2s, transform 0.2s'
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 800,
                  color: agent.phaseColor,
                  letterSpacing: '0.08em',
                  marginBottom: 10,
                  textTransform: 'uppercase'
                }}>
                  Phase {agent.phase}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: '#fff', marginBottom: 8
                }}>
                  {agent.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.35)',
                  lineHeight: 1.65,
                  marginBottom: 14
                }}>
                  {agent.desc}
                </div>
                <span style={{
                  display: 'inline-block',
                  fontSize: 10, fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 4,
                  background: agent.badgeBg,
                  color: agent.badgeColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  {agent.badge}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Component 6 - Export formats */}
      <section style={{ position: 'relative', zIndex: 10,
        padding: '40px 64px',
        background: '#0A0A0F'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: '#6366F1',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12
          }}>
            Export
          </div>
          <div style={{
            fontSize: 36, fontWeight: 800,
            letterSpacing: '-1px', color: '#fff',
            marginBottom: 12
          }}>
            Your BRD, your format
          </div>
          <div style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 48,
            lineHeight: 1.7,
            maxWidth: 460
          }}>
            Download in any format your team needs.
            Every export includes full source 
            traceability and confidence scores.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: '',
                name: 'PDF Export',
                desc: 'Print-ready document with full formatting, page numbers and source appendix',
                color: 'rgba(217,70,239,0.15)',
                border: 'rgba(217,70,239,0.2)',
                iconColor: '#D946EF'
              },
              {
                icon: '#',
                name: 'Markdown',
                desc: 'Developer-friendly .md file for GitHub wikis, Notion, and documentation sites',
                color: 'rgba(99,102,241,0.15)',
                border: 'rgba(99,102,241,0.3)',
                iconColor: '#818CF8'
              },
              {
                icon: 'W',
                name: 'Word DOCX',
                desc: 'Fully editable Word document for stakeholder review and collaborative editing',
                color: 'rgba(6,182,212,0.15)',
                border: 'rgba(6,182,212,0.2)',
                iconColor: '#06B6D4'
              }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                style={{
                background: '#111118',
                border: `0.5px solid ${f.border}`,
                borderRadius: 12,
                padding: 24,
                textAlign: 'center',
                transition: 'transform 0.2s'
              }}>
                <div style={{
                  width: 48, height: 48,
                  borderRadius: 12,
                  background: f.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: 20,
                  fontWeight: 800,
                  color: f.iconColor
                }}>
                  {f.icon}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: '#fff', marginBottom: 8
                }}>
                  {f.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.35)',
                  lineHeight: 1.6
                }}>
                  {f.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Component 8 - Trust badges */}
      <section style={{ position: 'relative', zIndex: 10,
        padding: '40px 64px',
        background: '#0A0A0F'
      }}>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center'
        }}>
          {[
            {
              label: 'Free for students',
              color: '#06B6D4',
              bg: 'rgba(6,182,212,0.1)',
              border: 'rgba(6,182,212,0.2)'
            },
            {
              label: 'No credit card needed',
              color: '#6366F1',
              bg: 'rgba(99,102,241,0.1)',
              border: 'rgba(99,102,241,0.2)'
            },
            {
              label: 'Built in India',
              color: '#8B5CF6',
              bg: 'rgba(139,92,246,0.1)',
              border: 'rgba(139,92,246,0.2)'
            },
            {
              label: 'Works with plain text ideas',
              color: '#D946EF',
              bg: 'rgba(217,70,239,0.1)',
              border: 'rgba(217,70,239,0.2)'
            },
            {
              label: 'Powered by Gemini AI',
              color: '#06B6D4',
              bg: 'rgba(6,182,212,0.1)',
              border: 'rgba(6,182,212,0.2)'
            },
            {
              label: 'Export to PDF, Word & Markdown',
              color: '#A855F7',
              bg: 'rgba(168,85,247,0.1)',
              border: 'rgba(168,85,247,0.2)'
            },
            {
              label: 'Your data stays yours',
              color: '#06B6D4',
              bg: 'rgba(6,182,212,0.1)',
              border: 'rgba(6,182,212,0.2)'
            },
            {
              label: 'Shareable BRD links',
              color: '#818CF8',
              bg: 'rgba(99,102,241,0.1)',
              border: 'rgba(99,102,241,0.2)'
            }
          ].map((b, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: b.bg,
              border: `0.5px solid ${b.border}`,
              borderRadius: 8,
              padding: '10px 16px'
            }}>
              <div style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: b.color,
                flexShrink: 0
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.65)'
              }}>
                {b.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 9. Use Cases */}
      <section className="relative z-10 py-16 px-6" style={{ background: '#0D0D14', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[900px] mx-auto">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Who is this for</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: '#fff', marginBottom: 48 }}>Built for people with ideas</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Students', desc: 'Turn your capstone or hackathon idea into a structured project plan your professors will love.', tag: 'Academic Projects' },
              { title: 'Freelancers', desc: 'Convert client conversations into professional requirement docs. Win more contracts with clarity.', tag: 'Client Briefs' },
              { title: 'Solo Founders', desc: 'Go from "I have an app idea" to a complete blueprint you can hand to any developer.', tag: 'MVP Planning' },
            ].map((uc, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }} style={{ background: '#111118', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{uc.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 16 }}>{uc.desc}</div>
                <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{uc.tag}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. CTA Banner */}
      <section className="relative z-10 py-16 px-6 text-center" style={{ background: '#007AFF' }}>
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-[40px] font-bold text-white mb-6 leading-tight tracking-[-1px]">Got an idea? Let's turn it into a plan.</h2>
          <p className="text-[20px] text-white/90 mb-10 font-medium">Free to use. No credit card. No signup friction.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-white text-[#007AFF] font-bold py-[14px] px-[32px] rounded-[10px] text-[16px] shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
            Try it — It's free
          </button>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="relative z-10 py-8 px-6 md:px-12 flex flex-col sm:flex-row justify-between items-center gap-6" style={{ background: '#000000', borderTop: '0.5px solid #1C1C1E' }}>
        <div className="text-white hidden sm:block font-bold text-[16px] cursor-pointer" onClick={() => navigate('/')}>
          Require<span style={{ color: '#007AFF' }}>AI</span>
        </div>
        <div className="text-[rgba(255,255,255,0.5)] text-[13px] text-center font-medium">
          Built with RequireAI
        </div>
      </footer>
    </motion.div>
  );
}
