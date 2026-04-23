import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  /**
   * toast({ title, message, type, duration, progress, taskId })
   * type: 'info' | 'success' | 'error' | 'loading'
   * Returns the toast id so you can update it.
   */
  const toast = useCallback((opts) => {
    const id = nextId++;
    const { duration = opts.type === 'loading' ? null : 5000, ...rest } = opts;

    setToasts(prev => [...prev, { id, ...rest, exiting: false }]);

    if (duration) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, [dismiss]);

  /** Update an existing toast by id */
  const updateToast = useCallback((id, updates) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    // If updating to a terminal type, auto-dismiss after 4s
    if (updates.type && updates.type !== 'loading') {
      clearTimeout(timersRef.current[id]);
      timersRef.current[id] = setTimeout(() => dismiss(id), 4000);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, updateToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─── UI ──────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div style={containerStyle}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const { id, type = 'info', title, message, progress, exiting } = toast;

  const colors = {
    info:    { bg: '#1e293b', accent: '#60a5fa', icon: 'ℹ' },
    loading: { bg: '#1e293b', accent: '#a78bfa', icon: '⟳' },
    success: { bg: '#14532d', accent: '#4ade80', icon: '✓' },
    error:   { bg: '#450a0a', accent: '#f87171', icon: '✕' },
  };

  const { bg, accent, icon } = colors[type] || colors.info;

  return (
    <div style={{
      ...toastStyle,
      background: bg,
      borderLeft: `3px solid ${accent}`,
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'translateX(110%)' : 'translateX(0)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      {/* Icon */}
      <div style={{
        ...iconStyle,
        color: accent,
        animation: type === 'loading' ? 'toast-spin 1s linear infinite' : 'none'
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ ...titleStyle, color: accent }}>{title}</div>}
        {message && <div style={messageStyle}>{message}</div>}

        {/* Progress bar */}
        {typeof progress === 'number' && (
          <div style={progressTrackStyle}>
            <div style={{
              ...progressBarStyle,
              width: `${progress}%`,
              background: accent,
              transition: 'width 0.4s ease'
            }} />
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button onClick={() => onDismiss(id)} style={closeStyle}>×</button>

      <style>{`
        @keyframes toast-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const containerStyle = {
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  maxWidth: '360px',
  width: '100%',
  pointerEvents: 'none',
};

const toastStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.875rem 1rem',
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  pointerEvents: 'all',
  color: '#e2e8f0',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '0.875rem',
};

const iconStyle = {
  fontSize: '1rem',
  fontWeight: 'bold',
  lineHeight: 1,
  flexShrink: 0,
  marginTop: '1px',
  display: 'inline-block',
};

const titleStyle = {
  fontWeight: '600',
  fontSize: '0.8125rem',
  marginBottom: '2px',
  letterSpacing: '0.02em',
};

const messageStyle = {
  color: '#94a3b8',
  lineHeight: 1.4,
};

const progressTrackStyle = {
  height: '3px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '2px',
  marginTop: '8px',
  overflow: 'hidden',
};

const progressBarStyle = {
  height: '100%',
  borderRadius: '2px',
};

const closeStyle = {
  background: 'none',
  border: 'none',
  color: '#475569',
  cursor: 'pointer',
  fontSize: '1.1rem',
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
  marginTop: '-1px',
};