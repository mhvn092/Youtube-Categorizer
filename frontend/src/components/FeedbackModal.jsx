import React, { useState } from 'react';
import { X, Brain, Send, Loader2 } from 'lucide-react';

export default function FeedbackModal({ video, mode = 'thought', isOpen, onClose, onSubmitFeedback }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !video) return null;

  const isSkipMode = mode === 'skip';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() && !isSkipMode) return;
    setLoading(true);
    await onSubmitFeedback(video.id, isSkipMode ? 'skip' : 'thought', reason.trim());
    setLoading(false);
    setReason('');
    onClose();
  };

  const presets = isSkipMode ? [
    "I already know basic concepts in this video",
    "Too much clickbait / fluff drama",
    "Not relevant to my career or current goals",
    "Topic is too elementary",
    "Video is too long for the value provided"
  ] : [
    "I love deep dives into architecture and performance",
    "I already master basic concepts in this topic",
    "Focus on practical, hands-on technical tutorials",
    "Skip videos with sensational clickbait titles",
    "Prefer concise videos under 15 minutes"
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={22} color="#a855f7" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              {isSkipMode ? "Train AI: Why are you skipping?" : "Train AI: Share Your Thoughts"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {isSkipMode ? (
            <>Skipping <strong>"{video.title}"</strong>. Tell the AI why so future recommendations get smarter.</>
          ) : (
            <>Share your feedback or thoughts on <strong>"{video.title}"</strong>. The AI will learn your knowledge profile, interests, and preferences.</>
          )}
        </p>

        <form onSubmit={handleSubmit}>
          
          {/* Quick preset tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReason(preset)}
                style={{
                  background: reason === preset ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${reason === preset ? 'rgba(168, 85, 247, 0.5)' : 'var(--border-color)'}`,
                  color: reason === preset ? '#e9d5ff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer'
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              YOUR THOUGHTS / GUIDANCE FOR THE AI
            </label>
            <textarea
              rows={3}
              placeholder="e.g. I already know advanced Rust async programming, don't recommend beginner tutorials..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                color: '#fff',
                outline: 'none',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Training AI Memory...
                </>
              ) : (
                <>
                  <Send size={16} /> Save & Train AI
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
