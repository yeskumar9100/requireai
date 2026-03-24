import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Wallet, Settings as SettingsIcon, LogOut } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadUser();
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
    // Simulate save
    await new Promise(r => setTimeout(r, 600));
    setSaved(true);
    setSaving(false);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 className="mac-section-title">Account Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <div>
                <label className="mac-secondary" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Display Name</label>
                <input className="mac-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="mac-secondary" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Email Address</label>
                <input className="mac-input" value={email} disabled style={{ opacity: 0.6 }} />
              </div>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'max-content', marginTop: 8 }}>
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        );
      case 'security':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 className="mac-section-title">Security</h2>
            <div className="mac-card" style={{ maxWidth: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Password Authentication</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Manage your password requirements.</div>
                </div>
                <button className="btn-secondary">Change</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Two-Factor Authentication</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Add an extra layer of security.</div>
                </div>
                <button className="btn-primary">Enable</button>
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 className="mac-section-title">Notifications</h2>
            <div className="mac-card" style={{ maxWidth: 500 }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked /> Email me when a pipeline completes
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked /> Notify me about new AI Agents
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" /> Marketing and promotional emails
                  </label>
               </div>
            </div>
          </div>
        );
      case 'billing':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 className="mac-section-title">Billing & Plans</h2>
            <div className="mac-card" style={{ maxWidth: 500, background: 'linear-gradient(145deg, rgba(99,102,241,0.05), transparent)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                 <div>
                   <div className="badge badge-blue">Enterprise Plan</div>
                   <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', marginTop: 8 }}>$499<span style={{ fontSize: 14, color: 'var(--text2)' }}>/mo</span></div>
                 </div>
                 <button className="btn-secondary">Upgrade</button>
               </div>
               <div className="mac-secondary" style={{ fontSize: 13, marginBottom: 12 }}>Includes:</div>
               <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                 <li>• Unlimited AI Pipeline Runs</li>
                 <li>• Up to 100GB Document Storage</li>
                 <li>• Custom Brand Exporting</li>
               </ul>
            </div>
          </div>
        );
      default:
        return <div>These settings are currently unconfigured in the demo workspace.</div>;
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: Wallet },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
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
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'var(--bg3)', color: 'var(--blue)',
              border: '1px solid var(--border)', textAlign: 'left', marginBottom: 8
            }}
          >
            <Shield size={16} /> Admin Portal
          </button>

          <button
            onClick={handleSignout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
              border: 'none', textAlign: 'left', marginTop: 'auto'
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </aside>

        <main style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
          {renderTabContent()}
        </main>
      </div>
    </motion.div>
  );
}
