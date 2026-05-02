import { useState } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { fmt, computeBalances } from '../lib/settlement.js';
import { CAT_ICONS } from '../lib/categories.js';
import { getCurrency } from '../lib/currencies.js';
import Avatar from './ui/Avatar.jsx';

/** Format a transaction amount — non-USD shows "kr5,000 ($33.44)". */
function fmtTx(tx) {
  const amount = tx.amount;
  const code   = tx.currencyCode ?? 'USD';
  if (code === 'USD') return fmt(amount);
  const symbol = getCurrency(code).symbol;
  const local  = `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  return tx.amountUsd != null ? `${local} (${fmt(tx.amountUsd)})` : local;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr) {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function groupByDate(transactions) {
  const map = {};
  for (const tx of transactions) {
    if (!map[tx.date]) map[tx.date] = [];
    map[tx.date].push(tx);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsRow({ transactions, members, memberId }) {
  const expenses      = transactions.filter(t => !t.isSettlement);
  const activeMembers = members.filter(m => !m.removedAt);
  const totalSpent    = expenses.reduce((s, t) => s + (t.amountUsd ?? t.amount), 0);

  const balances  = computeBalances(members, transactions);
  const myBalance = balances.find(b => b.id === memberId)?.balance ?? 0;
  const isPositive = myBalance > 0.005;
  const isNegative = myBalance < -0.005;
  const balanceColor = isPositive ? colors.positive : isNegative ? colors.accent : colors.textSecondary;
  const balanceLabel = isPositive ? "You're owed" : isNegative ? 'You owe' : 'Settled up';

  return (
    <div style={s.statsRow}>
      <div style={s.stat}>
        <span style={s.statVal}>{activeMembers.length}</span>
        <span style={s.statLabel}>Members</span>
      </div>
      <div style={s.statDivider} />
      <div style={s.stat}>
        <span style={s.statVal}>{fmt(totalSpent)}</span>
        <span style={s.statLabel}>Total spent</span>
      </div>
      <div style={s.statDivider} />
      <div style={s.stat}>
        <span style={{ ...s.statVal, color: balanceColor }}>{fmt(Math.abs(myBalance))}</span>
        <span style={s.statLabel}>{balanceLabel}</span>
      </div>
    </div>
  );
}

function TxCard({ tx, memberMap, memberId, onClick }) {
  const isSettlement = tx.isSettlement;
  const payerName    = memberMap[tx.paidBy] ?? 'Someone';
  const splitNames   = tx.splitBetween.map(id => memberMap[id] ?? id);

  const splitLabel = isSettlement
    ? null
    : splitNames.length > 2
      ? `${splitNames.length} ways`
      : `w/ ${splitNames.filter(n => n !== payerName).join(', ') || 'self'}`;

  const perPersonShare =
    !isSettlement && tx.splitBetween.includes(memberId) && tx.paidBy !== memberId
      ? fmt((tx.amountUsd ?? tx.amount) / tx.splitBetween.length)
      : null;

  const youPaidLabel =
    !isSettlement && tx.splitBetween.includes(memberId) && tx.paidBy === memberId
      ? 'you paid'
      : null;

  return (
    <div
      className="tx-card"
      style={{ ...s.txCard, ...(isSettlement ? s.txCardSettlement : {}) }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div style={{ ...s.txIcon, background: isSettlement ? colors.settlementBg : colors.cardSecondary }}>
        <span style={{ fontSize: 18 }}>
          {isSettlement ? '💸' : (CAT_ICONS[tx.category] ?? '📌')}
        </span>
      </div>
      <div style={s.txInfo}>
        <span style={s.txDesc}>{tx.description}</span>
        <span style={s.txMeta}>
          {isSettlement
            ? <span style={{ color: colors.accent, fontWeight: 500 }}>Settlement</span>
            : <>{payerName} paid{splitLabel ? ` · ${splitLabel}` : ''}</>
          }
        </span>
      </div>
      <div style={s.txRight}>
        <span style={s.txAmt}>{fmtTx(tx)}</span>
        {(perPersonShare || youPaidLabel) && (
          <span style={s.txShare}>{perPersonShare ?? youPaidLabel}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard({
  project, session, members, transactions, loading, currentMember, authUser,
  onAddExpense, onEditTx, activeTab, onTabChange, onOpenProfile,
}) {
  const [filter, setFilter]   = useState('All');
  const [copied, setCopied]   = useState(false);

  const memberId  = session?.memberId;
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));

  const expenses = transactions.filter(t => !t.isSettlement);
  const usedCats = [...new Set(expenses.map(t => t.category))];
  const categories = ['All', ...usedCats];

  const displayed = filter === 'All'
    ? transactions
    : transactions.filter(t => t.isSettlement || t.category === filter);

  const grouped = groupByDate(displayed);

  function copyCode() {
    navigator.clipboard.writeText(session.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
          </div>
          <h1 style={s.projectName}>{project?.name ?? '—'}</h1>
          <button style={s.codeBtn} onClick={copyCode} title="Copy project code">
            <span style={s.codeDigits}>
              {(session?.code ?? '------').split('').map((d, i) => (
                <span key={i} style={s.codeDigit}>{d}</span>
              ))}
            </span>
            <span style={{ fontSize: 11, color: copied ? colors.accent : colors.textMuted }}>
              {copied ? 'Copied!' : 'Copy code'}
            </span>
          </button>
        </header>

        <StatsRow transactions={transactions} members={members} memberId={memberId} />

        {categories.length > 2 && (
          <div className="hide-scrollbar" style={s.filterScroll}>
            {categories.map(c => (
              <button
                key={c}
                style={{ ...s.filterPill, ...(filter === c ? s.filterPillActive : {}) }}
                onClick={() => setFilter(c)}
              >
                {CAT_ICONS[c] && <span style={{ marginRight: 4 }}>{CAT_ICONS[c]}</span>}
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable transaction list ───────────────────────────── */}
      <div style={s.scrollBody}>
        <div style={s.list}>
          {loading && (
            <div style={s.empty}>
              <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading…</p>
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div style={s.empty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke={colors.border} strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="3"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <p style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                {filter === 'All' ? 'No expenses yet.' : `No ${filter} expenses.`}
              </p>
              {filter === 'All' && (
                <p style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                  Tap <strong style={{ color: colors.accent }}>Add Expense</strong> below.
                </p>
              )}
            </div>
          )}

          {!loading && grouped.map(([date, txs]) => (
            <div key={date}>
              <div style={s.dateHeader}>{formatDateLabel(date)}</div>
              {txs.map(tx => (
                <TxCard
                  key={tx.id}
                  tx={tx}
                  memberMap={memberMap}
                  memberId={memberId}
                  onClick={() => onEditTx(tx)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Expense FAB pill ─────────────────────────────────── */}
      <button style={s.fab} onClick={onAddExpense}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
        Add Expense
      </button>
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
    paddingBottom: 'calc(168px + env(safe-area-inset-bottom))',
  },
  header: {
    padding: '20px 16px 0',
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
  projectName: {
    fontSize: 30,
    fontWeight: 700,
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.8px',
    lineHeight: 1.15,
  },
  codeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: font.sans,
  },
  codeDigits: {
    display: 'flex',
    gap: 3,
  },
  codeDigit: {
    width: 18,
    height: 22,
    background: colors.cardPrimary,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    background: colors.cardPrimary,
    borderRadius: radius.card,
    margin: '16px 20px',
    padding: '14px 0',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '0 8px',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.4px',
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  statDivider: {
    width: 1,
    height: 36,
    background: colors.border,
    flexShrink: 0,
  },
  filterScroll: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '0 16px 14px',
  },
  filterPill: {
    padding: '6px 14px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardPrimary,
    fontSize: 13,
    fontWeight: 500,
    color: colors.textSecondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: font.sans,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.12s',
  },
  filterPillActive: {
    background: colors.accent,
    borderColor: colors.accent,
    color: '#fff',
  },
  list: {
    padding: '0 16px',
  },
  dateHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    padding: '16px 0 8px',
  },
  txCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: colors.cardPrimary,
    borderRadius: 14,
    padding: '13px 14px',
    marginBottom: 6,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  txCardSettlement: {
    background: colors.settlementBg,
    borderColor: colors.settlementBorder,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  txMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  txRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  txAmt: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  txShare: {
    fontSize: 11,
    color: colors.textMuted,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 16px',
  },
  fab: {
    position: 'fixed',
    bottom: 'calc(88px + env(safe-area-inset-bottom))',
    right: 'max(20px, calc(50vw - 220px))',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: colors.accent,
    color: '#fff',
    border: 'none',
    borderRadius: radius.pill,
    padding: '14px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    boxShadow: '0 4px 24px rgba(232,48,42,0.45)',
    zIndex: 50,
    whiteSpace: 'nowrap',
  },
};
