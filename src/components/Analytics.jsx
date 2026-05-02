import { useState } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { fmt } from '../lib/settlement.js';
import { CAT_ICONS } from '../lib/categories.js';
import Avatar from './ui/Avatar.jsx';

const CAT_COLORS = {
  'Food & Drink':     { bg: '#2D1A0A', accent: '#E8732A' },
  'Transport':        { bg: '#0A1A2D', accent: '#2A8AE8' },
  'Accommodation':    { bg: '#0A2D1A', accent: '#2AE87A' },
  'Entertainment':    { bg: '#1A0A2D', accent: '#8A2AE8' },
  'Shopping':         { bg: '#2D0A1A', accent: '#E82A72' },
  'Utilities':        { bg: '#1A2D0A', accent: '#72E82A' },
  'Flights':          { bg: '#062028', accent: '#22D3EE' },
  'Activities':       { bg: '#281800', accent: '#F59E0B' },
  'Groceries':        { bg: '#042814', accent: '#34D399' },
  'Car Rental':       { bg: '#002820', accent: '#2DD4BF' },
  'Health & Medical': { bg: '#280608', accent: '#FB7185' },
  'Travel Insurance': { bg: '#080828', accent: '#818CF8' },
  'Visa & Fees':      { bg: '#281E00', accent: '#FBBF24' },
  'Other':            { bg: '#2A2A2A', accent: '#9E9A96' },
};

function getSpan(idx, pct) {
  if (idx === 0 && pct > 0.25) return { col: 2, row: 2 };
  if (idx <= 1 && pct > 0.15)  return { col: 1, row: 2 };
  return { col: 1, row: 1 };
}

export default function Analytics({ session, members, transactions, activeTab, onTabChange, onOpenProfile, currentMember, authUser }) {
  const [filterMember, setFilterMember] = useState('all');

  const memberId  = session?.memberId;

  // Expenses only (exclude settlements)
  const expenses = transactions.filter(t => !t.isSettlement);

  const filtered = filterMember === 'all'
    ? expenses
    : expenses.filter(t => t.splitBetween.includes(filterMember));

  function relevantAmount(tx) {
    const usd = tx.amountUsd ?? tx.amount;
    if (filterMember === 'all') return usd;
    return usd / tx.splitBetween.length;
  }

  const catTotals = {};
  for (const tx of filtered) {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + relevantAmount(tx);
  }

  const totalSpend = Object.values(catTotals).reduce((s, v) => s + v, 0);

  const cats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({
      cat,
      amt,
      pct: totalSpend > 0 ? amt / totalSpend : 0,
    }));

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
          <h1 style={s.pageTitle}>Analytics</h1>
        </header>

        <div className="hide-scrollbar" style={s.filterScroll}>
          <button
            style={{ ...s.filterPill, padding: '7px 16px', ...(filterMember === 'all' ? s.filterPillActive : {}) }}
            onClick={() => setFilterMember('all')}
          >
            All
          </button>
          {members.map(m => {
            const active = filterMember === m.id;
            return (
              <button
                key={m.id}
                style={{ ...s.filterPill, ...(active ? s.filterPillActive : {}) }}
                onClick={() => setFilterMember(m.id)}
              >
                {m.avatarData
                  ? <img src={m.avatarData} alt={m.name} style={s.filterPillAvatarImg} />
                  : <div style={{
                      ...s.filterPillAvatar,
                      background: active ? 'rgba(255,255,255,0.25)' : colors.cardSecondary,
                      color: active ? '#fff' : colors.textSecondary,
                    }}>{m.name[0].toUpperCase()}</div>
                }
                {m.name}{m.id === memberId ? ' (you)' : ''}
              </button>
            );
          })}
        </div>

        <div style={s.totalRow}>
          <span style={s.totalLabel}>Total spend</span>
          <span style={s.totalAmt}>{fmt(totalSpend)}</span>
        </div>
      </div>

      {/* ── Scrollable bento grid ────────────────────────────────── */}
      <div style={s.scrollBody}>
        {cats.length === 0 ? (
          <div style={s.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke={colors.border} strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 3v9l5 3"/>
            </svg>
            <p style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
              No expenses yet.<br/>Add some to see analytics.
            </p>
          </div>
        ) : (
          <div style={s.grid}>
            {cats.map(({ cat, amt, pct }, idx) => {
              const span     = getSpan(idx, pct);
              const catColor = CAT_COLORS[cat] ?? CAT_COLORS['Other'];
              const isBig    = span.col === 2 && span.row === 2;
              const isTall   = span.row === 2 && span.col === 1;

              return (
                <div
                  key={cat}
                  style={{
                    ...s.card,
                    background:  catColor.bg,
                    border:      `1px solid ${catColor.accent}22`,
                    gridColumn:  `span ${span.col}`,
                    gridRow:     `span ${span.row}`,
                    minHeight:   span.row === 2 ? 200 : 110,
                  }}
                >
                  <div style={{
                    ...s.catIcon,
                    background: `${catColor.accent}22`,
                    color: catColor.accent,
                  }}>
                    <span style={{ fontSize: isBig ? 28 : 20 }}>{CAT_ICONS[cat] ?? '📌'}</span>
                  </div>

                  <div style={s.cardBody}>
                    <span style={{ ...s.catName, fontSize: isBig ? 15 : 12, color: '#9E9A96' }}>
                      {cat}
                    </span>
                    <span style={{
                      ...s.catAmt,
                      fontSize: isBig ? 28 : isTall ? 22 : 18,
                      color: colors.textPrimary,
                    }}>
                      {fmt(amt)}
                    </span>
                    <div style={s.barTrack}>
                      <div style={{
                        ...s.barFill,
                        width: `${Math.round(pct * 100)}%`,
                        background: catColor.accent,
                      }}/>
                    </div>
                    <span style={{ ...s.pctLabel, color: catColor.accent }}>
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                </div>
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
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
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
  pageTitle: {
    fontSize: 30,
    fontWeight: 700,
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.8px',
    lineHeight: 1.15,
  },
  filterScroll: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '16px 16px',
  },
  filterPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px 6px 8px',
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
    transition: 'all 0.12s',
  },
  filterPillAvatar: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 700,
    flexShrink: 0,
  },
  filterPillAvatarImg: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    display: 'block',
  },
  filterPillActive: {
    background: colors.accent,
    borderColor: colors.accent,
    color: '#fff',
  },
  totalRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '0 16px 16px',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  totalAmt: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: '-0.5px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    padding: '0 16px',
  },
  card: {
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
    transition: 'transform 0.12s',
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 'auto',
  },
  catName: {
    fontWeight: 600,
    letterSpacing: '0.2px',
  },
  catAmt: {
    fontWeight: 700,
    letterSpacing: '-0.5px',
    lineHeight: 1.1,
  },
  barTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    transition: 'width 0.4s ease',
  },
  pctLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 2,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 16px',
  },
};
