import { useState, useRef } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import {
  updateMemberName, leaveProject,
  updateMemberAvatar, updateProjectName,
  addMemberByName, removeMember, restoreMember,
} from '../lib/db.js';
import { getDeviceId } from '../lib/deviceId.js';
import Avatar from './ui/Avatar.jsx';
import AvatarCropper from './ui/AvatarCropper.jsx';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile({ session, members, currentMember, project, onLeave, onJoinOrCreate, refresh }) {
  const fileInputRef = useRef(null);

  // Own name editing
  const [editing,       setEditing]       = useState(false);
  const [nameInput,     setNameInput]     = useState('');
  const [savingName,    setSavingName]    = useState(false);
  const [nameError,     setNameError]     = useState('');

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError,     setAvatarError]     = useState('');
  const [cropSrc,         setCropSrc]         = useState(null);

  // Project name (admin only)
  const [editingProject,     setEditingProject]     = useState(false);
  const [projectNameInput,   setProjectNameInput]   = useState('');
  const [savingProject,      setSavingProject]      = useState(false);
  const [projectNameError,   setProjectNameError]   = useState('');

  // Add member (admin only)
  const [addingMember,     setAddingMember]     = useState(false);
  const [newMemberName,    setNewMemberName]    = useState('');
  const [addingMemberSave, setAddingMemberSave] = useState(false);
  const [addMemberError,   setAddMemberError]   = useState('');

  // Remove / restore
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [editMemberId,    setEditMemberId]    = useState(null);
  const [removingId,      setRemovingId]      = useState(null);
  const [restoringId,     setRestoringId]     = useState(null);

  // Leave
  const [confirmLeave,  setConfirmLeave]  = useState(false);
  const [leaving,       setLeaving]       = useState(false);
  const [leaveError,    setLeaveError]    = useState('');

  // Copy code
  const [copied, setCopied] = useState(false);

  // Fall back to join-order: first member (oldest joined_at) is the project creator/admin.
  // This works before the DB migration is run; role='admin' takes over once it is.
  const isAdmin = currentMember?.role === 'admin' || members[0]?.id === session.memberId;

  // ── Own name ───────────────────────────────────────────────────────────────

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
      refresh();
    } catch {
      setNameError('Could not save. Please try again.');
    } finally {
      setSavingName(false);
    }
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  }

  function handleCropConfirm(base64) {
    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploadingAvatar(true);
    setAvatarError('');
    updateMemberAvatar(session.memberId, base64)
      .then(() => refresh())
      .catch((err) => {
        console.error('[splitkit] avatar upload failed:', err);
        setAvatarError('Could not upload photo. Try again.');
      })
      .finally(() => setUploadingAvatar(false));
  }

  function handleCropCancel() {
    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  // ── Project name ───────────────────────────────────────────────────────────

  function startEditProject() {
    setProjectNameInput(project?.name ?? '');
    setProjectNameError('');
    setEditingProject(true);
  }

  async function saveProjectName() {
    const trimmed = projectNameInput.trim();
    if (!trimmed) { setProjectNameError('Name cannot be empty'); return; }
    if (trimmed === project?.name) { setEditingProject(false); return; }
    setSavingProject(true);
    try {
      await updateProjectName(session.code, trimmed);
      setEditingProject(false);
      refresh();
    } catch {
      setProjectNameError('Could not save. Please try again.');
    } finally {
      setSavingProject(false);
    }
  }

  // ── Add member ─────────────────────────────────────────────────────────────

  async function handleAddMember() {
    const name = newMemberName.trim();
    if (!name) { setAddMemberError('Enter a name'); return; }
    setAddingMemberSave(true);
    try {
      await addMemberByName(session.code, name);
      setNewMemberName('');
      setAddingMember(false);
      setAddMemberError('');
      refresh();
    } catch {
      setAddMemberError('Could not add member. Try again.');
    } finally {
      setAddingMemberSave(false);
    }
  }

  // ── Remove / restore ───────────────────────────────────────────────────────

  async function handleRemove(memberId) {
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      setConfirmRemoveId(null);
      setEditMemberId(null);
      refresh();
    } catch {
      // silently ignore
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRestore(memberId) {
    setRestoringId(memberId);
    try {
      await restoreMember(memberId);
      refresh();
    } catch {
      // silently ignore
    } finally {
      setRestoringId(null);
    }
  }

  // ── Leave ──────────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>

      {/* ── Compact hero: avatar left, name right ───────────────── */}
      <div style={s.heroRow}>

        {/* Avatar with camera overlay */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            style={s.avatarTapBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change photo"
          >
            <Avatar member={currentMember} size={72} isActive />
            <div style={s.cameraOverlay}>
              {uploadingAvatar ? (
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>…</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          {avatarError && (
            <p style={{ fontSize: 10, color: colors.accent, marginTop: 4, textAlign: 'center', maxWidth: 72 }}>
              {avatarError}
            </p>
          )}
        </div>

        {/* Name + badges */}
        <div style={s.heroInfo}>
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
              <button style={s.cancelBtn} onClick={() => setEditing(false)}>✕</button>
            </div>
          ) : (
            <button style={s.nameBtn} onClick={startEdit}>
              <span style={s.nameText}>{currentMember?.name ?? '—'}</span>
              <span style={s.editHint}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit name
              </span>
            </button>
          )}
          {nameError && <p style={s.inlineError}>{nameError}</p>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {isAdmin && <span style={s.adminBadge}>admin</span>}
            <span style={s.youBadge}>you</span>
          </div>
        </div>
      </div>

      {/* ── Project info ─────────────────────────────────────────── */}
      <section style={s.section}>
        <p style={s.sectionLabel}>Project</p>
        <div style={s.card}>

          {/* Project name row */}
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Name</span>
            {isAdmin ? (
              editingProject ? (
                <div style={s.inlineEditRow}>
                  <input
                    style={s.inlineInput}
                    value={projectNameInput}
                    onChange={e => { setProjectNameInput(e.target.value); setProjectNameError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') saveProjectName(); if (e.key === 'Escape') setEditingProject(false); }}
                    autoFocus
                    maxLength={40}
                  />
                  <button
                    style={{ ...s.saveBtn, ...(savingProject ? { opacity: 0.5 } : {}) }}
                    onClick={saveProjectName}
                    disabled={savingProject}
                  >
                    {savingProject ? '…' : 'Save'}
                  </button>
                  <button style={s.cancelBtn} onClick={() => setEditingProject(false)}>✕</button>
                </div>
              ) : (
                <button style={s.editableValue} onClick={startEditProject}>
                  <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 500 }}>
                    {project?.name ?? '—'}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )
            ) : (
              <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 500 }}>{project?.name ?? '—'}</span>
            )}
          </div>
          {projectNameError && <p style={{ ...s.inlineError, padding: '0 16px 10px' }}>{projectNameError}</p>}

          <div style={s.divider} />

          {/* Code row */}
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

      {/* ── Admin: Add Member ────────────────────────────────────── */}
      {isAdmin && (
        <section style={s.section}>
          <p style={s.sectionLabel}>Add Member</p>
          {addingMember ? (
            <div style={s.addMemberForm}>
              <input
                style={s.addMemberInput}
                placeholder="Member's name"
                value={newMemberName}
                onChange={e => { setNewMemberName(e.target.value); setAddMemberError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddMember(); if (e.key === 'Escape') { setAddingMember(false); setNewMemberName(''); } }}
                autoFocus
                maxLength={32}
              />
              <button
                style={{ ...s.saveBtn, ...(addingMemberSave ? { opacity: 0.5 } : {}) }}
                onClick={handleAddMember}
                disabled={addingMemberSave}
              >
                {addingMemberSave ? '…' : 'Add'}
              </button>
              <button style={s.cancelBtn} onClick={() => { setAddingMember(false); setNewMemberName(''); setAddMemberError(''); }}>✕</button>
            </div>
          ) : (
            <button style={s.addMemberBtn} onClick={() => setAddingMember(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Member
            </button>
          )}
          {addMemberError && <p style={{ ...s.inlineError, marginTop: 8 }}>{addMemberError}</p>}
          <p style={s.addMemberHint}>
            They'll see this name in the join flow and can claim it.
          </p>
        </section>
      )}

      {/* ── Active members list ──────────────────────────────────── */}
      {(() => {
        const activeMembers  = members.filter(m => !m.removedAt);
        const removedMembers = members.filter(m => !!m.removedAt);

        function MemberCard({ list }) {
          return (
            <div style={s.card}>
              {list.map((m, i) => {
                const isSelf     = m.id === session.memberId;
                const isRemoved  = !!m.removedAt;
                const confirming = confirmRemoveId === m.id;
                const showRemove  = isAdmin && !isSelf && !isRemoved;
                const showRestore = isAdmin && isRemoved;

                return (
                  <div key={m.id}>
                    {i > 0 && <div style={s.divider} />}

                    {confirming ? (
                      <div style={s.confirmRow}>
                        <span style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                          Remove <strong style={{ color: colors.textPrimary }}>{m.name}</strong>?
                        </span>
                        <button style={s.cancelSmallBtn} onClick={() => { setConfirmRemoveId(null); setEditMemberId(null); }}>
                          Cancel
                        </button>
                        <button
                          style={{ ...s.confirmRemoveBtn, ...(removingId === m.id ? { opacity: 0.5 } : {}) }}
                          onClick={() => handleRemove(m.id)}
                          disabled={removingId === m.id}
                        >
                          {removingId === m.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ ...s.memberRow, ...(isRemoved ? s.memberRowRemoved : {}) }}>
                        <Avatar
                          member={isRemoved ? { ...m, avatarData: null } : m}
                          size={34}
                          isActive={isSelf && !isRemoved}
                        />
                        <div style={s.memberMeta}>
                          <span style={{
                            fontSize: 14, fontWeight: 600,
                            color: isRemoved ? colors.textMuted : colors.textPrimary,
                          }}>
                            {m.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(m.role === 'admin' || members[0]?.id === m.id) && <span style={s.adminBadgeSmall}>admin</span>}
                          {isSelf && <span style={s.youBadge}>you</span>}
                        </div>
                        {showRemove && editMemberId === m.id ? (
                          <>
                            <button style={s.removeBtn} onClick={() => setConfirmRemoveId(m.id)}>
                              Remove
                            </button>
                            <button style={s.editCloseBtn} onClick={() => setEditMemberId(null)}>✕</button>
                          </>
                        ) : showRemove ? (
                          <button style={s.editBtn} onClick={() => setEditMemberId(m.id)} aria-label="Edit member">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        ) : null}
                        {showRestore && (
                          <button
                            style={{ ...s.restoreBtn, ...(restoringId === m.id ? { opacity: 0.5 } : {}) }}
                            onClick={() => handleRestore(m.id)}
                            disabled={restoringId === m.id}
                          >
                            {restoringId === m.id ? '…' : 'Restore'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <>
            <section style={s.section}>
              <p style={s.sectionLabel}>Members · {activeMembers.length}</p>
              <MemberCard list={activeMembers} />
            </section>

            {removedMembers.length > 0 && (
              <section style={s.section}>
                <p style={s.sectionLabel}>Removed Members</p>
                <MemberCard list={removedMembers} />
              </section>
            )}
          </>
        );
      })()}


      {/* ── Join or create another project ───────────────────────── */}
      <section style={s.section}>
        <button style={s.joinBtn} onClick={onJoinOrCreate}>
          Join another or start a new project
        </button>
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

      {/* ── Avatar crop sheet ────────────────────────────────────── */}
      <AvatarCropper
        imageSrc={cropSrc}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    fontFamily: font.sans,
    paddingBottom: 32,
  },

  // ── Hero row ───────────────────────────────────────────────────
  heroRow: {
    margin: '20px 20px 0',
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  avatarTapBtn: {
    position: 'relative',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    borderRadius: '50%',
    flexShrink: 0,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${colors.cardPrimary}`,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  nameBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
    padding: 0,
  },
  nameText: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.3px',
  },
  editHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: 500,
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  nameInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.accent}`,
    background: colors.cardSecondary,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: font.sans,
    minWidth: 0,
  },
  saveBtn: {
    padding: '8px 12px',
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
  cancelBtn: {
    padding: '8px 10px',
    borderRadius: radius.input,
    background: colors.cardSecondary,
    border: `1.5px solid ${colors.border}`,
    color: colors.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  inlineError: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
  },
  adminBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#E8C92A',
    background: 'rgba(232,201,42,0.15)',
    border: '1px solid rgba(232,201,42,0.3)',
    borderRadius: 4,
    padding: '2px 7px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  adminBadgeSmall: {
    fontSize: 9,
    fontWeight: 700,
    color: '#E8C92A',
    background: 'rgba(232,201,42,0.15)',
    border: '1px solid rgba(232,201,42,0.3)',
    borderRadius: 4,
    padding: '1px 5px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.accent,
    background: 'rgba(232,48,42,0.12)',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },

  // ── Sections ───────────────────────────────────────────────────
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
  divider: {
    height: 1,
    background: colors.border,
    margin: '0 16px',
  },

  // ── Project section ────────────────────────────────────────────
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 16px',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: 500,
    flexShrink: 0,
  },
  editableValue: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
    padding: 0,
  },
  inlineEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  inlineInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.accent}`,
    background: colors.cardSecondary,
    fontSize: 14,
    fontWeight: 500,
    color: colors.textPrimary,
    fontFamily: font.sans,
    minWidth: 0,
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

  // ── Add member ─────────────────────────────────────────────────
  addMemberBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '13px 16px',
    borderRadius: radius.card,
    border: `1.5px dashed ${colors.border}`,
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: font.sans,
  },
  addMemberForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  addMemberInput: {
    flex: 1,
    padding: '11px 13px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.accent}`,
    background: colors.cardPrimary,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: font.sans,
    minWidth: 0,
  },
  addMemberHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 1.4,
  },

  // ── Member rows ────────────────────────────────────────────────
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 16px',
  },
  memberRowRemoved: {
    opacity: 0.55,
  },
  memberMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  removedLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.textMuted,
    background: colors.cardSecondary,
    borderRadius: 4,
    padding: '1px 5px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    flexShrink: 0,
  },
  removeBtn: {
    padding: '2px 6px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: colors.accent,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  restoreBtn: {
    padding: '5px 10px',
    borderRadius: 7,
    border: `1px solid ${colors.border}`,
    background: colors.cardSecondary,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 16px',
    background: colors.settlementBg,
  },
  cancelSmallBtn: {
    padding: '5px 10px',
    borderRadius: 7,
    border: `1px solid ${colors.border}`,
    background: colors.cardSecondary,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  confirmRemoveBtn: {
    padding: '5px 10px',
    borderRadius: 7,
    border: 'none',
    background: colors.accent,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },
  editBtn: {
    padding: '6px',
    borderRadius: 7,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editCloseBtn: {
    padding: '5px 8px',
    borderRadius: 7,
    border: `1px solid ${colors.border}`,
    background: colors.cardSecondary,
    color: colors.textMuted,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
  },

  // ── Join / create ──────────────────────────────────────────────
  joinBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: radius.input,
    background: 'transparent',
    border: `1.5px solid ${colors.border}`,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.sans,
  },

  // ── Leave ──────────────────────────────────────────────────────
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
