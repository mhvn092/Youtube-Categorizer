import React, { useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';

export default function ProcessingToast({ status, onClose }) {
  if (!status || !status.message) return null;

  const isSuccess = status.type === 'success';
  const isError = status.type === 'error';
  const isActive = status.active;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        minWidth: '320px',
        maxWidth: '450px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${isSuccess ? 'rgba(52, 211, 153, 0.4)' : isError ? 'rgba(244, 63, 94, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${isSuccess ? 'rgba(52, 211, 153, 0.2)' : isError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(168, 85, 247, 0.25)'}`,
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#ffffff'
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive ? (
          <Loader2 size={20} color="#c084fc" className="spin" style={{ animation: 'spin 1s linear infinite' }} />
        ) : isSuccess ? (
          <CheckCircle2 size={20} color="#34d399" />
        ) : isError ? (
          <AlertCircle size={20} color="#fb7185" />
        ) : (
          <Sparkles size={20} color="#c084fc" />
        )}
      </div>

      {/* Message */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          {isActive ? 'Processing in Background...' : isSuccess ? 'Completed' : 'Status Alert'}
        </p>
        <p style={{ fontSize: '0.8rem', color: isSuccess ? '#a7f3d0' : isError ? '#fecdd3' : '#e9d5ff', margin: '2px 0 0 0', lineHeight: 1.3 }}>
          {status.message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
