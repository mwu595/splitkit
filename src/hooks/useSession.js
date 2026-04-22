import { useState, useCallback } from 'react';

const STORAGE_KEY = 'splitkit_session';

/**
 * Persists { code, memberId } to localStorage.
 * Returns the current session and a setter that syncs to storage.
 */
export function useSession() {
  const [session, setSessionState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((data) => {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSessionState(data);
  }, []);

  return { session, setSession };
}
