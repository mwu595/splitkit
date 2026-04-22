import React, { useState, useRef, useEffect } from 'react';
import { colors, radius, font } from '../styles/tokens.js';
import {
  getProject,
  createProject,
  createMember,
  getMembers,
  appendDeviceToMember,
  generateUniqueCode,
} from '../lib/db.js';
import { getDeviceId } from '../lib/deviceId.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIGIT_COUNT = 6;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
      <rect x="2"  y="2"  width="11" height="11" rx="3" fill={colors.accent} />
      <rect x="15" y="2"  width="11" height="11" rx="3" fill="#6B1A1A" />
      <rect x="2"  y="15" width="11" height="11" rx="3" fill="#6B1A1A" />
      <rect x="15" y="15" width="11" height="11" rx="3" fill={colors.accent} />
    </svg>
  );
}

function MemberRow({ member, onClaim }) {
  return (
    <button
      type="button"
      style={s.memberRow}
      onClick={() => onClaim(member)}
      onMouseEnter={e => (e.currentTarget.style.background = colors.cardSecondary)}
      onMouseLeave={e => (e.currentTarget.style.background = colors.cardPrimary)}
    >
      <div style={s.memberAvatar}>
        {member.name[0].toUpperCase()}
      </div>
      <span style={s.memberName}>{member.name}</span>
      <span style={s.memberClaim}>That's me →</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Landing({ onSessionCreated }) {
  const [tab,         setTab]         = useState('join');    // 'join' | 'create'
  const [digits,      setDigits]      = useState(Array(DIGIT_COUNT).fill(''));
  const [projectName, setProjectName] = useState('');
  const [yourName,    setYourName]    = useState('');
  const [error,       setError]       = useState('');
  const [status,      setStatus]      = useState('idle');   // 'idle' | 'loading' | 'recovery' | 'joining'
  const [members,     setMembers]     = useState([]);        // for recovery flow

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
      onSessionCreated({ code, memberId: member.id });
    } catch (err) {
      setError('Could not join. Please try again.');
      setStatus('recovery');
    }
  }

  async function handleJoinAsNew() {
    const name = yourName.trim();
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

    const name    = yourName.trim();
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
      <div style={s.inner}>

        {/* Logo */}
        <div style={s.logoRow}>
          <LogoMark />
          <span style={s.wordmark}>Split Kit</span>
        </div>
        <p style={s.tagline}>Share expenses, settle up simply.</p>

        {/* Tab switcher */}
        <div style={s.tabs}>
          {[['join', 'Join Project'], ['create', 'New Project']].map(([t, label]) => (
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

        <form onSubmit={handleSubmit} style={s.form}>

          {/* 6-digit code */}
          <div style={s.field}>
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

          {/* Project name — always rendered to keep layout stable; hidden on Join tab */}
          <div style={{ ...s.field, visibility: tab === 'create' ? 'visible' : 'hidden' }}>
            <label style={s.label}>Project name</label>
            <input
              style={s.textInput}
              placeholder="e.g. Tokyo Trip 2026"
              value={projectName}
              tabIndex={tab === 'create' ? 0 : -1}
              onChange={e => { setProjectName(e.target.value); setError(''); }}
            />
          </div>

          {/* Your name */}
          <div style={s.field}>
            <label style={s.label}>Your name</label>
            <input
              style={s.textInput}
              placeholder="How others will see you"
              value={yourName}
              onChange={e => { setYourName(e.target.value); setError(''); }}
            />
          </div>

          {/* Error */}
          {error && <p style={s.error}>{error}</p>}

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

        {/* Recovery flow */}
        {status === 'recovery' && (
          <div style={s.recoveryCard}>
            <p style={s.recoveryTitle}>Who are you in this group?</p>
            <p style={s.recoverySub}>Select your name or join as someone new.</p>

            {members.map(m => (
              <MemberRow key={m.id} member={m} onClaim={handleClaim} />
            ))}

            <div style={s.recoveryDivider} />

            {/* Join as new member */}
            <div style={s.recoveryNewRow}>
              <span style={{ fontSize: 14, color: colors.textSecondary }}>
                Not listed?
              </span>
              <button
                type="button"
                style={s.newMemberBtn}
                onClick={handleJoinAsNew}
              >
                Join as "{yourName || '…'}"
              </button>
            </div>

            <button
              type="button"
              style={s.backBtn}
              onClick={() => { setStatus('idle'); setMembers([]); }}
            >
              ← Back
            </button>
          </div>
        )}

        <p style={s.hint}>
          {tab === 'join'
            ? 'Ask your group for the 6-digit code.'
            : 'Anyone with the code can join your project.'}
        </p>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    minHeight: '100svh',
    background: colors.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(32px + env(safe-area-inset-top)) 0 calc(32px + env(safe-area-inset-bottom))',
    fontFamily: font.sans,
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    padding: '0 20px',
    boxSizing: 'border-box',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
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
    marginBottom: 32,
    lineHeight: 1.5,
  },
  tabs: {
    display: 'flex',
    background: colors.cardPrimary,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    marginBottom: 28,
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
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
  },
  digitInput: {
    width: 44,
    height: 54,
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
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '20px 16px',
    marginTop: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  recoveryTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  recoverySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 1.5,
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
  recoveryDivider: {
    height: 1,
    background: colors.border,
    margin: '4px 0',
  },
  recoveryNewRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  newMemberBtn: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.accent,
    background: 'none',
    fontFamily: font.sans,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
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
  },
};
