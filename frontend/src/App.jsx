import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TriageTable from './components/TriageTable';
import IngestModal from './components/IngestModal';
import TakeawayDrawer from './components/TakeawayDrawer';
import FeedbackModal from './components/FeedbackModal';
import MemoryTuner from './components/MemoryTuner';
import SubscriptionsView from './components/SubscriptionsView';
import ApiKeyModal from './components/ApiKeyModal';
import PlaylistsView from './components/PlaylistsView';
import PlaylistDetailPage from './components/PlaylistDetailPage';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('playlists');
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [userProfile, setUserProfile] = useState({});
  const [channels, setChannels] = useState([]);
  const [feedVideos, setFeedVideos] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);

  // Modals state
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [selectedTakeawaysVideo, setSelectedTakeawaysVideo] = useState(null);
  const [feedbackVideo, setFeedbackVideo] = useState(null);

  // Load initial data
  const fetchData = async () => {
    try {
      const [vRes, plRes, pRes, cRes, fRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/videos`),
        fetch(`${API_BASE}/playlists`),
        fetch(`${API_BASE}/profile`),
        fetch(`${API_BASE}/subscriptions/channels`),
        fetch(`${API_BASE}/subscriptions/feed`),
        fetch(`${API_BASE}/profile/status`)
      ]);

      if (vRes.ok) setVideos(await vRes.json());
      if (plRes.ok) setPlaylists(await plRes.json());
      if (pRes.ok) setUserProfile(await pRes.json());
      if (cRes.ok) setChannels(await cRes.json());
      if (fRes.ok) setFeedVideos(await fRes.json());
      if (sRes.ok) setSystemStatus(await sRes.json());
    } catch (err) {
      console.error("Failed fetching app data:", err);
    }
  };

  const fetchPlaylistDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${id}`);
      if (res.ok) {
        setPlaylistDetail(await res.json());
      }
    } catch (err) {
      console.error("Failed fetching playlist detail:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPlaylistId) {
      fetchPlaylistDetail(selectedPlaylistId);
    }
  }, [selectedPlaylistId]);

  // Handlers
  const handleSyncAllFeeds = async () => {
    try {
      const res = await fetch(`${API_BASE}/subscriptions/sync-all-feeds`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Sync feeds failed:", e);
    }
  };

  const handleAutoSyncAccount = async (apiKey, accessToken, channelHandle) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/sync-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, access_token: accessToken, channel_handle_or_url: channelHandle })
      });
      if (res.ok) {
        const data = await res.json();
        fetchData();
        return data;
      }
    } catch (e) {
      console.error("Account auto-sync error:", e);
    }
    return null;
  };

  const handleFetchPlaylist = async (urlOrId) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url_or_id: urlOrId })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Fetch playlist error:", e);
    }
  };

  const handleProcessPlaylist = async (playlistId) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/process`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchData();
        if (selectedPlaylistId === playlistId) {
          fetchPlaylistDetail(playlistId);
        }
      }
    } catch (e) {
      console.error("Process playlist error:", e);
    }
  };

  const handleBatchDeletePlaylistItems = async (playlistId, videoIds) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId, video_ids: videoIds })
      });
      if (res.ok) {
        fetchData();
        if (selectedPlaylistId === playlistId) {
          fetchPlaylistDetail(playlistId);
        }
      }
    } catch (e) {
      console.error("Batch delete error:", e);
    }
  };

  const handleSaveProfile = async (newProfile) => {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      if (res.ok) {
        setUserProfile(await res.json());
      }
    } catch (e) {
      console.error("Save profile failed:", e);
    }
  };

  const handleFeedbackSubmit = async (videoId, action, reason) => {
    try {
      const res = await fetch(`${API_BASE}/profile/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, action, reason })
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
        fetchData();
        if (selectedPlaylistId) fetchPlaylistDetail(selectedPlaylistId);
      }
    } catch (e) {
      console.error("Feedback failed:", e);
    }
  };

  const handleMarkWatched = async (videoId) => {
    try {
      await fetch(`${API_BASE}/videos/${videoId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'watched' })
      });
      fetchData();
      if (selectedPlaylistId) fetchPlaylistDetail(selectedPlaylistId);
    } catch (e) {
      console.error("Mark watched failed:", e);
    }
  };

  const handleSaveApiKey = async (apiKey) => {
    try {
      await fetch(`${API_BASE}/profile/youtube-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
      fetchData();
    } catch (e) {
      console.error("Save API Key failed:", e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'playlists') setSelectedPlaylistId(null);
        }}
        systemStatus={systemStatus}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '0 24px 48px' }}>
        
        {/* Playlists Hub or Playlist Dedicated Detail Page */}
        {activeTab === 'playlists' && (
          selectedPlaylistId && playlistDetail ? (
            <PlaylistDetailPage
              playlist={playlistDetail.playlist}
              videos={playlistDetail.videos}
              onBack={() => setSelectedPlaylistId(null)}
              onSelectTakeaways={(v) => setSelectedTakeawaysVideo(v)}
              onBatchDelete={handleBatchDeletePlaylistItems}
              onProcessPlaylist={handleProcessPlaylist}
            />
          ) : (
            <PlaylistsView
              playlists={playlists}
              onFetchPlaylist={handleFetchPlaylist}
              onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
              onProcessPlaylist={handleProcessPlaylist}
            />
          )
        )}

        {/* All Backlog Videos View */}
        {activeTab === 'triage' && (
          <TriageTable
            videos={videos}
            onSelectTakeaways={(v) => setSelectedTakeawaysVideo(v)}
            onOpenFeedback={(v) => setFeedbackVideo(v)}
            onRefresh={fetchData}
          />
        )}

        {/* Subscriptions Tracker View */}
        {activeTab === 'subscriptions' && (
          <SubscriptionsView
            channels={channels}
            feedVideos={feedVideos}
            onSyncAllFeeds={handleSyncAllFeeds}
            onSelectTakeaways={(v) => setSelectedTakeawaysVideo(v)}
          />
        )}

        {/* AI Memory Profile View */}
        {activeTab === 'memory' && (
          <MemoryTuner
            profile={userProfile}
            onSaveProfile={handleSaveProfile}
            onRefresh={fetchData}
          />
        )}
      </main>

      {/* Modals & Drawers */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngestSuccess={fetchData}
      />

      <TakeawayDrawer
        video={selectedTakeawaysVideo}
        onClose={() => setSelectedTakeawaysVideo(null)}
        onMarkWatched={handleMarkWatched}
      />

      <FeedbackModal
        video={feedbackVideo}
        isOpen={Boolean(feedbackVideo)}
        onClose={() => setFeedbackVideo(null)}
        onSubmitFeedback={handleFeedbackSubmit}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        onSaveApiKey={handleSaveApiKey}
        onAutoSyncAccount={handleAutoSyncAccount}
        currentConfigured={systemStatus?.youtube_api_key_configured}
      />

    </div>
  );
}
