import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NewProjectModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    if (!user) {
      setError('User not available. Please refresh the page.');
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
