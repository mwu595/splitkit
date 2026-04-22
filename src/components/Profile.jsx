import { useState } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { updateMemberName, leaveProject } from '../lib/db.js';
import { getDeviceId } from '../lib/deviceId.js';

export default function Profile({ session, members, currentMember, onLeave }) {
  const [editing,       setEditing]       = useState(false);
  const [nameInput,     setNameInput]     = useState('');
  const [savingName,    setSavingName]    = useState(false);
  const [nameError,     setNameError]     = useState('');
  const [confirmLeave,  setConfirmLeave]  = useState(false);
  const [leaving,       setLeaving]       = useState(false);
  const [leaveError,    setLeaveError]    = useState('');
  const [copied,        setCopied]        = useState(false);

  const initial = (currentMember?.name ?? '?')[0].toUpperCase();

  function startEdit() {
    setNameInput(currentMember?.name ?? '');
    setNameError('');
    setEditing(true);
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('Name cannot be empty'); return; }
    if (trimmed === currentMember?.name) { setEditing(false); return; }
    setSavingName(true);
    try {
      await updateMemberName(session.memberId, trimmed);
      setEditing(false);
    } catch {
      setNameError('Could not save. Please try again.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    setLeaveError('');
    try {
      await leaveProject(session.memberId, getDeviceId());
      onLeave();
    } catch {
      setLeaveError('Could not leave. Please try again.');
      setLeaving(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(session.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={s.root}>
      {/* ── Avatar + name ───────────────────────────────────────── */}
      <div style={s.heroCard}>
        <div style={s.avatar}>{initial}</div>

        {editing ? (
          <div style={s.editRow}>
            <input
              style={s.nameInput}
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setNameError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              maxLength={32}
            />
            <button
              style={{ ...s.saveBtn, ...(savingName ? { opacity: 0.5 } : {}) }}
              onClick={saveName}
              disabled={savingName}
            >
              {savingName ? '…' : 'Save'}
            </button>
            <button style={s.cancelBtn} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button style={s.nameRow} onClick={startEdit}>
            <span style={s.name}>{currentMember?.name ?? '—'}</span>
            <span style={s.editHint}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit name
            </span>
          </button>
        )}

        {nameError && <p style={s.inlineError}>{nameError}</p>}
      </div>

      {/* ── Project info ─────────────────────────────────────────── */}
      <section style={s.section}>
        <p style={s.sectionLabel}>Project</p>
        <div style={s.card}>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Code</span>
            <button style={s.codeBtn} onClick={copyCode}>
              <span style={s.codeDigits}>
                {(session?.code ?? '------').split('').map((d, i) => (
                  <span key={i} style={s.codeDigit}>{d}</span>
                ))}
              </span>
              <span style={{ fontSize: 11, color: copied ? colors.accent : colors.textMuted, marginLeft: 6 }}>
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Members ──────────────────────────────────────────────── */}
      <section style={s.section}>
        <p style={s.sectionLabel}>Members · {members.length}</p>
        <div style={s.card}>
          {members.map((m, i) => {
            const isSelf = m.id === session.memberId;
            return (
              <div key={m.id}>
                {i > 0 && <div style={s.divider} />}
                <div style={s.memberRow}>
                  <div style={{
                    ...s.memberAvatar,
                    background: isSelf ? colors.accent : colors.cardSecondary,
                    color:      isSelf ? '#fff'        : colors.textSecondary,
                  }}>
                    {m.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, flex: 1 }}>
                    {m.name}
                  </span>
                  {isSelf && <span style={s.youBadge}>you</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Leave project ────────────────────────────────────────── */}
      <section style={s.section}>
        {!confirmLeave ? (
          <button style={s.leaveBtn} onClick={() => setConfirmLeave(true)}>
            Leave Project
          </button>
        ) : (
          <div style={s.confirmBox}>
            <p style={s.confirmText}>
              Leave <strong style={{ color: colors.textPrimary }}>this project</strong>?
              <span style={{ color: colors.textMuted }}> You can rejoin with the code.</span>
            </p>
            {leaveError && <p style={s.inlineError}>{leaveError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={s.cancelConfirmBtn}
                onClick={() => { setConfirmLeave(false); setLeaveError(''); }}
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                style={{ ...s.leaveConfirmBtn, ...(leaving ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                onClick={handleLeave}
                disabled={leaving}
              >
                {leaving ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    fontFamily: font.sans,
    paddingBottom: 32,
  },
  heroCard: {
    margin: '20px 20px 0',
    background: colors.cardPrimary,
    borderRadius: radius.card,
    border: `1px solid ${colors.border}`,
    padding: '24px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: colors.accent,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: '0 4px 20px rgba(232,48,42,0.35)',
  },
  nameRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
    padding: 0,
  },
  name: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.4px',
  },
  editHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 500,
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  nameInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.accent}`,
    background: colors.cardSecondary,
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: font.sans,
    textAlign: 'center',
  },
  saveBtn: {
    padding: '10px 16px',
    borderRadius: radius.input,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '10px 14px',
    borderRadius: radius.input,
    background: colors.cardSecondary,
    border: `1.5px solid ${colors.border}`,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  inlineError: {
    fontSize: 12,
    color: colors.accent,
    textAlign: 'center',
  },
  section: {
    padding: '20px 20px 0',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    marginBottom: 10,
  },
  card: {
    background: colors.cardPrimary,
    borderRadius: radius.card,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: 500,
  },
  codeBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
    padding: 0,
  },
  codeDigits: {
    display: 'flex',
    gap: 3,
  },
  codeDigit: {
    width: 20,
    height: 24,
    background: colors.cardSecondary,
    borderRadius: 5,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: '0 16px',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 16px',
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.accent,
    background: 'rgba(232,48,42,0.12)',
    borderRadius: 4,
    padding: '2px 6px',
  },
  leaveBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: radius.input,
    background: colors.settlementBg,
    border: `1.5px solid ${colors.settlementBorder}`,
    color: colors.accent,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.sans,
  },
  confirmBox: {
    background: colors.settlementBg,
    border: `1px solid ${colors.settlementBorder}`,
    borderRadius: radius.card,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 1.5,
  },
  cancelConfirmBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: font.sans,
    color: colors.textPrimary,
  },
  leaveConfirmBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: radius.pill,
    border: 'none',
    background: colors.accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
  },
};
