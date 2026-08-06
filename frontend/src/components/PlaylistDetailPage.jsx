import React, { useState } from 'react';
import { ArrowLeft, Trash2, CheckSquare, Square, AlertTriangle, FileText, ExternalLink, RefreshCw, Loader2, Sparkles } from 'lucide-react';

export default function PlaylistDetailPage({ playlist, videos, onBack, onSelectTakeaways, onBatchDelete, onProcessPlaylist }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!playlist) return null;

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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Back button & Playlist Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => onSelectTakeaways(v)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}
                      >
                        <FileText size={14} /> Takeaways
                      </button>
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
