import React from 'react';
import { X, FileText, ExternalLink, Sparkles, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export default function TakeawayDrawer({ video, onClose, onMarkWatched }) {
  if (!video) return null;

  const takeaways = Array.isArray(video.takeaways) ? video.takeaways : [];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 1100
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        height: '100%',
        borderRadius: 0,
        padding: '32px',
        overflowY: 'auto',
        borderRight: 0,
        borderTop: 0,
        borderBottom: 0
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="#818cf8" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>AI Main Takeaways</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Video Banner Card */}
        <div style={{ display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <img src={video.thumbnail} alt={video.title} style={{ width: '110px', height: '62px', objectFit: 'cover', borderRadius: '6px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: '4px', lineHeight: '1.3' }}>{video.title}</h3>
            <span style={{ fontSize: '0.8rem', color: '#818cf8', display: 'block', marginBottom: '6px' }}>{video.channel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span><Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />{video.runtime_str}</span>
              <span className={`badge-priority priority-${video.priority?.toLowerCase()}`}>{video.priority}</span>
              <span className="badge-category">{video.category}</span>
            </div>
          </div>
        </div>

        {/* One line summary */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Executive Summary
          </h4>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', background: 'rgba(99, 102, 241, 0.1)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #818cf8' }}>
            {video.summary}
          </p>
        </div>

        {/* What it gains / Why skip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              ✨ What it Gains You
            </span>
            <p style={{ fontSize: '0.825rem', color: '#e5e7eb' }}>{video.what_it_gains || 'N/A'}</p>
          </div>

          <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              ⚠️ Why Skip It
            </span>
            <p style={{ fontSize: '0.825rem', color: '#e5e7eb' }}>{video.why_skip || 'None'}</p>
          </div>
        </div>

        {/* Bulleted Takeaways */}
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="#818cf8" /> Key Learnings & Takeaways (Skip watching!)
          </h4>

          {takeaways.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>No takeaways generated.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {takeaways.map((point, i) => (
                <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.9rem', color: '#f3f4f6', lineHeight: '1.4' }}>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Watch Full Video on YouTube <ExternalLink size={14} />
          </a>

          <button
            className="btn-primary"
            onClick={() => {
              onMarkWatched(video.id);
              onClose();
            }}
          >
            Mark as Resolved / Watched
          </button>
        </div>

      </div>
    </div>
  );
}
