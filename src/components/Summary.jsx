import { useState } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { computeBalances, minimizeTransactions, fmt } from '../lib/settlement.js';
import { addSettlement } from '../lib/db.js';
import BottomSheet from './ui/BottomSheet.jsx';
import MenuButton from './ui/MenuButton.jsx';
import Avatar from './ui/Avatar.jsx';

// ─── Sub-components ───────────────────────────────────────────────────────────

function BalanceBanner({ balance }) {
  const isPositive = balance > 0.005;
  const isNegative = balance < -0.005;
  const isEven     = !isPositive && !isNegative;

  const bg     = isPositive ? '#0D2B0D' : isNegative ? colors.settlementBg   : colors.cardPrimary;
  const border = isPositive ? '#1A4A1A' : isNegative ? colors.settlementBorder : colors.border;
  const color  = isPositive ? colors.positive : isNegative ? colors.accent : colors.textSecondary;

  const label  = isEven
    ? 'You\'re all square'
    : isPositive
      ? `You're owed`
      : `You owe`;

  return (
    <div style={{ ...s.banner, background: bg, border: `1px solid ${border}` }}>
      <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>{label}</span>
      {!isEven && (
        <span style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-1px' }}>
          {fmt(Math.abs(balance))}
        </span>
      )}
      {isEven && (
        <span style={{ fontSize: 28, marginTop: 4 }}>🎉</span>
      )}
    </div>
  );
}

function MemberBalanceRow({ member, isSelf }) {
  const isPositive = member.balance > 0.005;
  const isNegative = member.balance < -0.005;
  const isEven     = !isPositive && !isNegative;

  const pillColor  = isPositive ? colors.positive : isNegative ? colors.accent : colors.textMuted;
  const pillBg     = isPositive ? 'rgba(110,207,110,0.12)' : isNegative ? 'rgba(232,48,42,0.12)' : colors.cardSecondary;
  const label      = isEven ? 'settled' : isPositive ? `+${fmt(member.balance)}` : fmt(member.balance);

  return (
    <div style={s.memberRow}>
      <div style={{
        ...s.avatar,
        background: isSelf ? colors.accent : colors.cardSecondary,
        color: isSelf ? '#fff' : colors.textSecondary,
      }}>
        {member.name[0].toUpperCase()}
      </div>
      <div style={s.memberInfo}>
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
          {member.name}
          {isSelf && <span style={s.youBadge}>you</span>}
        </span>
      </div>
      <div style={{ ...s.balancePill, background: pillBg, color: pillColor }}>
        {label}
      </div>
    </div>
  );
}

