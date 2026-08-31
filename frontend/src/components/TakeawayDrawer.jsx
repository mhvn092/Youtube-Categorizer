import React, { useState, useEffect } from 'react';
import { X, FileText, ExternalLink, Sparkles, CheckCircle2, AlertTriangle, Clock, AlignLeft, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react';

export default function TakeawayDrawer({ video, onClose, onMarkWatched, onReanalyzeWithTranscript }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [activeTranscriptText, setActiveTranscriptText] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    if (video) {
      const avail = Array.isArray(video.available_transcripts) ? video.available_transcripts : [];
      if (avail.length > 0) {
        setSelectedTrackId(avail[0].id || 'track_0');
        setActiveTranscriptText(avail[0].text || video.transcript || '');
      } else {
        setSelectedTrackId('default');
        setActiveTranscriptText(video.transcript || '');
      }
    }
  }, [video]);

  if (!video) return null;

  const takeaways = Array.isArray(video.takeaways) ? video.takeaways : [];
  const availableTracks = Array.isArray(video.available_transcripts) ? video.available_transcripts : [];

  const handleTrackChange = (e) => {
    const trackId = e.target.value;
    setSelectedTrackId(trackId);
    const found = availableTracks.find(t => t.id === trackId);
    if (found) {
      setActiveTranscriptText(found.text);
    } else {
      setActiveTranscriptText(video.transcript || '');
    }
  };

  const handleReanalyze = async () => {
    if (!onReanalyzeWithTranscript || !activeTranscriptText) return;
    setIsReanalyzing(true);
    await onReanalyzeWithTranscript(video.id, activeTranscriptText);
    setIsReanalyzing(false);
  };

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
        <div style={{ marginBottom: '24px' }}>
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

        {/* Full Captions / Transcript Accordion */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlignLeft size={16} color="#818cf8" />
              <span>Full Raw Captions & Track Options</span>
              {availableTracks.length > 0 ? (
                <span style={{ fontSize: '0.725rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px' }}>
                  {availableTracks.length} Track{availableTracks.length > 1 ? 's' : ''} Available
                </span>
              ) : activeTranscriptText ? (
                <span style={{ fontSize: '0.725rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px' }}>
                  {activeTranscriptText.split(' ').length} words
                </span>
              ) : (
                <span style={{ fontSize: '0.725rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '12px' }}>
                  Not Available
                </span>
              )}
            </div>
            {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showTranscript && (
            <div style={{
              marginTop: '12px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)'
            }}>
              {/* Caption Track Selector */}
              {availableTracks.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Select English / Caption Track:
                  </label>
                  <select
                    value={selectedTrackId}
                    onChange={handleTrackChange}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid var(--border-color)',
                      color: '#60a5fa',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      fontWeight: 600
                    }}
                  >
                    {availableTracks.map((tr, idx) => (
                      <option key={tr.id || idx} value={tr.id}>
                        {tr.name} — ({tr.word_count || (tr.text ? tr.text.split(' ').length : 0)} words)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Transcript Text */}
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                fontSize: '0.825rem',
                color: '#d1d5db',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                background: 'rgba(0,0,0,0.3)',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {activeTranscriptText || 'No transcript text available for this video.'}
              </div>

              {/* Re-analyze Button */}
              {activeTranscriptText && (
                <button
                  onClick={handleReanalyze}
                  disabled={isReanalyzing}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isReanalyzing ? (
                    <><RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Re-analyzing AI with Selected Caption...</>
                  ) : (
                    <><Zap size={14} /> Re-analyze AI Takeaways with Selected Caption Track</>
                  )}
                </button>
              )}
            </div>
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
