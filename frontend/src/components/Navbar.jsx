import React from 'react';
import { Video, Cpu, Key, Layers, Radio, Brain, PlusCircle, ListVideo } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, systemStatus, onOpenIngest, onOpenApiKeyModal }) {
  const isOllamaOnline = systemStatus?.ollama?.online;
  const isApiKeySet = systemStatus?.youtube_api_key_configured;

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px', marginBottom: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)'
          }}>
            <Video size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
              YT Backlog <span style={{ color: '#818cf8' }}>Triage AI</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Adaptive Video & Playlist Categorizer (Gemma 12B)</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          
          <button
            onClick={() => setActiveTab('playlists')}
            className={`btn-secondary ${activeTab === 'playlists' ? 'active' : ''}`}
            style={{
              border: 'none',
              background: activeTab === 'playlists' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'playlists' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <ListVideo size={16} /> Playlists Hub
          </button>

          <button
            onClick={() => setActiveTab('triage')}
            className={`btn-secondary ${activeTab === 'triage' ? 'active' : ''}`}
            style={{
              border: 'none',
              background: activeTab === 'triage' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'triage' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Layers size={16} /> All Backlog Videos
          </button>
          
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`btn-secondary ${activeTab === 'subscriptions' ? 'active' : ''}`}
            style={{
              border: 'none',
              background: activeTab === 'subscriptions' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'subscriptions' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Radio size={16} /> Subscriptions
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`btn-secondary ${activeTab === 'memory' ? 'active' : ''}`}
            style={{
              border: 'none',
              background: activeTab === 'memory' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'memory' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Brain size={16} /> AI Memory Profile
          </button>

        </nav>

        {/* System Indicators & Ingest Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* Ollama Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '9999px',
            background: isOllamaOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isOllamaOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: isOllamaOnline ? '#34d399' : '#f87171'
          }}>
            <Cpu size={14} />
            <span>Ollama ({systemStatus?.current_model || 'gemma:12b'}): {isOllamaOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* YouTube API Key status button */}
          <button
            onClick={onOpenApiKeyModal}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: isApiKeySet ? '#34d399' : 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: '9999px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Key size={14} />
            <span>YouTube API: {isApiKeySet ? 'Configured' : 'Optional (Setup)'}</span>
          </button>

          {/* Ingest Video Button */}
          <button className="btn-primary" onClick={onOpenIngest}>
            <PlusCircle size={18} /> Process Video
          </button>
        </div>

      </div>
    </header>
  );
}
