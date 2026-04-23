import { useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * useTaskStream — subscribes to a task's SSE stream.
 *
 * @param {string|null} taskId   — MongoDB task ID to watch (null = disabled)
 * @param {object}      handlers — { onUpdate, onComplete, onError }
 *
 * onUpdate(data)   — called on every status push (including progress)
 * onComplete(data) — called when status === 'completed'
 * onError(data)    — called when status === 'failed' or SSE error
 */
export function useTaskStream(taskId, { onUpdate, onComplete, onError } = {}) {
  const esRef = useRef(null);
  const handlersRef = useRef({ onUpdate, onComplete, onError });

  // Keep handler refs current without re-subscribing
  useEffect(() => {
    handlersRef.current = { onUpdate, onComplete, onError };
  });

  const close = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;

    const url = `${API_BASE}/api/tasks/${taskId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      handlersRef.current.onUpdate?.(data);

      if (data.status === 'completed') {
        handlersRef.current.onComplete?.(data);
        close();
      } else if (data.status === 'failed' || data.error) {
        handlersRef.current.onError?.(data);
        close();
      }
    };

    es.onerror = () => {
      handlersRef.current.onError?.({ error: 'Connection lost', taskId });
      close();
    };

    return close;
  }, [taskId, close]);

  return { close };
}