function TransferCard({ transfer, isMine, onSettle }) {
  return (
    <div style={{ ...s.transferCard, ...(isMine ? s.transferCardMine : {}) }}>
      <div style={s.transferAvatars}>
        <div style={{ ...s.avatar, background: isMine ? colors.accent : colors.cardSecondary, color: isMine ? '#fff' : colors.textSecondary }}>
          {transfer.fromName[0].toUpperCase()}
        </div>
        <div style={s.transferArrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
        <div style={{ ...s.avatar, background: colors.cardSecondary, color: colors.textSecondary }}>
          {transfer.toName[0].toUpperCase()}
        </div>
      </div>
      <div style={s.transferInfo}>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>
          <strong style={{ color: colors.textPrimary }}>{transfer.fromName}</strong>
          {' pays '}
          <strong style={{ color: colors.textPrimary }}>{transfer.toName}</strong>
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: isMine ? colors.accent : colors.textPrimary }}>
          {fmt(transfer.amount)}
        </span>
      </div>
      {isMine && (
        <button style={s.settleBtn} onClick={() => onSettle(transfer)}>
          Settle →
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Summary({ session, members, transactions, activeTab, onTabChange, onOpenProfile, currentMember, authUser }) {
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [selected,      setSelected]      = useState(null); // transfer object
  const [settleAmount,  setSettleAmount]  = useState('');
  const [settling,      setSettling]      = useState(false);
  const [error,         setError]         = useState('');

  const memberId  = session?.memberId;
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));

  const balances  = computeBalances(members, transactions);
  const myBalance = balances.find(b => b.id === memberId)?.balance ?? 0;
  const transfers = minimizeTransactions(members, transactions);

  // Transfers where the current user is the debtor
  const myDebts = transfers.filter(t => t.from === memberId);

  function openConfirm(transfer) {
    setSelected(transfer);
    setSettleAmount(String(transfer.amount));
    setError('');
    setConfirmOpen(true);
  }

  function handleSettleClick(transfer) {
    openConfirm(transfer);
  }

  function handleSettleUpFab() {
    if (myDebts.length === 0) return;
    if (myDebts.length === 1) {
      openConfirm(myDebts[0]);
    } else {
      setPickerOpen(true);
    }
  }

  async function confirmSettle() {
    if (!selected) return;
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setSettling(true);
    setError('');
    try {
      await addSettlement(
        session.code,
        selected.from,
        selected.to,
        Math.round(amt * 100) / 100,
        selected.fromName,
        selected.toName,
      );
      setConfirmOpen(false);
      setPickerOpen(false);
      setSelected(null);
    } catch {
      setError('Could not record settlement. Please try again.');
    } finally {
      setSettling(false);
    }
  }

  return (
    <div style={s.root}>

      {/* ── Pinned header ────────────────────────────────────────── */}
      <div style={s.stickyTop}>
        <header style={s.header}>
          <div style={s.headerTopRow}>
            <button style={s.avatarBtn} onClick={onOpenProfile} aria-label="Profile">
              <Avatar member={currentMember} size={38} isActive />
            </button>
            <MenuButton activeTab={activeTab} onTabChange={onTabChange} authUser={authUser} />
          </div>
          <h1 style={s.title}>Summary</h1>
        </header>
        <BalanceBanner balance={myBalance} />
      </div>

      {/* ── Scrollable content ───────────────────────────────────── */}
      <div style={s.scrollBody}>
        {/* ── Member balances ────────────────────────────────────── */}
        <section style={s.section}>
          <p style={s.sectionLabel}>Balances</p>
          <div style={s.card}>
            {balances.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <div style={s.divider} />}
                <MemberBalanceRow member={m} isSelf={m.id === memberId} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Pay-back plan ──────────────────────────────────────── */}
        {transfers.length > 0 && (
          <section style={s.section}>
            <p style={s.sectionLabel}>Pay-back plan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transfers.map((t, i) => (
                <TransferCard
                  key={i}
                  transfer={t}
                  isMine={t.from === memberId}
                  onSettle={handleSettleClick}
                />
              ))}
            </div>
          </section>
        )}

        {transfers.length === 0 && transactions.length > 0 && (
          <div style={s.allSettled}>
            <span style={{ fontSize: 32 }}>✅</span>
            <p style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
              All debts settled!
            </p>
          </div>
        )}
      </div>

      {/* ── Settle Up FAB ───────────────────────────────────────── */}
      {myDebts.length > 0 && (
        <button style={s.fab} onClick={handleSettleUpFab}>
          Settle Up
        </button>
      )}

      {/* ── Debt picker sheet (multiple debts) ───────────────────── */}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Who are you paying?"
      >
        <div style={{ padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myDebts.map((t, i) => (
            <button
              key={i}
              style={s.pickerRow}
              onClick={() => {
                setPickerOpen(false);
                openConfirm(t);
              }}
            >
              <div style={{ ...s.avatar, background: colors.cardSecondary, color: colors.textSecondary }}>
                {t.toName[0].toUpperCase()}
              </div>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
                {t.toName}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: colors.accent }}>
                {fmt(t.amount)}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── Confirm settlement sheet ─────────────────────────────── */}
      <BottomSheet
        open={confirmOpen}
        onClose={() => { if (!settling) { setConfirmOpen(false); setError(''); } }}
        title="Confirm Settlement"
      >
        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selected && (
            <div style={s.confirmCard}>
              <div style={s.confirmAvatarRow}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ ...s.avatarLg, background: colors.accent, color: '#fff' }}>
                    {selected.fromName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, color: colors.textSecondary }}>{selected.fromName}</span>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ ...s.avatarLg, background: colors.cardSecondary, color: colors.textSecondary }}>
                    {selected.toName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, color: colors.textSecondary }}>{selected.toName}</span>
                </div>
              </div>

              {/* Editable amount */}
              <div style={s.amountBlock}>
                <span style={s.amountCurrency}>$</span>
                <input
                  style={s.amountInput}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={settleAmount}
                  onChange={e => { setSettleAmount(e.target.value); setError(''); }}
                />
              </div>

              <p style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
                Mark this as paid outside the app — cash, bank transfer, etc.
              </p>
            </div>
          )}
          {error && (
            <p style={s.error}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              style={s.cancelBtn}
              onClick={() => { setConfirmOpen(false); setError(''); }}
              disabled={settling}
            >
              Cancel
            </button>
            <button
              style={{ ...s.confirmBtn, ...(settling ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              onClick={confirmSettle}
              disabled={settling}
            >
              {settling ? 'Recording…' : 'Mark as Paid'}
            </button>
          </div>
        </div>
      </BottomSheet>
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
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(140px + env(safe-area-inset-bottom))',
  },
  header: {
    padding: '20px 20px 0',
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
    cursor: 'pointer',
    padding: 0,
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
  banner: {
    margin: '16px 20px',
    borderRadius: radius.card,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  section: {
    padding: '0 20px',
    marginBottom: 20,
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
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 16px',
  },
  memberInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: '0 16px',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  avatarLg: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  youBadge: {
    marginLeft: 7,
    fontSize: 10,
    fontWeight: 700,
    color: colors.accent,
    background: 'rgba(232,48,42,0.12)',
    borderRadius: 4,
    padding: '2px 5px',
    verticalAlign: 'middle',
  },
  balancePill: {
    fontSize: 13,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  transferCard: {
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  transferCardMine: {
    background: colors.settlementBg,
    borderColor: colors.settlementBorder,
  },
  transferAvatars: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  transferArrow: {
    display: 'flex',
    alignItems: 'center',
  },
  transferInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  settleBtn: {
    padding: '8px 14px',
    borderRadius: radius.pill,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  fab: {
    position: 'fixed',
    bottom: 'calc(32px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '14px 32px',
    borderRadius: radius.pill,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    boxShadow: '0 4px 24px rgba(232,48,42,0.5)',
    whiteSpace: 'nowrap',
    zIndex: 100,
  },
  pickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 14px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
    cursor: 'pointer',
    fontFamily: font.sans,
    width: '100%',
    marginBottom: 4,
  },
  confirmCard: {
    background: colors.cardSecondary,
    borderRadius: radius.card,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  confirmAvatarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '12px 20px',
    background: colors.settlementBg,
    borderRadius: radius.input,
    border: `1px solid ${colors.settlementBorder}`,
  },
  amountCurrency: {
    fontSize: 24,
    fontWeight: 300,
    color: colors.accent,
    lineHeight: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  amountInput: {
    fontSize: 38,
    fontWeight: 700,
    color: colors.accent,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    width: 150,
    textAlign: 'center',
    fontFamily: font.sans,
    caretColor: colors.accent,
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
  cancelBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: font.sans,
    color: colors.textPrimary,
  },
  confirmBtn: {
    flex: 2,
    padding: '13px',
    borderRadius: radius.pill,
    border: 'none',
    background: colors.accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    boxShadow: '0 4px 16px rgba(232,48,42,0.4)',
  },
  allSettled: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 20px',
  },
};
