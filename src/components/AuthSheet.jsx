import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import BottomSheet from './ui/BottomSheet.jsx';
import { colors, radius, font } from '../styles/tokens.js';

export default function AuthSheet({ open, onClose, authUser }) {
  const [email,        setEmail]        = useState('');
  const [nameInput,    setNameInput]    = useState('');
  const [editingName,  setEditingName]  = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [status,       setStatus]       = useState('idle'); // 'idle'|'sending'|'sent'|'verifying'|'saving'|'signingout'
  const [error,        setError]        = useState('');
  const [code,         setCode]         = useState('');

  const displayName = authUser?.user_metadata?.display_name ?? '';

  // Reset sign-in form when sheet opens without auth; reset name edit on close
  useEffect(() => {
    if (open && !authUser) { setStatus('idle'); setError(''); setEmail(''); setCode(''); }
    if (!open) { setEditingName(false); setEditNameInput(''); setError(''); }
  }, [open]);

  // Auto-close only when sign-in completes AND name is already set
  useEffect(() => {
    if (authUser && open && displayName) onClose();
  }, [authUser?.id]);

  async function handleSendCode(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) { setError('Enter your email address'); return; }
    setStatus('sending');
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({ email: addr });
    if (err) { setError(err.message); setStatus('idle'); return; }
    setStatus('sent');
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    const token = code.trim();
    if (token.length !== 6) { setError('Enter the 6-digit code from your email'); return; }
    setStatus('verifying');
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (err) { setError(err.message); setStatus('sent'); return; }
  }

  async function handleSaveName(e) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) { setError('Enter your name'); return; }
    setStatus('saving');
    setError('');
    const { error: err } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (err) { setError(err.message); setStatus('idle'); return; }
    onClose();
  }

  async function handleSaveNameEdit(e) {
    e.preventDefault();
    const name = editNameInput.trim();
    if (!name) { setError('Enter your name'); return; }
    if (name === displayName) { setEditingName(false); return; }
    setStatus('saving');
    setError('');
    const { error: err } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (err) { setError(err.message); setStatus('idle'); return; }
    setEditingName(false);
    setStatus('idle');
  }

  async function handleSignOut() {
    setStatus('signingout');
    await supabase.auth.signOut();
    setStatus('idle');
    onClose();
  }

  // ── Signed-in + name set → account view ─────────────────────────────────────
  if (authUser && displayName) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Account">
        <div style={s.body}>
          <div style={s.accountCard}>
            <div style={s.accountAvatar}>
              {(editingName ? editNameInput[0] : displayName[0])?.toUpperCase() ?? '?'}
            </div>
            <div style={s.accountInfo}>
              {editingName ? (
                <form onSubmit={handleSaveNameEdit} style={s.nameEditForm}>
                  <input
                    style={s.nameEditInput}
                    value={editNameInput}
                    autoFocus
                    maxLength={32}
                    onChange={e => { setEditNameInput(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Escape') { setEditingName(false); setError(''); } }}
                  />
                  <button
                    type="submit"
                    disabled={status === 'saving'}
                    style={{ ...s.nameEditSaveBtn, ...(status === 'saving' ? s.btnDisabled : {}) }}
                  >
                    {status === 'saving' ? '…' : 'Save'}
                  </button>
                  <button type="button" style={s.nameEditCancelBtn} onClick={() => { setEditingName(false); setError(''); }}>✕</button>
                </form>
              ) : (
                <button
                  style={s.nameEditTrigger}
                  onClick={() => { setEditNameInput(displayName); setEditingName(true); }}
                >
                  <p style={s.accountName}>{displayName}</p>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              <p style={s.accountEmail}>{authUser.email}</p>
            </div>
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button
            style={{ ...s.outlineBtn, ...(status === 'signingout' ? s.btnDisabled : {}) }}
            disabled={status === 'signingout'}
            onClick={handleSignOut}
          >
            {status === 'signingout' ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </BottomSheet>
    );
  }

  // ── Signed-in but no name yet → name required ────────────────────────────────
  if (authUser && !displayName) {
    return (
      <BottomSheet open={open} onClose={undefined} title="One more thing">
        <div style={s.body}>
          <p style={s.intro}>
            What should we call you? This name will appear across all your projects.
          </p>
          <form onSubmit={handleSaveName} style={s.form}>
            <label style={s.label}>Your name</label>
            <input
              style={s.input}
              placeholder="e.g. Alex"
              value={nameInput}
              autoFocus
              onChange={e => { setNameInput(e.target.value); setError(''); }}
            />
            {error && <p style={s.error}>{error}</p>}
            <button
              type="submit"
              disabled={status === 'saving'}
              style={{ ...s.primaryBtn, ...(status === 'saving' ? s.btnDisabled : {}) }}
            >
              {status === 'saving' ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </BottomSheet>
    );
  }

  // ── Code sent → enter OTP ────────────────────────────────────────────────────
  if (status === 'sent' || status === 'verifying') {
    return (
      <BottomSheet open={open} onClose={onClose} title="Check your email">
        <div style={s.body}>
          <p style={s.intro}>
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
          </p>
          <form onSubmit={handleVerifyCode} style={s.form}>
            <label style={s.label}>Code</label>
            <input
              style={{ ...s.input, letterSpacing: '0.2em', fontSize: 22, textAlign: 'center' }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              autoFocus
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            />
            {error && <p style={s.error}>{error}</p>}
            <button
              type="submit"
              disabled={status === 'verifying'}
              style={{ ...s.primaryBtn, ...(status === 'verifying' ? s.btnDisabled : {}) }}
            >
              {status === 'verifying' ? 'Verifying…' : 'Verify'}
            </button>
          </form>
          <button style={s.outlineBtn} onClick={() => { setStatus('idle'); setCode(''); setError(''); }}>
            Use a different email
          </button>
        </div>
      </BottomSheet>
    );
  }

  // ── Default: sign-in form ────────────────────────────────────────────────────
  return (
    <BottomSheet open={open} onClose={onClose} title="Sign in">
      <div style={s.body}>
        <p style={s.intro}>
          Save your projects to your account and access them on any device.
          The app works fine without signing in too.
        </p>

        <form onSubmit={handleSendCode} style={s.form}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
          />
          {error && <p style={s.error}>{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{ ...s.primaryBtn, ...(status === 'sending' ? s.btnDisabled : {}) }}
          >
            {status === 'sending' ? 'Sending…' : 'Send code'}
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}


const s = {
  body: {
    padding: '20px 20px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  intro: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 1.6,
    marginBottom: 4,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },
  input: {
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
  },
  primaryBtn: {
    padding: '14px',
    borderRadius: radius.pill,
    background: colors.accent,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: font.sans,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(232,48,42,0.4)',
    transition: 'opacity 0.15s',
    marginTop: 4,
  },
  outlineBtn: {
    padding: '13px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: font.sans,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, boxShadow: 'none', cursor: 'not-allowed' },
  // Account view
  accountCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: '16px',
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: colors.accent,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    fontFamily: font.sans,
    flexShrink: 0,
  },
  accountInfo: { flex: 1, minWidth: 0 },
  accountName: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  accountEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameEditTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: font.sans,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  nameEditForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  nameEditInput: {
    flex: 1,
    minWidth: 0,
    padding: '6px 9px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.accent}`,
    background: colors.cardSecondary,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: font.sans,
  },
  nameEditSaveBtn: {
    padding: '6px 11px',
    borderRadius: radius.input,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  nameEditCancelBtn: {
    padding: '6px 9px',
    borderRadius: radius.input,
    background: colors.cardSecondary,
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  // Sent view
  sentCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '28px 20px',
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    textAlign: 'center',
  },
  sentTitle: { fontSize: 17, fontWeight: 700, color: colors.textPrimary },
  sentSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 1.6 },
};
