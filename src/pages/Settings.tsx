import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { User, Palette, Cpu, Info, LogOut, Shield, Key } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('account');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI Config state
  const [aiProvider, setAiProvider] = useState('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadUser();
    // Load saved AI config from localStorage
    const savedProvider = localStorage.getItem('requireai_provider') || 'gemini';
    setAiProvider(savedProvider);
    const savedKey = localStorage.getItem('requireai_gemini_key') || '';
    setGeminiKey(savedKey);
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: { full_name: displayName }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };

  const handleSaveAI = () => {
    localStorage.setItem('requireai_provider', aiProvider);
    if (geminiKey) localStorage.setItem('requireai_gemini_key', geminiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Account</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Manage your profile and account settings.</p>
            </div>
            
            {/* Avatar section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, color: '#fff',
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)'
              }}>
                {displayName ? displayName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{displayName}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Display Name</label>
                <input className="mac-input" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ height: 40, borderRadius: 10, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Address</label>
                <input className="mac-input" value={email} disabled style={{ opacity: 0.5, height: 40, borderRadius: 10, fontSize: 14 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Email cannot be changed from here.</div>
              </div>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'max-content', marginTop: 4, height: 40, borderRadius: 10, paddingLeft: 24, paddingRight: 24 }}>
                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>

            {/* Danger zone */}
            <div style={{ marginTop: 16, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Danger Zone</div>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Signing out will clear your current session. Your projects and data will remain safe.</p>
              <button onClick={handleSignout} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(239,68,68,0.08)', color: 'var(--red)',
                border: '0.5px solid rgba(239,68,68,0.2)', transition: 'all 0.2s'
              }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        );

      case 'ai-config':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>AI Configuration</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Configure which AI provider powers your pipeline and chat.</p>
            </div>
            
            {/* Provider selection */}
            <div>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Provider</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'gemini', label: 'Google Gemini', desc: 'Best for structured extraction' },
                  { id: 'openai', label: 'OpenAI GPT', desc: 'Strong conversational ability' },
                  { id: 'anthropic', label: 'Anthropic Claude', desc: 'Excellent analysis depth' },
                ].map(p => (
                  <button key={p.id} onClick={() => setAiProvider(p.id)} style={{
                    flex: 1, padding: '16px 14px', borderRadius: 12, cursor: 'pointer',
                    background: aiProvider === p.id ? 'rgba(99,102,241,0.1)' : 'var(--bg2)',
                    border: aiProvider === p.id ? '1.5px solid var(--blue)' : '0.5px solid var(--border)',
                    transition: 'all 0.2s', textAlign: 'left',
                    color: 'var(--text)'
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{p.desc}</div>
                    {aiProvider === p.id && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', marginTop: 8, textTransform: 'uppercase' }}>✓ Active</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div style={{ maxWidth: 420 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Key size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="mac-input" 
                  type={showKey ? 'text' : 'password'} 
                  value={geminiKey} 
                  onChange={e => setGeminiKey(e.target.value)} 
                  placeholder="Enter your API key"
                  style={{ height: 40, borderRadius: 10, fontSize: 13, paddingRight: 80 }} 
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Your key is stored locally in your browser and never sent to our servers. You can also configure keys via environment variables.
              </div>
            </div>

            <button className="btn-primary" onClick={handleSaveAI} style={{ width: 'max-content', height: 40, borderRadius: 10, paddingLeft: 24, paddingRight: 24 }}>
              {saved ? '✓ Configuration Saved!' : 'Save AI Configuration'}
            </button>
          </div>
        );

      case 'appearance':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Appearance</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Customize how RequireAI looks on your screen.</p>
            </div>
            
            {/* Theme */}
            <div>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Theme</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'dark', label: 'Dark Mode', desc: 'Easy on the eyes', bg: '#0A0A0F' },
                  { id: 'light', label: 'Light Mode', desc: 'Clean and bright', bg: '#F8F8FC' },
                ].map(t => (
                  <button key={t.id} onClick={() => { if (theme !== t.id) toggleTheme(); }} style={{
                    flex: 1, padding: '20px 16px', borderRadius: 14, cursor: 'pointer',
                    background: theme === t.id ? 'rgba(99,102,241,0.1)' : 'var(--bg2)',
                    border: theme === t.id ? '1.5px solid var(--blue)' : '0.5px solid var(--border)',
                    transition: 'all 0.2s', textAlign: 'left',
                    color: 'var(--text)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 24, borderRadius: 6, background: t.bg, border: '0.5px solid var(--border)' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{t.desc}</div>
                    {theme === t.id && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', marginTop: 8, textTransform: 'uppercase' }}>✓ Active</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipeline Views */}
            <div style={{ padding: 20, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Display Preferences</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--blue)' }} /> Show confidence scores on requirements
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--blue)' }} /> Show Idea Validator Score on BRD
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--blue)' }} /> Enable page transition animations
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--blue)' }} /> Compact sidebar mode
                </label>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>About RequireAI</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Built for Hackathon by students who believe AI should simplify, not complicate.</p>
            </div>
            
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06))', border: '0.5px solid rgba(99,102,241,0.15)', borderRadius: 16, padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 700 }}>Require<span style={{ color: 'var(--blue)' }}>AI</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Version 1.0.0 — Hackathon Edition</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                RequireAI transforms raw ideas into professional Business Requirements Documents using a 9-phase AI pipeline. 
                Upload a document, paste meeting notes, or just describe your app idea in plain English — and our AI agents will 
                extract requirements, identify stakeholders, detect conflicts, and generate a complete BRD.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'AI Pipeline', value: '9 Phases' },
                { label: 'Export Formats', value: 'PDF, Word, MD' },
                { label: 'AI Providers', value: 'Gemini, GPT, Claude' },
                { label: 'Built With', value: 'React + Supabase' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '14px 16px', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Keyboard Shortcuts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: '⌘ + N', desc: 'New Project' },
                  { key: '⌘ + S', desc: 'Save Settings' },
                  { key: '⌘ + K', desc: 'Quick Search' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>{s.desc}</span>
                    <kbd style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--text)', border: '0.5px solid var(--border)' }}>{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'ai-config', label: 'AI Config', icon: Cpu },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
      <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Settings</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 220, borderRight: '0.5px solid var(--border)', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--selected)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text2)',
                border: 'none', textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              <tab.icon size={16} style={{ color: activeTab === tab.id ? 'var(--blue)' : 'inherit' }} />
              {tab.label}
            </button>
          ))}
          
          <div style={{ flex: 1 }} />
          
          <button
            onClick={() => navigate('/admin')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'var(--bg3)', color: 'var(--blue)',
              border: '1px solid var(--border)', textAlign: 'left', marginBottom: 8
            }}
          >
            <Shield size={16} /> Admin Portal
          </button>
        </aside>

        <main style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
          {renderTabContent()}
        </main>
      </div>
    </motion.div>
  );
}
