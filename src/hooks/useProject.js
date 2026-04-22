import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { getProject, getMembers, getTransactions } from '../lib/db.js';

/**
 * Subscribes to real-time updates for a project's members and transactions.
 * Returns { project, members, transactions, loading, refresh }.
 */
export function useProject(code) {
  const [project,      setProject]      = useState(null);
  const [members,      setMembers]      = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const [proj, m, t] = await Promise.all([
        getProject(code),
        getMembers(code),
        getTransactions(code),
      ]);
      setProject(proj);
      setMembers(m);
      setTransactions(t);
    } catch (err) {
      console.error('useProject load error:', err);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (!code) {
      setMembers([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    load();

    // Real-time subscription
    const channel = supabase
      .channel(`project-${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `project_code=eq.${code}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `project_code=eq.${code}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, load]);

  return { project, members, transactions, loading, refresh: load };
}
