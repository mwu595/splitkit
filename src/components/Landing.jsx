import React, { useState, useRef, useEffect } from 'react';
import { colors, radius, font } from '../styles/tokens.js';
import {
  getProject,
  createProject,
  createMember,
  updateMemberRole,
  updateMemberName,
  getMembers,
  appendDeviceToMember,
  generateUniqueCode,
  getProjectsForUser,
} from '../lib/db.js';
import { getDeviceId } from '../lib/deviceId.js';
import AuthSheet from './AuthSheet.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIGIT_COUNT = 6;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <img
      src="/icons/logo.png"
      alt="Split Kit"
      width={36}
      height={36}
      style={{ borderRadius: 8, display: 'block' }}
    />
  );
}

function MemberRow({ member, onClaim, isMine, isUnclaimed }) {
  const label = isMine ? "That's me →" : isUnclaimed ? 'Join as this name →' : 'Claim →';
  const labelColor = colors.accent;
  return (
    <button
      type="button"
      style={s.memberRow}
      onClick={() => onClaim(member)}
      onMouseEnter={e => (e.currentTarget.style.background = colors.cardSecondary)}
      onMouseLeave={e => (e.currentTarget.style.background = colors.cardPrimary)}
    >
      <div style={{
        ...s.memberAvatar,
        background: isMine ? colors.accent : colors.settlementBg,
        color:      isMine ? '#fff'        : colors.accent,
      }}>
        {member.name[0].toUpperCase()}
      </div>
      <span style={s.memberName}>{member.name}</span>
      <span style={{ ...s.memberClaim, color: labelColor }}>{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Landing({ onSessionCreated, authUser }) {
  const displayName = authUser?.user_metadata?.display_name ?? '';

  const [showAuth,      setShowAuth]      = useState(false);
  const [showClaimTip,  setShowClaimTip]  = useState(false);
  const [tab,           setTab]           = useState('join'); // 'join' | 'create' | 'existing'
  const [digits,        setDigits]        = useState(Array(DIGIT_COUNT).fill(''));
  const [projectName,   setProjectName]   = useState('');
  const [yourName,      setYourName]      = useState('');
  const [error,         setError]         = useState('');
  const [status,        setStatus]        = useState('idle'); // 'idle'|'loading'|'recovery'|'joining'
  const [members,       setMembers]       = useState([]);
  const [userProjects,    setUserProjects]    = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError,   setProjectsError]   = useState('');

  const digitRefs = Array.from({ length: DIGIT_COUNT }, () => useRef(null));
  const code = digits.join('');

  // Generate a unique code when switching to Create tab
  useEffect(() => {
    if (tab !== 'create') return;
    let cancelled = false;
    generateUniqueCode()
      .then(c => { if (!cancelled) setDigits(c.split('')); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab]);

  // Fetch user's linked projects when auth state changes
  useEffect(() => {
    if (!authUser) { setUserProjects([]); setProjectsError(''); return; }
    setProjectsLoading(true);
    setProjectsError('');
    getProjectsForUser(authUser.id)
      .then(list => { setUserProjects(list); setProjectsLoading(false); })
      .catch(err => {
        console.error('[splitkit] getProjectsForUser failed:', err.message);
        setProjectsError(err.message ?? 'Could not load projects.');
        setProjectsLoading(false);
      });
  }, [authUser?.id]);

  // Pre-fill name from account display name
  useEffect(() => {
    if (displayName) setYourName(displayName);
  }, [displayName]);

  // Auto-open auth sheet to enforce name entry right after sign-in
  useEffect(() => {
    if (authUser && !displayName) setShowAuth(true);
  }, [authUser?.id, displayName]);

  // ── Digit input handlers ────────────────────────────────────────────────────

  function handleDigitChange(i, val) {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError('');
    if (v && i < DIGIT_COUNT - 1) digitRefs[i + 1].current?.focus();
  }

  function handleDigitKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      digitRefs[i - 1].current?.focus();
    }
    if (e.key === 'ArrowLeft'  && i > 0)             digitRefs[i - 1].current?.focus();
    if (e.key === 'ArrowRight' && i < DIGIT_COUNT - 1) digitRefs[i + 1].current?.focus();
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, DIGIT_COUNT - 1);
    digitRefs[focusIdx].current?.focus();
  }

  async function refreshCode() {
    setError('');
    try {
      const c = await generateUniqueCode();
      setDigits(c.split(''));
    } catch {
      setError('Could not generate a code. Try again.');
    }
  }

  // ── Tab switch ──────────────────────────────────────────────────────────────

  function switchTab(t) {
    setTab(t);
    setError('');
    setStatus('idle');
    setMembers([]);
    if (t === 'join') setDigits(Array(DIGIT_COUNT).fill(''));
  }

  // ── Recovery: user claims an existing member slot ───────────────────────────

  async function handleClaim(member) {
    setStatus('joining');
    setError('');
    try {
      const deviceId = getDeviceId();
      await appendDeviceToMember(member.id, deviceId);
      // Override member name with account display name
      if (displayName) {
        try { await updateMemberName(member.id, displayName); } catch {}
      }
      onSessionCreated({ code, memberId: member.id });
    } catch (err) {
      setError('Could not join. Please try again.');
      setStatus('recovery');
    }
  }

  async function handleJoinAsNew() {
    const name = displayName || yourName.trim();
    if (!name) { setError('Enter your name first'); return; }
    setStatus('joining');
    setError('');
    try {
      const deviceId = getDeviceId();
      const member   = await createMember(code, name, deviceId);
      onSessionCreated({ code, memberId: member.id });
    } catch (err) {
      setError('Could not join. Please try again.');
      setStatus('recovery');
    }
  }

  // ── Form submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const name    = displayName || yourName.trim();
    const projName = projectName.trim();

    if (!name)               { setError('Enter your name');           return; }
    if (code.length !== DIGIT_COUNT) { setError('Enter the full 6-digit code'); return; }

    if (tab === 'create') {
      if (!projName) { setError('Enter a project name'); return; }
      setStatus('loading');
      try {
        const existing = await getProject(code);
        if (existing) {
          const newCode = await generateUniqueCode();
          setDigits(newCode.split(''));
          setError('That code was just taken — a new one was generated.');
          setStatus('idle');
          return;
        }
        const deviceId = getDeviceId();
        await createProject(code, projName);
        const member = await createMember(code, name, deviceId);
        try { await updateMemberRole(member.id, 'admin'); } catch {}
        onSessionCreated({ code, memberId: member.id });
      } catch (err) {
        setError('Something went wrong. Please try again.');
        setStatus('idle');
      }

    } else {
      // Join flow
      setStatus('loading');
      try {
        const project = await getProject(code);
        if (!project) {
          setError('No project found with that code.');
          setStatus('idle');
          return;
        }
        const existingMembers = await getMembers(code);
        setMembers(existingMembers);
        setStatus('recovery');
      } catch (err) {
        setError('Something went wrong. Please try again.');
        setStatus('idle');
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLoading = status === 'loading' || status === 'joining';

  return (
    <div style={s.root}>

      {/* ── Sticky header: never moves ──────────────────────────────── */}
      <div style={s.stickyTop}>

        {/* Logo row with auth avatar */}
        <div style={s.logoRow}>
          <button
            style={s.authAvatarBtn}
            onClick={() => setShowAuth(true)}
            aria-label={authUser ? 'Account' : 'Sign in'}
          >
            {authUser ? (
              <div style={s.authAvatarSigned}>
                {(displayName?.[0] || authUser.email?.[0] || '?').toUpperCase()}
              </div>
            ) : (
              <div style={s.authAvatarAnon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
            )}
          </button>
          <div style={s.wordmarkRow}>
            <LogoMark />
            <span style={s.wordmark}>Split Kit</span>
          </div>
        </div>
        <p style={s.tagline}>Share expenses, settle up simply.</p>

        {/* Tab switcher */}
        <div style={s.tabs}>
          {[
            ['join',     'Join Project'],
            ['create',   'New Project'],
            ...(authUser ? [['existing', 'My Projects']] : []),
          ].map(([t, label]) => (
            <button
              key={t}
              type="button"
              style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
              onClick={() => switchTab(t)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 6-digit code — pinned in header so it never shifts */}
        {tab !== 'existing' && (
          <div style={s.codeField}>
            <div style={s.labelRow}>
              <label style={s.label}>6-digit code</label>
              {tab === 'create' && (
                <button
                  type="button"
                  style={s.refreshBtn}
                  onClick={refreshCode}
                  title="Generate a new code"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Regenerate
                </button>
              )}
            </div>
            <div style={s.digitRow}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={digitRefs[i]}
                  style={{
                    ...s.digitInput,
                    ...(tab === 'create' ? s.digitInputCreate : {}),
                  }}
                  value={d}
                  maxLength={1}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1}`}
                  readOnly={tab === 'create'}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={s.scrollBody}>

        {tab === 'existing' && (
          <div style={s.existingList}>
            {projectsLoading && (
              <p style={s.existingHint}>Loading your projects…</p>
            )}
            {!projectsLoading && projectsError && (
              <p style={{ ...s.existingHint, color: colors.accent, fontSize: 13 }}>
                Could not load projects. Make sure the <code>user_id</code> migration has been run in Supabase.
              </p>
            )}
            {!projectsLoading && !projectsError && userProjects.length === 0 && (
              <p style={s.existingHint}>
                No projects linked yet. Join or create one to get started.
              </p>
            )}
            {!projectsLoading && userProjects.map(p => (
              <button
                key={p.projectCode}
                type="button"
                style={s.existingCard}
                onMouseEnter={e => (e.currentTarget.style.background = colors.cardSecondary)}
                onMouseLeave={e => (e.currentTarget.style.background = colors.cardPrimary)}
                onClick={() => onSessionCreated({ code: p.projectCode, memberId: p.memberId })}
              >
                <div style={s.existingIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                  </svg>
                </div>
                <div style={s.existingInfo}>
                  <span style={s.existingName}>{p.projectName}</span>
                  <span style={s.existingCode}>#{p.projectCode}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ ...s.form, display: tab === 'existing' ? 'none' : 'flex' }}>

          {/* Project name — visibility:hidden on join (keeps layout stable), display:none in recovery (not needed) */}
          <div style={{ ...s.field, ...(tab === 'create' ? {} : status === 'recovery' ? { display: 'none' } : { visibility: 'hidden' }) }}>
            <label style={s.label}>Project name</label>
            <input
              style={s.textInput}
              placeholder="e.g. Tokyo Trip 2026"
              value={projectName}
              tabIndex={tab === 'create' ? 0 : -1}
              onChange={e => { setProjectName(e.target.value); setError(''); }}
            />
          </div>

          {/* Your name — hidden during recovery; the Join As button makes it redundant */}
          {status !== 'recovery' && (
            displayName ? (
              <div style={s.accountNameRow}>
                <div style={s.accountNameDot} />
                <span style={s.accountNameLabel}>
                  Joining as <strong>{displayName}</strong>
                </span>
              </div>
            ) : (
              <div style={s.field}>
                <label style={s.label}>Your name</label>
                <input
                  style={s.textInput}
                  placeholder="How others will see you"
                  value={yourName}
                  onChange={e => { setYourName(e.target.value); setError(''); }}
                />
              </div>
            )
          )}

          {/* Error */}
          {error && <p style={s.error}>{error}</p>}

          {/* Recovery confirmation — lives inside the form to inherit flex gap */}
          {status === 'recovery' && (
            <div style={s.recoveryCard}>
              <button
                type="button"
                style={{ ...s.submitBtn, marginTop: 0, ...(isLoading ? s.submitBtnDisabled : {}) }}
                disabled={isLoading}
                onClick={handleJoinAsNew}
              >
                {isLoading ? 'Joining…' : `Join as "${displayName || yourName || '…'}"`}
              </button>

              {members.filter(m => !m.removedAt).length > 0 && (
                <div style={s.claimSection}>
                  <div style={s.claimLabelRow}>
                    <p style={s.claimLabel}>Already in this project?</p>
                    <button
                      type="button"
                      style={s.infoBtn}
                      onClick={() => setShowClaimTip(v => !v)}
                      aria-label="What do these options mean?"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={showClaimTip ? colors.textPrimary : colors.textMuted}
                        strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                    </button>
                  </div>
                  {showClaimTip && (
                    <div style={s.claimTooltip}>
                      <p style={s.claimTooltipLine}><span style={s.claimTooltipBold}>That's me →</span> You've been here before on this device.</p>
                      <p style={s.claimTooltipLine}><span style={s.claimTooltipBold}>Join as this name →</span> This spot was created for you but hasn't been claimed yet.</p>
                      <p style={s.claimTooltipLine}><span style={s.claimTooltipBold}>Claim →</span> This is you, but you're on a new device.</p>
                    </div>
                  )}
                  {members
                    .filter(m => !m.removedAt)
                    .map(m => {
                      const myDeviceId  = getDeviceId();
                      const isMine      = m.deviceIds.includes(myDeviceId);
                      const isUnclaimed = m.deviceIds.length === 0;
                      return (
                        <MemberRow
                          key={m.id}
                          member={m}
                          onClaim={handleClaim}
                          isMine={isMine}
                          isUnclaimed={isUnclaimed}
                        />
                      );
                    })}
                </div>
              )}

              <button
                type="button"
                style={s.backBtn}
                onClick={() => { setStatus('idle'); setMembers([]); }}
              >
                ← Back
              </button>
            </div>
          )}

          {/* CTA */}
          {status !== 'recovery' && (
            <button
              type="submit"
              disabled={isLoading}
              style={{ ...s.submitBtn, ...(isLoading ? s.submitBtnDisabled : {}) }}
            >
              {isLoading
                ? 'Please wait…'
                : tab === 'create' ? 'Create Project' : 'Join Project'
              }
            </button>
          )}
        </form>

        {tab !== 'existing' && (
          <p style={s.hint}>
            {tab === 'join'
              ? 'Ask your group for the 6-digit code.'
              : 'Anyone with the code can join your project.'}
          </p>
        )}

      </div>

      <AuthSheet open={showAuth} onClose={() => setShowAuth(false)} authUser={authUser} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    height: '100svh',
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: font.sans,
  },
  stickyTop: {
    flexShrink: 0,
    background: colors.bg,
    paddingTop: 'calc(32px + env(safe-area-inset-top))',
    paddingBottom: 20,
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    padding: '0 20px',
  },
  authAvatarBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  authAvatarSigned: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: colors.accent,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: font.sans,
  },
  authAvatarAnon: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: colors.cardSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 1.5,
    padding: '0 20px',
  },
  tabs: {
    display: 'flex',
    background: colors.cardPrimary,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    margin: '0 20px 20px',
  },
  tab: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: '9px 0',
    borderRadius: radius.pill,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: font.sans,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.18s',
  },
  tabActive: {
    background: colors.accent,
    color: '#fff',
  },
  codeField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '0 20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: '20px 20px 0',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },
  digitRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    width: '100%',
  },
  digitInput: {
    flex: 1,
    minWidth: 0,
    height: 58,
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardPrimary,
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: font.sans,
    caretColor: colors.accent,
    transition: 'border-color 0.15s',
  },
  digitInputCreate: {
    color: colors.accent,
    borderColor: colors.settlementBorder,
    background: colors.settlementBg,
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: font.sans,
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.3px',
  },
  textInput: {
    padding: '13px 15px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardPrimary,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: font.sans,
    transition: 'border-color 0.15s',
  },
  error: {
    fontSize: 13,
    color: colors.accent,
    background: colors.settlementBg,
    border: `1px solid ${colors.settlementBorder}`,
    borderRadius: radius.input,
    padding: '10px 14px',
    lineHeight: 1.5,
  },
  submitBtn: {
    padding: '15px',
    borderRadius: radius.pill,
    background: colors.accent,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: font.sans,
    marginTop: 4,
    boxShadow: '0 4px 20px rgba(232,48,42,0.4)',
    transition: 'opacity 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.5,
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  // Recovery flow
  recoveryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  claimSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  claimLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  claimLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },
  infoBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  },
  claimTooltip: {
    background: colors.cardSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.input,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  claimTooltipLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 1.5,
    margin: 0,
  },
  claimTooltipBold: {
    color: colors.textPrimary,
    fontWeight: 600,
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 12px',
    borderRadius: 12,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardPrimary,
    width: '100%',
    fontFamily: font.sans,
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: colors.settlementBg,
    color: colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textPrimary,
    textAlign: 'left',
  },
  memberClaim: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: 600,
  },
  backBtn: {
    fontSize: 13,
    color: colors.textMuted,
    background: 'none',
    fontFamily: font.sans,
    marginTop: 4,
    textAlign: 'left',
    padding: '4px 0',
  },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 1.5,
    padding: '0 20px',
  },
  // Account name badge (replaces name field when signed in)
  accountNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 14px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
  },
  accountNameDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: colors.accent,
    flexShrink: 0,
  },
  accountNameLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Existing projects tab
  existingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '20px 20px 0',
  },
  existingHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: '24px 0',
    lineHeight: 1.6,
  },
  existingCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: radius.card,
    border: `1px solid ${colors.border}`,
    background: colors.cardPrimary,
    width: '100%',
    fontFamily: font.sans,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s',
  },
  existingIcon: { flexShrink: 0 },
  existingInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  existingName: {
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  existingCode: {
    fontSize: 12,
    color: colors.textMuted,
  },
};
