import { useState, useEffect } from "react";
import { Shield, Sparkles, Database } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '64px' }}>
      <header style={{ marginBottom: '32px' }}>
          <h1 className="mac-page-title">Settings</h1>
          <p className="mac-secondary" style={{ marginTop: '4px' }}>Manage your account preferences and application behavior.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '32px' }}>
          <aside>
             <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {['General', 'Account', 'Security', 'Billing', 'Notifications'].map((item, i) => (
                    <div key={i} className={`mac-body ${i===0 ? '' : 'mac-secondary'}`} style={{ padding: '8px 12px', borderRadius: '6px', background: i===0 ? 'var(--selected)' : 'transparent', color: i===0 ? 'var(--blue)' : 'var(--text)', fontWeight: i===0 ? 500 : 400, cursor: 'pointer' }}>
                        {item}
                    </div>
                ))}
             </nav>
          </aside>

          <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section className="mac-card">
                  <h2 className="mac-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16}/> Appearance</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                          <p className="mac-body">Interface Theme</p>
                          <p className="mac-secondary">Select or toggle your application lighting preference.</p>
                      </div>
                      <button onClick={toggleTheme} className="btn-secondary">
                          Toggle Dynamic Theme
                      </button>
                  </div>
              </section>

              <section className="mac-card">
                  <h2 className="mac-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={16}/> Data & Seed</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                          <p className="mac-body">Seed Mock Environment</p>
                          <p className="mac-secondary">Generate sample synthetic projects for demonstration purposes.</p>
                      </div>
                      <button className="btn-primary" onClick={() => alert("Environment seeded!")}>
                          Deploy Seed Data
                      </button>
                  </div>
              </section>

              <section className="mac-card">
                  <h2 className="mac-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}><Shield size={16}/> Danger Zone</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                          <p className="mac-body" style={{ color: "var(--red)" }}>Purge Workspace</p>
                          <p className="mac-secondary">Permanently delete all projects, requirements, and stakeholders.</p>
                      </div>
                      <button className="btn-danger">
                          Delete All Data
                      </button>
                  </div>
              </section>
          </main>
      </div>
    </div>
  );
}
