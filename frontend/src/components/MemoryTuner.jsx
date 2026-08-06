import React, { useState } from 'react';
import { Brain, Plus, Trash2, CheckCircle2, ShieldAlert, Sparkles, Save, RefreshCw } from 'lucide-react';

export default function MemoryTuner({ profile, onSaveProfile, onRefresh }) {
  const [knownTopics, setKnownTopics] = useState(profile?.known_topics || []);
  const [interests, setInterests] = useState(profile?.interests || []);
  const [avoidTopics, setAvoidTopics] = useState(profile?.avoid_topics || []);
  const [notes, setNotes] = useState(profile?.guidance_notes || '');

  const [newKnown, setNewKnown] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newAvoid, setNewAvoid] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddTag = (list, setList, val, setVal) => {
    if (!val.trim()) return;
    if (!list.includes(val.trim())) {
      setList([...list, val.trim()]);
    }
    setVal('');
  };

  const handleRemoveTag = (list, setList, idx) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    await onSaveProfile({
      known_topics: knownTopics,
      interests: interests,
      avoid_topics: avoidTopics,
      guidance_notes: notes
    });
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#a855f7', padding: '12px', borderRadius: '12px' }}>
              <Brain size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>AI User Knowledge Profile</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                This is what Ollama (Gemma 14B) knows about your skills, priorities, and skip preferences.
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}>
            {savedSuccess ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Profile Changes</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Known Topics Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckCircle2 size={18} /> Known Topics (Auto-Skip / High Summary)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Topics you already master. LLM will mark videos introducing these as "Low Priority" or "Skip".
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {knownTopics.map((topic, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#a7f3d0', fontSize: '0.8rem', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                {topic}
                <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(knownTopics, setKnownTopics, i)} />
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. Basic React state, Docker fundamentals..."
              value={newKnown}
              onChange={(e) => setNewKnown(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag(knownTopics, setKnownTopics, newKnown, setNewKnown)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
            />
            <button className="btn-secondary" onClick={() => handleAddTag(knownTopics, setKnownTopics, newKnown, setNewKnown)}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* High-Value Interests Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={18} /> High-Value Interests (High Priority)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Topics you actively want to learn or care deeply about. LLM will rate these "High Priority".
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {interests.map((topic, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', fontSize: '0.8rem', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                {topic}
                <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(interests, setInterests, i)} />
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. Distributed Systems, Career Growth..."
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag(interests, setInterests, newInterest, setNewInterest)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
            />
            <button className="btn-secondary" onClick={() => handleAddTag(interests, setInterests, newInterest, setNewInterest)}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* Avoid Topics Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ShieldAlert size={18} /> Avoid / Disliked Topics (Always Skip)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Content formats or topics you dislike (e.g. tech drama, clickbait, pure reaction videos).
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {avoidTopics.map((topic, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fecdd3', fontSize: '0.8rem', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                {topic}
                <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(avoidTopics, setAvoidTopics, i)} />
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. Tech drama, celebrity news, clickbait..."
              value={newAvoid}
              onChange={(e) => setNewAvoid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag(avoidTopics, setAvoidTopics, newAvoid, setNewAvoid)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
            />
            <button className="btn-secondary" onClick={() => handleAddTag(avoidTopics, setAvoidTopics, newAvoid, setNewAvoid)}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

      </div>

      {/* Guidance Notes */}
      <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
          Custom System Instructions for Ollama
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Additional system instructions injected directly into the LLM context prompt when categorizing videos.
        </p>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
        />
      </div>

    </div>
  );
}
