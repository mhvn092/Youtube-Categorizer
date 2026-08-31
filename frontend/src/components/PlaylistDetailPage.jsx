import React, { useState } from 'react';
import { ArrowLeft, Trash2, CheckSquare, Square, AlertTriangle, FileText, ExternalLink, RefreshCw, Loader2, Sparkles, Brain, XCircle } from 'lucide-react';

export default function PlaylistDetailPage({ playlist, videos, onBack, onSelectTakeaways, onOpenFeedback, onRetryVideo, onRetryAllPlaceholders, onBatchDelete, onProcessPlaylist, onTrainPlaylist }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [training, setTraining] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);

  if (!playlist) return null;

  const placeholderCount = videos.filter(v => 
    v.title === 'YouTube Video' || 
    (v.summary && v.summary.toLowerCase().includes('placeholder')) ||
    (v.summary && v.summary.toLowerCase().includes('no actual video content'))
  ).length;

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAllSkips = () => {
    const skips = videos
      .filter(v => v.priority === 'skip' || v.priority === 'low')
      .map(v => v.id);
    setSelectedIds(skips);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === videos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(videos.map(v => v.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Remove ${selectedIds.length} selected video(s) from playlist "${playlist.title}"?`)) return;

    setDeleting(true);
    await onBatchDelete(playlist.id, selectedIds);
    setSelectedIds([]);
    setDeleting(false);
  };

  const handleProcess = async () => {
    setProcessing(true);
    await onProcessPlaylist(playlist.id);
    setProcessing(false);
  };

  const handleTrain = async () => {
    if (!onTrainPlaylist) return;
    setTraining(true);
    await onTrainPlaylist(playlist.id);
    setTraining(false);
  };

  const handleRetrySingle = async (videoId) => {
    setRetryingId(videoId);
    await onRetryVideo(videoId);
    setRetryingId(null);
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    await onRetryAllPlaceholders();
    setRetryingAll(false);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Back button & Playlist Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} /> Back to Playlists
          </button>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{playlist.title}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dedicated Playlist Page • {videos.length} videos total
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={handleTrain}
            disabled={training}
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              color: '#c084fc',
              background: 'rgba(168, 85, 247, 0.15)',
              borderColor: 'rgba(168, 85, 247, 0.4)',
              fontWeight: 600
            }}
            title="Analyze videos in this playlist to update your AI knowledge profile and taste preferences"
          >
            {training ? (
              <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Training AI Profile...</>
            ) : (
              <><Brain size={16} /> 🧠 Train AI on this Playlist</>
            )}
          </button>

          {placeholderCount > 0 && (
            <button
              className="btn-primary"
              onClick={handleRetryAll}
              disabled={retryingAll}
              style={{ fontSize: '0.82rem', padding: '8px 14px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}
            >
              {retryingAll ? (
                <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Re-analyzing {placeholderCount} Videos...</>
              ) : (
                <><RefreshCw size={16} /> Re-analyze {placeholderCount} Placeholders</>
              )}
            </button>
          )}

          <button className="btn-secondary" onClick={handleProcess} disabled={processing}>
            {processing ? <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Processing with Gemma 12B...</> : <><RefreshCw size={16} /> Process Playlist with AI</>}
          </button>
        </div>

      </div>

      {/* Batch Action Toolbar */}
      <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-secondary" onClick={handleSelectAll} style={{ fontSize: '0.8rem' }}>
            {selectedIds.length === videos.length ? <CheckSquare size={16} color="#818cf8" /> : <Square size={16} />}
            Select All ({selectedIds.length}/{videos.length})
          </button>

          <button className="btn-secondary" onClick={handleSelectAllSkips} style={{ fontSize: '0.8rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
            <AlertTriangle size={14} /> Select All Recommended Skips
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#fb7185', fontWeight: 600 }}>
              {selectedIds.length} video(s) selected
            </span>
            <button className="btn-primary" onClick={handleDeleteSelected} disabled={deleting} style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }}>
              {deleting ? <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Removing...</> : <><Trash2 size={16} /> Delete Selected from Playlist</>}
            </button>
          </div>
        )}

      </div>

      {/* Scoped Video Table */}
      {videos.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Sparkles size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Playlist is empty</h3>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px', width: '40px' }}>Select</th>
                <th style={{ padding: '14px 16px' }}>Video / Channel</th>
                <th style={{ padding: '14px 16px' }}>Category</th>
                <th style={{ padding: '14px 16px' }}>Priority</th>
                <th style={{ padding: '14px 16px' }}>One-Line Summary</th>
                <th style={{ padding: '14px 16px' }}>Why Skip?</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const isSelected = selectedIds.includes(v.id);
                const priorityClass = `priority-${v.priority?.toLowerCase() || 'mid'}`;
                const isRetrying = retryingId === v.id;

                return (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '16px 16px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(v.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                      />
                    </td>

                    {/* Video Info */}
                    <td style={{ padding: '16px 16px', maxWidth: '280px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <img src={v.thumbnail} alt={v.title} style={{ width: '74px', height: '42px', objectFit: 'cover', borderRadius: '6px' }} />
                        <div>
                          <a href={v.url} target="_blank" rel="noreferrer" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {v.title} <ExternalLink size={12} color="var(--text-muted)" />
                          </a>
                          <span style={{ fontSize: '0.78rem', color: '#818cf8' }}>{v.channel}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className="badge-category">{v.category}</span>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`badge-priority ${priorityClass}`}>{v.priority}</span>
                    </td>

                    {/* Summary */}
                    <td style={{ padding: '16px 16px', maxWidth: '300px' }}>
                      <p style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{v.summary}</p>
                    </td>

                    {/* Why Skip */}
                    <td style={{ padding: '16px 16px', maxWidth: '220px' }}>
                      {v.why_skip && v.why_skip.toLowerCase() !== 'none' ? (
                        <span style={{ color: '#fb7185', fontSize: '0.78rem', background: 'rgba(244, 63, 94, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.2)', display: 'inline-block' }}>
                          {v.why_skip}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* Retry Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => handleRetrySingle(v.id)}
                          disabled={isRetrying}
                          title="Re-extract metadata & re-run AI triage"
                          style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }}
                        >
                          {isRetrying ? (
                            <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                        </button>

                        {/* Train AI Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => onOpenFeedback(v, 'thought')}
                          title="Add thoughts on video to train AI memory"
                          style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                        >
                          <Brain size={14} /> Train AI
                        </button>

                        {/* Takeaways Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => onSelectTakeaways(v)}
                          style={{ padding: '6px 10px', fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}
                        >
                          <FileText size={14} /> Takeaways
                        </button>

                        {/* Skip Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => onOpenFeedback(v, 'skip')}
                          title="Skip video & update AI memory"
                          style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                        >
                          <XCircle size={14} /> Skip
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
