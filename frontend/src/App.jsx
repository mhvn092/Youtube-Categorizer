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
import ProcessingToast from './components/ProcessingToast';

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

  // Status Toast State
  const [processingStatus, setProcessingStatus] = useState(null);

  // Modals state
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [selectedTakeawaysVideo, setSelectedTakeawaysVideo] = useState(null);
  const [feedbackConfig, setFeedbackConfig] = useState({ video: null, mode: 'thought' });

  // Helper for auto-dismissing completed toasts
  const setCompletedToast = (message, type = 'success') => {
    setProcessingStatus({ active: false, message, type });
    setTimeout(() => {
      setProcessingStatus((prev) => (prev && !prev.active ? null : prev));
    }, 4500);
  };

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
  const handleRetryVideo = async (videoId) => {
    setProcessingStatus({ active: true, message: "Re-extracting video metadata & transcript...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/videos/${videoId}/retry`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
        if (selectedPlaylistId) await fetchPlaylistDetail(selectedPlaylistId);
        setCompletedToast("Video re-analyzed successfully!");
      } else {
        setCompletedToast("Failed to retry video", "error");
      }
    } catch (e) {
      console.error("Retry video failed:", e);
      setCompletedToast("Error retrying video", "error");
    }
  };

  const handleRetryAllPlaceholders = async () => {
    setProcessingStatus({ active: true, message: "Re-analyzing all placeholder videos using cookies...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/videos/retry-placeholders`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        if (selectedPlaylistId) await fetchPlaylistDetail(selectedPlaylistId);
        setCompletedToast(`Re-analyzed ${data.reprocessed_count} video(s)!`);
      } else {
        setCompletedToast("Failed to re-analyze placeholders", "error");
      }
    } catch (e) {
      console.error("Retry all placeholders failed:", e);
      setCompletedToast("Error re-analyzing placeholders", "error");
    }
  };

  const handleSyncAllFeeds = async () => {
    setProcessingStatus({ active: true, message: "Syncing RSS feeds for all channel subscriptions...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/subscriptions/sync-all-feeds`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchData();
        setCompletedToast("All channel feeds synced!");
      }
    } catch (e) {
      console.error("Sync feeds failed:", e);
      setCompletedToast("Sync feeds failed", "error");
    }
  };

  const handleAutoSyncAccount = async (apiKey, accessToken, channelHandle) => {
    setProcessingStatus({ active: true, message: "Auto-syncing YouTube playlists & subscriptions...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/playlists/sync-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, access_token: accessToken, channel_handle_or_url: channelHandle })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        setCompletedToast(`Synced ${data.playlists_synced} playlist(s) and ${data.subscriptions_synced} channel(s)!`);
        return data;
      }
    } catch (e) {
      console.error("Account auto-sync error:", e);
      setCompletedToast("Account auto-sync error", "error");
    }
    return null;
  };

  const handleFetchPlaylist = async (urlOrId) => {
    setProcessingStatus({ active: true, message: "Fetching YouTube playlist data...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/playlists/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url_or_id: urlOrId })
      });
      if (res.ok) {
        await fetchData();
        setCompletedToast("Playlist fetched successfully!");
      }
    } catch (e) {
      console.error("Fetch playlist error:", e);
      setCompletedToast("Fetch playlist failed", "error");
    }
  };

  const handleProcessPlaylist = async (playlistId) => {
    setProcessingStatus({ active: true, message: "Processing playlist videos with Gemma 12B LLM...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/process`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        if (selectedPlaylistId === playlistId) {
          await fetchPlaylistDetail(playlistId);
        }
        setCompletedToast(`Processed ${data.processed_count} playlist video(s)!`);
      }
    } catch (e) {
      console.error("Process playlist error:", e);
      setCompletedToast("Process playlist failed", "error");
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

  const handleTrainProfileFromPlaylist = async (playlistId) => {
    setProcessingStatus({ active: true, message: "Analyzing favorite videos playlist & training AI taste profile...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/train-profile`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
        await fetchData();
        if (selectedPlaylistId) await fetchPlaylistDetail(selectedPlaylistId);
        setCompletedToast(data.message || "AI taste profile successfully updated!");
      } else {
        const err = await res.json().catch(() => ({}));
        setCompletedToast(err.detail || "Failed to train AI profile on playlist", "error");
      }
    } catch (e) {
      console.error("Train playlist error:", e);
      setCompletedToast("Error training AI profile from playlist", "error");
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
        setCompletedToast("AI Memory Profile saved!");
      }
    } catch (e) {
      console.error("Save profile failed:", e);
    }
  };

  const handleFeedbackSubmit = async (videoId, action, reason) => {
    setProcessingStatus({ active: true, message: "Training AI memory with your thoughts...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/profile/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, action, reason })
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
        await fetchData();
        if (selectedPlaylistId) await fetchPlaylistDetail(selectedPlaylistId);
        setCompletedToast("AI memory updated with your guidance!");
      }
    } catch (e) {
      console.error("Feedback failed:", e);
      setCompletedToast("Feedback failed", "error");
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

  const handleSaveYouTubeCredentials = async ({ api_key, access_token, channel_handle }) => {
    try {
      const res = await fetch(`${API_BASE}/profile/youtube-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key,
          access_token,
          channel_handle
        })
      });
      if (res.ok) {
        await fetchData();
        setCompletedToast("YouTube credentials saved!");
      }
    } catch (e) {
      console.error("Save YouTube credentials failed:", e);
      setCompletedToast("Failed to save credentials", "error");
    }
  };

  const handleReanalyzeWithTranscript = async (videoId, transcriptText) => {
    setProcessingStatus({ active: true, message: "Re-analyzing AI with selected caption track...", type: "info" });
    try {
      const res = await fetch(`${API_BASE}/videos/${videoId}/reanalyze-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        if (selectedPlaylistId) await fetchPlaylistDetail(selectedPlaylistId);
        setSelectedTakeawaysVideo(data.video);
        setCompletedToast("AI re-analyzed with selected caption track!");
      }
    } catch (e) {
      console.error("Re-analyze transcript failed:", e);
      setCompletedToast("Failed to re-analyze video", "error");
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
              onOpenFeedback={(v, mode = 'thought') => setFeedbackConfig({ video: v, mode })}
              onRetryVideo={handleRetryVideo}
              onRetryAllPlaceholders={handleRetryAllPlaceholders}
              onBatchDelete={handleBatchDeletePlaylistItems}
              onProcessPlaylist={handleProcessPlaylist}
              onTrainPlaylist={handleTrainProfileFromPlaylist}
            />
          ) : (
            <PlaylistsView
              playlists={playlists}
              onFetchPlaylist={handleFetchPlaylist}
              onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
              onProcessPlaylist={handleProcessPlaylist}
              onTrainPlaylist={handleTrainProfileFromPlaylist}
            />
          )
        )}

        {/* All Backlog Videos View */}
        {activeTab === 'triage' && (
          <TriageTable
            videos={videos}
            onSelectTakeaways={(v) => setSelectedTakeawaysVideo(v)}
            onOpenFeedback={(v, mode = 'thought') => setFeedbackConfig({ video: v, mode })}
            onRetryVideo={handleRetryVideo}
            onRetryAllPlaceholders={handleRetryAllPlaceholders}
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
            playlists={playlists}
            onSaveProfile={handleSaveProfile}
            onTrainFromPlaylist={handleTrainProfileFromPlaylist}
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
        onReanalyzeWithTranscript={handleReanalyzeWithTranscript}
      />

      <FeedbackModal
        video={feedbackConfig.video}
        mode={feedbackConfig.mode}
        isOpen={Boolean(feedbackConfig.video)}
        onClose={() => setFeedbackConfig({ video: null, mode: 'thought' })}
        onSubmitFeedback={handleFeedbackSubmit}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        onSaveCredentials={handleSaveYouTubeCredentials}
        onAutoSyncAccount={handleAutoSyncAccount}
        systemStatus={systemStatus}
      />

      {/* Floating Processing & Status Progress Toast */}
      <ProcessingToast
        status={processingStatus}
        onClose={() => setProcessingStatus(null)}
      />

    </div>
  );
}
