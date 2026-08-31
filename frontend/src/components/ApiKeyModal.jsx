import React, { useState, useEffect } from 'react';
import {
  X, Key, CheckCircle2, RefreshCw, Loader2, Save, AlertCircle,
  ExternalLink, ShieldCheck, Trash2, Lock, Sparkles, Zap, ChevronDown, ChevronUp
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function ApiKeyModal({ isOpen, onClose, onSaveCredentials, onAutoSyncAccount, systemStatus }) {
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0);

  const [authMode, setAuthMode] = useState('autorenew'); // 'autorenew' | 'manual'
  const [showGuide, setShowGuide] = useState(false);

  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch saved credentials on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setLoadingCredentials(true);

      fetch(`${API_BASE}/profile/youtube-credentials`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setApiKey(data.api_key || '');
            setAccessToken(data.access_token || '');
            setRefreshToken(data.refresh_token || '');
            setClientId(data.client_id || '');
            setClientSecret(data.client_secret || '');
            setChannelHandle(data.channel_handle || '');
            setTokenExpiresAt(data.token_expires_at || 0);

            // Default to autorenew tab if refresh token or client ID exists
            if (data.refresh_token || data.client_id) {
              setAuthMode('autorenew');
            } else if (data.access_token && !data.refresh_token) {
              setAuthMode('manual');
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load saved YouTube credentials:", err);
        })
        .finally(() => {
          setLoadingCredentials(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handler: Save credentials ONLY (No Sync)
  const handleSaveOnly = async (e) => {
    if (e) e.preventDefault();
    setSavingCredentials(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        api_key: apiKey.trim(),
        access_token: accessToken.trim(),
        refresh_token: refreshToken.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        channel_handle: channelHandle.trim()
      };

      if (onSaveCredentials) {
        await onSaveCredentials(payload);
      } else {
        const res = await fetch(`${API_BASE}/profile/youtube-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to save');
      }

      setSuccessMsg('YouTube credentials saved successfully! (API key & OAuth configuration are stored permanently)');
      setTimeout(() => {
        setSuccessMsg((prev) => (prev.includes('saved successfully') ? '' : prev));
      }, 4000);
    } catch (err) {
      console.error("Error saving credentials:", err);
      setErrorMsg('Failed to save YouTube credentials.');
    } finally {
      setSavingCredentials(false);
    }
  };

  // Handler: Test & Renew OAuth Token immediately
  const handleRenewTokenNow = async () => {
    if (!refreshToken.trim()) {
      setErrorMsg('Please enter your Refresh Token first.');
      return;
    }

    setRenewing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // First save current inputs
      await fetch(`${API_BASE}/profile/youtube-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          refresh_token: refreshToken.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          channel_handle: channelHandle.trim()
        })
      });

      // Call renew endpoint
      const res = await fetch(`${API_BASE}/profile/youtube-credentials/renew-token`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok && data.access_token) {
        setAccessToken(data.access_token);
        setTokenExpiresAt(data.token_expires_at);
        setSuccessMsg(`✓ ${data.message || 'Token renewed successfully! Auto-renewal is fully operational.'}`);
      } else {
        setErrorMsg(data.detail || 'Token renewal failed. Check Client ID, Client Secret, and Refresh Token.');
      }
    } catch (err) {
      console.error("Token renewal error:", err);
      setErrorMsg('Failed to contact renewal endpoint. Please verify credentials.');
    } finally {
      setRenewing(false);
    }
  };

  // Handler: Save & Trigger Account Sync
  const handleSaveAndSync = async (e) => {
    if (e) e.preventDefault();
    if (!apiKey.trim() && !accessToken.trim() && !refreshToken.trim()) {
      setErrorMsg('Please configure either an API Key, OAuth Refresh Token, or Access Token to sync.');
      return;
    }

    setSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Save credentials first
      const payload = {
        api_key: apiKey.trim(),
        access_token: accessToken.trim(),
        refresh_token: refreshToken.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        channel_handle: channelHandle.trim()
      };

      if (onSaveCredentials) {
        await onSaveCredentials(payload);
      }

      // Trigger auto-sync
      const res = await onAutoSyncAccount(apiKey.trim(), accessToken.trim(), channelHandle.trim());
      if (res && res.status === 'success') {
        setSuccessMsg(`Successfully synced ${res.playlists_synced} playlists (${res.videos_synced} videos) and ${res.subscriptions_synced} channel subscriptions!`);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setErrorMsg('Sync completed with warnings or no public/authorized items found.');
      }
    } catch (err) {
      console.error("Auto-sync failed:", err);
      setErrorMsg('Auto-sync failed. Please verify your OAuth token or API key.');
    } finally {
      setSyncing(false);
    }
  };

  const isTokenActive = tokenExpiresAt > Date.now() / 1000;
  const tokenExpiresInMin = Math.max(0, Math.round((tokenExpiresAt - Date.now() / 1000) / 60));

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
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '680px', padding: '28px', maxHeight: '92vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="#34d399" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>YouTube API & OAuth Credentials</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>1-Time Auto-Renewal Setup & Permanent API Key Management</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Informative summary banner */}
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '18px', fontSize: '0.82rem', lineHeight: '1.45' }}>
          <p style={{ color: 'var(--text-main)', margin: 0 }}>
            ⚡ <strong>1-Time OAuth Setup:</strong> Add your <strong>Refresh Token</strong> once and the app will <strong>auto-renew access tokens forever</strong> in the background. No more 1-hour expiration limits!
          </p>
        </div>

        {loadingCredentials ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading saved credentials...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveAndSync}>
            
            {/* OAuth Mode Toggle Tabs */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('autorenew')}
                  style={{
                    background: authMode === 'autorenew' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                    border: `1px solid ${authMode === 'autorenew' ? '#34d399' : 'transparent'}`,
                    color: authMode === 'autorenew' ? '#34d399' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Zap size={14} /> Auto-Renewing OAuth (1-Time Setup)
                  {refreshToken && <span style={{ background: '#34d399', color: '#000', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>ACTIVE</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode('manual')}
                  style={{
                    background: authMode === 'manual' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    border: `1px solid ${authMode === 'manual' ? '#818cf8' : 'transparent'}`,
                    color: authMode === 'manual' ? '#818cf8' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Lock size={14} /> Direct Access Token (1-Hour Manual)
                </button>
              </div>

              {/* Mode 1: Auto-Renewal Section */}
              {authMode === 'autorenew' && (
                <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                  
                  {/* Step-by-step collapsible guide button */}
                  <div style={{ marginBottom: '14px' }}>
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      style={{ background: 'transparent', border: 'none', color: '#34d399', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                    >
                      {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
                      💡 How to get Client ID, Client Secret & Refresh Token (Click to {showGuide ? 'hide' : 'view'} guide)
                    </button>

                    {showGuide && (
                      <div className="animate-fade-in" style={{ marginTop: '10px', padding: '12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.78rem', lineHeight: '1.5' }}>
                        <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>Google Cloud Console Credentials <ExternalLink size={10} /></a>.</li>
                          <li>Create an <strong>OAuth 2.0 Client ID</strong> (Application type: Web application or Desktop).</li>
                          <li>Add <code>https://developers.google.com/oauthplayground</code> to <strong>Authorized redirect URIs</strong>.</li>
                          <li>Open <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>OAuth Playground <ExternalLink size={10} /></a> &rarr; Click ⚙️ (top right) &rarr; Check <strong>"Use your own OAuth credentials"</strong> &rarr; Enter your Client ID & Secret.</li>
                          <li>Select <strong>YouTube Data API v3</strong> (<code>https://www.googleapis.com/auth/youtube</code>) &rarr; Authorize &rarr; Click <strong>Exchange authorization code for tokens</strong>.</li>
                          <li>Copy the <strong>Refresh Token</strong> (<code>1//...</code>), <strong>Client ID</strong>, and <strong>Client Secret</strong> below!</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* Refresh Token Input */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                        OAUTH REFRESH TOKEN (PERMANENT)
                      </label>
                      {refreshToken && (
                        <button
                          type="button"
                          onClick={() => setRefreshToken('')}
                          style={{ background: 'transparent', border: 'none', color: '#fb7185', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={11} /> Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="1//04..."
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Client ID & Client Secret Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                        CLIENT ID (FROM GOOGLE CLOUD)
                      </label>
                      <input
                        type="text"
                        placeholder="...apps.googleusercontent.com"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                        CLIENT SECRET (FROM GOOGLE CLOUD)
                      </label>
                      <input
                        type="password"
                        placeholder="GOCSPX-..."
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>

                  {/* Active Token status & Test Renewal button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {accessToken ? (
                        <span>
                          Active Token: <code style={{ color: '#34d399' }}>{accessToken.slice(0, 10)}...</code>
                          {isTokenActive && <span> (Valid for ~{tokenExpiresInMin}m)</span>}
                        </span>
                      ) : (
                        <span>No access token generated yet.</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRenewTokenNow}
                      disabled={renewing || !refreshToken.trim()}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}
                    >
                      {renewing ? (
                        <><Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Contacting Google...</>
                      ) : (
                        <><RefreshCw size={13} /> Test & Renew Token Now</>
                      )}
                    </button>
                  </div>

                </div>
              )}

              {/* Mode 2: Manual Access Token Section */}
              {authMode === 'manual' && (
                <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                      DIRECT OAUTH ACCESS TOKEN (1-HOUR TEMPORARY)
                    </label>
                    {accessToken && (
                      <button
                        type="button"
                        onClick={() => setAccessToken('')}
                        style={{ background: 'transparent', border: 'none', color: '#fb7185', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <Trash2 size={11} /> Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="ya29.a0A..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
                  />
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Paste a temporary token directly from OAuth Playground if you do not wish to set up Client ID / Secret.
                  </span>
                </div>
              )}
            </div>

            {/* YouTube Data API Key (Permanent) */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} /> YouTube Data API Key (Permanent)
                </label>
                {apiKey ? (
                  <span style={{ fontSize: '0.72rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ✓ Saved
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Optional</span>
                )}
              </div>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
              />
              <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Used for public metadata, captions, and quota optimization.
              </span>
            </div>

            {/* Channel Handle or ID */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Default Channel Handle or ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. @MyChannel or UC..."
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', outline: 'none', fontSize: '0.875rem' }}
              />
            </div>

            {/* Status Alerts */}
            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', fontSize: '0.83rem', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.83rem', marginBottom: '16px' }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              
              <button type="button" className="btn-secondary" onClick={onClose} disabled={syncing || savingCredentials || renewing}>
                Close
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Save Credentials Only Button */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSaveOnly}
                  disabled={syncing || savingCredentials || renewing}
                  style={{ borderColor: 'rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe' }}
                >
                  {savingCredentials ? (
                    <><Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                  ) : (
                    <><Save size={15} /> Save Credentials</>
                  )}
                </button>

                {/* Save & Sync Account Button */}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={syncing || savingCredentials || renewing}
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                >
                  {syncing ? (
                    <><Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Syncing Playlists...</>
                  ) : (
                    <><RefreshCw size={15} /> Save & Sync Account</>
                  )}
                </button>
              </div>

            </div>

          </form>
        )}

      </div>
    </div>
  );
}

