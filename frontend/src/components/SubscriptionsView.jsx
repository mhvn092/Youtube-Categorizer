import React, { useState } from 'react';
import { Radio, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Sparkles, FileText, ExternalLink, Clock } from 'lucide-react';

export default function SubscriptionsView({ channels, feedVideos, onSyncAllFeeds, onSelectTakeaways }) {
  const [channelInput, setChannelInput] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    await onSyncAllFeeds();
    setSyncingAll(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Subscriptions Header & Actions */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Radio size={26} color="#818cf8" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Subscriptions Feed & AI Recommendations</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Scrapes new uploads from your subscribed channels and evaluates them with Gemma 12B against your AI Memory Profile.
            </p>
          </div>
        </div>

        <button className="btn-primary" onClick={handleSyncAll} disabled={syncingAll} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
          {syncingAll ? (
            <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Syncing Feeds with Gemma 12B...</>
          ) : (
            <><RefreshCw size={16} /> Sync All Subscription Feeds</>
          )}
        </button>
      </div>

      {/* Subscription Feed Matrix */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Latest Subscription Uploads & Recommendations</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{feedVideos?.length || 0} videos in feed</span>
        </div>

        {!feedVideos || feedVideos.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Sparkles size={32} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.9rem' }}>No subscription feed videos yet. Click "Sync All Subscription Feeds" above or Auto-Sync your YouTube account.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Video / Channel</th>
                <th style={{ padding: '14px 16px' }}>Category</th>
                <th style={{ padding: '14px 16px' }}>Priority</th>
                <th style={{ padding: '14px 16px' }}>Summary</th>
                <th style={{ padding: '14px 16px' }}>Why Skip?</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feedVideos.map((v) => {
                const priorityClass = `priority-${v.priority?.toLowerCase() || 'mid'}`;
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 20px', maxWidth: '280px' }}>
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
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className="badge-category">{v.category}</span>
                    </td>
                    <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`badge-priority ${priorityClass}`}>{v.priority}</span>
                    </td>
                    <td style={{ padding: '16px 16px', maxWidth: '300px' }}>
                      <p style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{v.summary}</p>
                    </td>
                    <td style={{ padding: '16px 16px', maxWidth: '220px' }}>
                      {v.why_skip && v.why_skip.toLowerCase() !== 'none' ? (
                        <span style={{ color: '#fb7185', fontSize: '0.78rem', background: 'rgba(244, 63, 94, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.2)', display: 'inline-block' }}>
                          {v.why_skip}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button className="btn-secondary" onClick={() => onSelectTakeaways(v)} style={{ padding: '6px 10px', fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
                        <FileText size={14} /> Takeaways
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Channel Unsubscribe Analytics */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Subscribed Channels Analytics & Unsubscribe Advisor</h3>
        </div>

        {channels.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.85rem' }}>No channels listed yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Channel Name</th>
                <th style={{ padding: '14px 16px' }}>Total Scanned</th>
                <th style={{ padding: '14px 16px' }}>Skipped Count</th>
                <th style={{ padding: '14px 16px' }}>Skip Ratio %</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>AI Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>{ch.channel}</td>
                  <td style={{ padding: '16px 16px' }}>{ch.total_videos} videos</td>
                  <td style={{ padding: '16px 16px', color: ch.skip_videos > 0 ? '#fb7185' : 'var(--text-muted)' }}>{ch.skip_videos} videos</td>
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', width: '80px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${ch.skip_ratio_percent}%`, background: ch.skip_ratio_percent >= 70 ? '#f43f5e' : '#10b981' }} />
                      </div>
                      <span>{ch.skip_ratio_percent}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    {ch.recommend_unsubscribe ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fb7185', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700 }}>
                        <AlertTriangle size={14} /> Recommend Unsubscribe
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> High Value Content
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>

    </div>
  );
}
