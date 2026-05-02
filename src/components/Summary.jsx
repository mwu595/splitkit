import { useState, useEffect } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { computeBalances, minimizeTransactions, fmt } from '../lib/settlement.js';
import { addSettlement } from '../lib/db.js';
import { CURRENCIES, getCurrency } from '../lib/currencies.js';
import { getExchangeRateData, convertToUsd, fmtUsdRate } from '../lib/exchangeRates.js';
import BottomSheet from './ui/BottomSheet.jsx';
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
      <Avatar member={member} size={36} isActive={isSelf} />
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

function TransferCard({ transfer, isMine, onSettle, fromMember, toMember }) {
  return (
    <div style={{ ...s.transferCard, ...(isMine ? s.transferCardMine : {}) }}>
      <div style={s.transferAvatars}>
        <Avatar member={fromMember} size={36} isActive={isMine} />
        <div style={s.transferArrow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
        <Avatar member={toMember} size={36} />
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
  const [pickerOpen,           setPickerOpen]           = useState(false);
  const [confirmOpen,          setConfirmOpen]          = useState(false);
  const [selected,             setSelected]             = useState(null);
  const [settleAmount,         setSettleAmount]         = useState('');
  const [settleCurrency,       setSettleCurrency]       = useState(() => getCurrency('USD'));
  const [settling,             setSettling]             = useState(false);
  const [error,                setError]                = useState('');
  const [memberPickerFor,      setMemberPickerFor]      = useState(null);
  const [showCurrencyPicker,   setShowCurrencyPicker]   = useState(false);
  const [currencySearch,       setCurrencySearch]       = useState('');
  const [rateData,             setRateData]             = useState({ rates: {}, fetchedAt: null });

  const memberId  = session?.memberId;
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));
  const memberById = Object.fromEntries(members.map(m => [m.id, m]));

  const balances  = computeBalances(members, transactions);
  const myBalance = balances.find(b => b.id === memberId)?.balance ?? 0;
  const transfers = minimizeTransactions(members, transactions);

  // Transfers where the current user is the debtor
  const myDebts = transfers.filter(t => t.from === memberId);

  useEffect(() => {
    if (showCurrencyPicker) {
      getExchangeRateData().then(setRateData).catch(() => {});
    }
  }, [showCurrencyPicker]);

  function openConfirm(transfer) {
    setSelected(transfer);
    setSettleAmount(String(transfer.amount));
    setSettleCurrency(getCurrency('USD'));
    setError('');
    setConfirmOpen(true);
  }

  function handleSettleClick(transfer) {
    openConfirm(transfer);
  }

  function handleSettleUpFab() {
    if (myDebts.length === 1) {
      openConfirm(myDebts[0]);
    } else if (myDebts.length > 1) {
      setPickerOpen(true);
    } else {
      const others = members.filter(m => !m.removedAt && m.id !== memberId);
      const defaultTo = others[0];
      if (!defaultTo) return;
      const currentMemberObj = members.find(m => m.id === memberId);
      setSelected({ from: memberId, fromName: currentMemberObj?.name ?? '', to: defaultTo.id, toName: defaultTo.name, amount: 0 });
      setSettleAmount('');
      setSettleCurrency(getCurrency('USD'));
      setError('');
      setConfirmOpen(true);
    }
  }

  async function confirmSettle() {
    if (!selected) return;
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setSettling(true);
    setError('');
    try {
      const rounded = Math.round(amt * 100) / 100;
      let amountUsd = rounded;
      if (settleCurrency.code !== 'USD') {
        const { rates } = await getExchangeRateData();
        amountUsd = Math.round(convertToUsd(rounded, settleCurrency.code, rates) * 100) / 100;
      }
      await addSettlement(
        session.code,
        selected.from,
        selected.to,
        rounded,
        selected.fromName,
        selected.toName,
        settleCurrency.code,
        amountUsd,
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
              {[...transfers].sort((a, b) => {
                const aRelevant = a.from === memberId || a.to === memberId;
                const bRelevant = b.from === memberId || b.to === memberId;
                return (bRelevant ? 1 : 0) - (aRelevant ? 1 : 0);
              }).map((t, i) => (
                <TransferCard
                  key={i}
                  transfer={t}
                  isMine={t.from === memberId}
                  onSettle={handleSettleClick}
                  fromMember={memberById[t.from]}
                  toMember={memberById[t.to]}
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

      {/* ── Settle FAB ──────────────────────────────────────────── */}
      <button style={s.fab} onClick={handleSettleUpFab}>
        Settle
      </button>

      {/* ── Debt picker sheet (multiple debts) ───────────────────── */}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Who are you paying?"
      >
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myDebts.map((t, i) => (
            <button
              key={i}
              style={s.pickerRow}
              onClick={() => {
                setPickerOpen(false);
                openConfirm(t);
              }}
            >
              <Avatar member={memberById[t.to]} size={36} />
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
        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selected && (
            <div style={s.confirmCard}>
              <div style={s.confirmAvatarRow}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={s.avatarRing} onClick={() => setMemberPickerFor('from')}>
                    <Avatar member={memberById[selected.from]} size={52} isActive />
                  </div>
                  <span style={{ fontSize: 12, color: colors.textSecondary }}>{selected.fromName}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, flexShrink: 0 }}>pays</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={s.avatarRing} onClick={() => setMemberPickerFor('to')}>
                    <Avatar member={memberById[selected.to]} size={52} />
                  </div>
                  <span style={{ fontSize: 12, color: colors.textSecondary }}>{selected.toName}</span>
                </div>
              </div>

              {/* Editable amount */}
              <div style={s.inputRow}>
                <button
                  type="button"
                  style={s.selectorBtn}
                  onClick={() => setShowCurrencyPicker(true)}
                >
                  <div style={s.currencyBox}>
                    <span style={s.currencySymbol}>{settleCurrency.symbol}</span>
                  </div>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <input
                  style={{ ...s.rowInput, ...s.amountInput }}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={e => { setSettleAmount(e.target.value); setError(''); }}
                />
              </div>
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

      {/* ── Member picker (payer / payee swap) ───────────────────── */}
      <BottomSheet
        open={memberPickerFor !== null}
        onClose={() => setMemberPickerFor(null)}
        title={memberPickerFor === 'from' ? "Who's paying?" : "Who are they paying?"}
      >
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.filter(m => !m.removedAt && m.id !== (memberPickerFor === 'from' ? selected?.to : selected?.from)).map(m => (
            <button
              key={m.id}
              style={s.pickerRow}
              onClick={() => {
                setSelected(prev => memberPickerFor === 'from'
                  ? { ...prev, from: m.id, fromName: m.name }
                  : { ...prev, to: m.id, toName: m.name }
                );
                setMemberPickerFor(null);
              }}
            >
              <div style={s.avatarRing}>
                <Avatar member={m} size={36} />
              </div>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
                {m.name}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── Currency picker ──────────────────────────────────────── */}
      <BottomSheet
        open={showCurrencyPicker}
        onClose={() => { setShowCurrencyPicker(false); setCurrencySearch(''); }}
        title="Currency"
        fixedHeight="80svh"
      >
        <div style={{ flexShrink: 0, padding: '0 16px 4px' }}>
          <div style={s.searchWrap}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              style={s.searchInput}
              placeholder="Search currencies…"
              value={currencySearch}
              onChange={e => setCurrencySearch(e.target.value)}
              autoComplete="off"
            />
            {currencySearch.length > 0 && (
              <button style={s.searchClear} onClick={() => setCurrencySearch('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {rateData.fetchedAt && (
            <p style={s.rateDate}>
              Rates as of {new Date(rateData.fetchedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={s.cpList}>
            {CURRENCIES
              .filter(c => {
                const q = currencySearch.trim().toLowerCase();
                if (!q) return true;
                return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
              })
              .map(c => {
                const active  = settleCurrency.code === c.code;
                const rateStr = fmtUsdRate(c.code, rateData.rates);
                return (
                  <button
                    key={c.code}
                    style={{ ...s.cpRow, ...(active ? s.cpRowActive : {}) }}
                    onClick={() => { setSettleCurrency(c); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                  >
                    <div style={s.cpSymbolBox}>
                      <span style={{ ...s.cpSymbolText, color: active ? colors.accent : colors.textPrimary }}>
                        {c.symbol}
                      </span>
                    </div>
                    <div style={s.cpRowInfo}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: colors.textMuted }}>{c.code}</span>
                      {rateStr && (
                        <span style={{ fontSize: 11, color: active ? colors.accent : colors.textMuted, fontWeight: 500 }}>
                          {rateStr}
                        </span>
                      )}
                    </div>
                    {active && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                );
              })
            }
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
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  section: {
    padding: '0 16px',
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
    background: 'none',
    border: 'none',
    color: colors.accent,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    padding: 0,
  },
  fab: {
    position: 'fixed',
    bottom: 'calc(88px + env(safe-area-inset-bottom))',
    right: 'max(20px, calc(50vw - 220px))',
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
    justifyContent: 'center',
    gap: 12,
  },
  avatarRing: {
    borderRadius: '50%',
    border: `2px solid ${colors.border}`,
    padding: 2,
    cursor: 'pointer',
    display: 'inline-flex',
    transition: 'border-color 0.15s',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    overflow: 'hidden',
  },
  selectorBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '12px 14px',
    minWidth: 72,
    background: colors.cardSecondary,
    border: 'none',
    borderRight: `1.5px solid ${colors.border}`,
    cursor: 'pointer',
    color: colors.textSecondary,
    fontFamily: font.sans,
    flexShrink: 0,
  },
  currencyBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: `${colors.accent}20`,
    border: `1.5px solid ${colors.accent}60`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.accent,
    lineHeight: 1,
  },
  rowInput: {
    flex: 1,
    padding: '16px 14px',
    border: 'none',
    background: colors.cardSecondary,
    fontSize: 15,
    color: colors.textPrimary,
    outline: 'none',
    fontFamily: font.sans,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: 700,
    color: colors.accent,
    caretColor: colors.accent,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    padding: '10px 14px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    color: colors.textPrimary,
    outline: 'none',
    fontFamily: font.sans,
  },
  searchClear: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
    background: 'none',
    border: 'none',
    padding: 2,
    cursor: 'pointer',
    flexShrink: 0,
  },
  rateDate: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.textMuted,
    textAlign: 'center',
    padding: '4px 0 8px',
    margin: 0,
  },
  cpList: {
    padding: '0 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  cpRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 14px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: font.sans,
    width: '100%',
    transition: 'background 0.1s',
  },
  cpRowActive: {
    background: colors.settlementBg,
  },
  cpRowInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    textAlign: 'left',
  },
  cpSymbolBox: {
    width: 44,
    height: 44,
    borderRadius: 11,
    background: colors.cardSecondary,
    border: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cpSymbolText: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
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
    padding: '32px 16px',
  },
};
