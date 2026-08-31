import React, { useState } from 'react';
import { ListVideo, Plus, RefreshCw, Loader2, ExternalLink, ArrowRight, CheckCircle2, Sparkles, Brain } from 'lucide-react';

export default function PlaylistsView({ playlists, onFetchPlaylist, onSelectPlaylist, onProcessPlaylist, onTrainPlaylist }) {
  const [playlistInput, setPlaylistInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [trainingId, setTrainingId] = useState(null);

  const handleFetch = async (e) => {
    e.preventDefault();
    if (!playlistInput.trim()) return;
    setLoading(true);
    await onFetchPlaylist(playlistInput.trim());
    setPlaylistInput('');
    setLoading(false);
  };

  const handleProcess = async (playlistId) => {
    setProcessingId(playlistId);
    await onProcessPlaylist(playlistId);
    setProcessingId(null);
  };

  const handleTrain = async (playlistId) => {
    if (!onTrainPlaylist) return;
    setTrainingId(playlistId);
    await onTrainPlaylist(playlistId);
    setTrainingId(null);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Fetch Playlist Header Card */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <ListVideo size={26} color="#818cf8" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>YouTube Playlists Management Hub</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Import your YouTube playlists to process videos with Ollama (Gemma 12B), learn your personal tastes, and clean up playlists.
            </p>
          </div>
        </div>

        <form onSubmit={handleFetch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Paste YouTube Playlist URL or ID (e.g. https://www.youtube.com/playlist?list=PL...)"
            value={playlistInput}
            onChange={(e) => setPlaylistInput(e.target.value)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#fff', outline: 'none', fontSize: '0.9rem' }}
          />
          <button type="submit" className="btn-primary" disabled={loading || !playlistInput.trim()}>
            {loading ? <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Fetching Playlist...</> : <><Plus size={16} /> Add Playlist</>}
          </button>
        </form>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Sparkles size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>No playlists added yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Paste a YouTube Playlist URL above to import all videos and generate dedicated triage pages.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {playlists.map((pl) => {
            const isProcessing = processingId === pl.id;
            const isTraining = trainingId === pl.id;

            return (
              <div key={pl.id} className="glass-panel animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  
                  {/* Thumbnail / Header */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                    {pl.thumbnail ? (
                      <img src={pl.thumbnail} alt={pl.title} style={{ width: '96px', height: '54px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                    ) : (
                      <div style={{ width: '96px', height: '54px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ListVideo size={24} color="#818cf8" />
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px', lineHeight: '1.3' }}>
                        {pl.title}
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {pl.item_count} videos in playlist
                      </span>
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ollama Categorized:</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                      {pl.processed_count} / {pl.item_count} Videos
                    </span>
                  </div>

                  {/* Taste Training Action */}
                  <button
                    onClick={() => handleTrain(pl.id)}
                    disabled={isTraining}
                    style={{
                      width: '100%',
                      marginBottom: '16px',
                      padding: '8px 12px',
                      background: 'rgba(168, 85, 247, 0.12)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#c084fc',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    title="Let AI analyze videos in this playlist to understand what genres, art, depth and topics you love"
                  >
                    {isTraining ? (
                      <><Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Training AI Memory on Taste Profile...</>
                    ) : (
                      <><Brain size={14} /> 🧠 Train AI Profile on This Playlist</>
                    )}
                  </button>

                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => handleProcess(pl.id)}
                    disabled={isProcessing}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.825rem' }}
                  >
                    {isProcessing ? (
                      <><Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Gemma 12B...</>
                    ) : (
                      <><RefreshCw size={14} /> Process</>
                    )}
                  </button>

                  <button
                    className="btn-primary"
                    onClick={() => onSelectPlaylist(pl.id)}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.825rem', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                  >
                    Open Page <ArrowRight size={14} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
