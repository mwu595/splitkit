import { useState, useEffect } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { getProjectsForUser } from '../lib/db.js';
import Avatar from './ui/Avatar.jsx';

export default function MyProjects({
  authUser,
  session,
  currentMember,
  activeTab,
  onTabChange,
  onOpenProfile,
  onSwitchProject,
}) {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    getProjectsForUser(authUser.id)
      .then(list => { setProjects(list); setLoading(false); })
      .catch(() => { setError('Could not load projects.'); setLoading(false); });
  }, [authUser?.id]);

  return (
    <div style={s.root}>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div style={s.stickyTop}>
        <header style={s.header}>
          <div style={s.headerTopRow}>
            <button style={s.avatarBtn} onClick={onOpenProfile} aria-label="Profile">
              <Avatar member={currentMember} size={38} isActive />
            </button>
          </div>
          <h1 style={s.title}>My Projects</h1>
        </header>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────── */}
      <div style={s.scrollBody}>
        {loading && (
          <p style={s.hint}>Loading…</p>
        )}

        {!loading && error && (
          <div style={s.errorBox}>
            <p style={s.errorTitle}>Could not load projects</p>
            <p style={s.errorSub}>
              Make sure the <code>user_id</code> migration has been run in your Supabase SQL Editor:
            </p>
            <code style={s.errorCode}>
              ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
            </code>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div style={s.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
            <p style={s.emptyTitle}>No projects linked yet</p>
            <p style={s.emptySub}>
              When you join or create a project while signed in, it will appear here.
            </p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div style={s.list}>
            {projects.map(p => {
              const isActive = session?.code === p.projectCode;
              return (
                <button
                  key={p.projectCode}
                  style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}
                  onClick={() => {
                    if (!isActive) {
                      onSwitchProject({ code: p.projectCode, memberId: p.memberId });
                    }
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = colors.cardSecondary;
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = colors.cardPrimary;
                  }}
                >
                  <div style={s.cardIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke={isActive ? colors.accent : colors.textSecondary}
                      strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                    </svg>
                  </div>
                  <div style={s.cardInfo}>
                    <span style={{ ...s.cardName, ...(isActive ? s.cardNameActive : {}) }}>
                      {p.projectName}
                    </span>
                    <span style={s.cardCode}>#{p.projectCode}</span>
                  </div>
                  {isActive && (
                    <span style={s.activeBadge}>Active</span>
                  )}
                  {!isActive && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    height: '100vh',
    background: colors.bg,
    fontFamily: font.sans,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  stickyTop: {
    flexShrink: 0,
    background: colors.bg,
    paddingTop: 'env(safe-area-inset-top)',
  },
  header: {
    padding: '20px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.8px',
    lineHeight: 1.15,
    margin: 0,
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: '40px 16px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '60px 32px 40px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 1.6,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '8px 16px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px',
    borderRadius: radius.card,
    border: `1px solid ${colors.border}`,
    background: colors.cardPrimary,
    width: '100%',
    fontFamily: font.sans,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s',
  },
  cardActive: {
    border: `1.5px solid ${colors.accent}`,
    background: colors.settlementBg,
    cursor: 'default',
  },
  cardIcon: {
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardNameActive: {
    color: colors.accent,
  },
  cardCode: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 500,
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.accent,
    background: 'rgba(232,48,42,0.15)',
    borderRadius: radius.pill,
    padding: '3px 9px',
    flexShrink: 0,
    letterSpacing: '0.3px',
  },
  errorBox: {
    margin: '16px 20px',
    padding: '16px',
    borderRadius: radius.card,
    border: `1px solid ${colors.settlementBorder}`,
    background: colors.settlementBg,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.accent,
  },
  errorSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 1.5,
  },
  errorCode: {
    fontSize: 11,
    color: colors.textSecondary,
    background: colors.cardSecondary,
    borderRadius: 6,
    padding: '8px 10px',
    display: 'block',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
};
