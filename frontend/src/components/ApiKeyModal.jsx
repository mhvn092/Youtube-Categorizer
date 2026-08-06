import React, { useState } from 'react';
import { X, Key, CheckCircle2, RefreshCw, Loader2, Sparkles, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, onSaveApiKey, onAutoSyncAccount }) {
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSync = async (e) => {
    e.preventDefault();
    if (!apiKey.trim() && !accessToken.trim()) {
      setErrorMsg('Please enter either a YouTube API Key or an OAuth Access Token.');
      return;
    }

    setSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (apiKey.trim()) await onSaveApiKey(apiKey.trim());
      const res = await onAutoSyncAccount(apiKey.trim(), accessToken.trim(), channelHandle.trim());
      if (res && res.status === 'success') {
        setSuccessMsg(`Synced ${res.playlists_synced} playlists (${res.videos_synced} videos) and ${res.subscriptions_synced} channel subscriptions!`);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setErrorMsg('Sync completed with warnings or no public items found.');
      }
    } catch (err) {
      setErrorMsg('Auto-sync failed. Please verify your token/key.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1300,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={26} color="#34d399" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>YouTube API & OAuth Credentials</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
          Providing an <strong>OAuth Access Token</strong> allows the app to fetch <strong>100% of your Private & Unlisted playlists</strong> and delete unwanted videos directly from your YouTube playlists!
        </p>

        {/* Quick OAuth Guide */}
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '20px', fontSize: '0.8rem' }}>
          <span style={{ fontWeight: 700, color: '#34d399', display: 'block', marginBottom: '4px' }}>
            💡 How to get a 30-second OAuth Token for Private/Unlisted Playlists:
          </span>
          <ol style={{ paddingLeft: '18px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li>Go to <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>Google OAuth Playground <ExternalLink size={10} /></a>.</li>
            <li>In Step 1, scroll to <strong>YouTube Data API v3</strong>, select <code>https://www.googleapis.com/auth/youtube</code>, and click <strong>Authorize APIs</strong>.</li>
            <li>Sign in with your Google account and click <strong>Exchange authorization code for tokens</strong>.</li>
            <li>Copy the <strong>Access Token</strong> (starts with <code>ya29...</code>) and paste it below!</li>
          </ol>
        </div>

        <form onSubmit={handleSync}>
          
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: '6px', textTransform: 'uppercase' }}>
              OAUTH ACCESS TOKEN (FOR PRIVATE/UNLISTED PLAYLISTS & DELETIONS)
            </label>
            <input
              type="password"
              placeholder="ya29.a0A..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              YOUTUBE DATA API KEY (OPTIONAL PUBLIC KEY)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              CHANNEL HANDLE OR ID (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="e.g. @MyChannel or UC..."
              value={channelHandle}
              onChange={(e) => setChannelHandle(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
            />
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', fontSize: '0.85rem', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.85rem', marginBottom: '16px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={syncing}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={syncing}>
              {syncing ? (
                <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Auto-Scraping All Playlists & Subscriptions...</>
              ) : (
                <><RefreshCw size={16} /> Save & Auto-Sync Account</>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
