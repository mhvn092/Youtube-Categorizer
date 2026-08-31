import React, { useState } from 'react';
import { Play, Eye, XCircle, FileText, ExternalLink, Clock, AlertTriangle, Sparkles, Filter, RefreshCw, Brain, Loader2 } from 'lucide-react';

export default function TriageTable({ videos, onSelectTakeaways, onOpenFeedback, onRetryVideo, onRetryAllPlaceholders, onRefresh }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);

  // Extract unique categories
  const categories = ['all', ...new Set(videos.map(v => v.category).filter(Boolean))];

  // Placeholder videos check
  const placeholderCount = videos.filter(v => 
    v.title === 'YouTube Video' || 
    (v.summary && v.summary.toLowerCase().includes('placeholder')) ||
    (v.summary && v.summary.toLowerCase().includes('no actual video content'))
  ).length;

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

  const filteredVideos = videos.filter(v => {
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && v.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const titleMatch = v.title?.toLowerCase().includes(q);
      const channelMatch = v.channel?.toLowerCase().includes(q);
      const summaryMatch = v.summary?.toLowerCase().includes(q);
      if (!titleMatch && !channelMatch && !summaryMatch) return false;
    }
    return true;
  });

  return (
    <div style={{ width: '100%' }}>
      
      {/* Controls & Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', minWidth: '260px', flex: 1 }}>
          <Filter size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search videos, channels, or takeaways..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '0.875rem' }}
          />
        </div>

        {/* Filter Dropdowns & Re-analyze All Button */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {placeholderCount > 0 && (
            <button
              className="btn-primary"
              onClick={handleRetryAll}
              disabled={retryingAll}
              style={{ fontSize: '0.8rem', padding: '8px 14px', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}
              title="Re-fetch metadata & transcript for all placeholder videos now that cookies/API key are active"
            >
              {retryingAll ? (
                <><Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Re-analyzing {placeholderCount} Videos...</>
              ) : (
                <><RefreshCw size={14} /> Re-analyze All Placeholders ({placeholderCount})</>
              )}
            </button>
          )}

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="all">All Categories</option>
            {categories.filter(c => c !== 'all').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="mid">Mid</option>
            <option value="low">Low</option>
            <option value="life_changing">Life Changing</option>
            <option value="skip">Skip</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="watched">Watched</option>
            <option value="skipped">Skipped</option>
          </select>

        </div>

      </div>

      {/* Video Triage Table */}
      {filteredVideos.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Sparkles size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>No videos found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>Try adjusting filters or process a new YouTube URL using the top button.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>Video / Channel</th>
                <th style={{ padding: '14px 16px' }}>Category</th>
                <th style={{ padding: '14px 16px' }}>Priority</th>
                <th style={{ padding: '14px 16px' }}>One-Line Summary & Value</th>
                <th style={{ padding: '14px 16px' }}>Why Skip?</th>
                <th style={{ padding: '14px 16px' }}>Runtime</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((v) => {
                const priorityClass = `priority-${v.priority?.toLowerCase() || 'mid'}`;
                const isSkipped = v.status === 'skipped';
                const isWatched = v.status === 'watched';
                const isRetrying = retryingId === v.id;

                return (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      opacity: isSkipped ? 0.5 : 1,
                      transition: 'background 0.2s ease',
                      background: isWatched ? 'rgba(16, 185, 129, 0.03)' : 'transparent'
                    }}
                  >
                    {/* Video Info */}
                    <td style={{ padding: '16px 20px', maxWidth: '280px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <div>
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ffffff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', lineHeight: '1.3' }}
                          >
                            {v.title} <ExternalLink size={12} color="var(--text-muted)" />
                          </a>
                          <span style={{ fontSize: '0.78rem', color: '#818cf8', display: 'block', marginTop: '2px' }}>
                            {v.channel}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className="badge-category">{v.category}</span>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`badge-priority ${priorityClass}`}>
                        {v.priority}
                      </span>
                    </td>

                    {/* Summary & Gains */}
                    <td style={{ padding: '16px 16px', maxWidth: '320px' }}>
                      <p style={{ color: 'var(--text-main)', marginBottom: '4px', fontWeight: 500 }}>
                        {v.summary}
                      </p>
                      {v.what_it_gains && (
                        <p style={{ fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✨ {v.what_it_gains}
                        </p>
                      )}
                    </td>

                    {/* Why Skip */}
                    <td style={{ padding: '16px 16px', maxWidth: '220px' }}>
                      {v.why_skip && v.why_skip.toLowerCase() !== 'none' ? (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#fb7185', fontSize: '0.78rem', background: 'rgba(244, 63, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{v.why_skip}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>None (Worth watching)</span>
                      )}
                    </td>

                    {/* Runtime */}
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Clock size={14} />
                        <span>{v.runtime_str || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        
                        {/* Re-analyze / Retry Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => handleRetrySingle(v.id)}
                          disabled={isRetrying}
                          title="Re-extract metadata, transcript & re-run AI triage"
                          style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }}
                        >
                          {isRetrying ? (
                            <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                        </button>

                        {/* Train AI / Add Thoughts Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => onOpenFeedback(v, 'thought')}
                          title="Add your thoughts on this video to train AI memory"
                          style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                        >
                          <Brain size={14} /> Train AI
                        </button>

                        {/* Read Takeaways Button */}
                        <button
                          className="btn-secondary"
                          onClick={() => onSelectTakeaways(v)}
                          title="Read Takeaways instead of watching"
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
