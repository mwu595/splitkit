import { useState, useEffect } from 'react';
import { colors, font, radius } from '../styles/tokens.js';
import { addTransaction } from '../lib/db.js';
import { fmt } from '../lib/settlement.js';
import { CATEGORIES, CAT_ICONS } from '../lib/categories.js';
import { CURRENCIES, DEFAULT_CURRENCY, getCurrency } from '../lib/currencies.js';
import { getExchangeRates, getExchangeRateData, convertToUsd, fmtUsdRate } from '../lib/exchangeRates.js';
import BottomSheet from './ui/BottomSheet.jsx';

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const LAST_CURRENCY_KEY = 'splitkit_last_currency';

function getLastCurrency() {
  try {
    const code = localStorage.getItem(LAST_CURRENCY_KEY);
    if (code) return getCurrency(code) ?? DEFAULT_CURRENCY;
  } catch {}
  return DEFAULT_CURRENCY;
}

function saveLastCurrency(code) {
  try { localStorage.setItem(LAST_CURRENCY_KEY, code); } catch {}
}

function initForm(memberId, memberIds) {
  return {
    amount:       '',
    description:  '',
    date:         todayStr(),
    category:     'Food & Drink',
    currency:     getLastCurrency(),
    paidBy:       memberId,
    splitBetween: memberIds,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddTransaction({ open, onClose, session, members }) {
  const activeMembers = members.filter(m => !m.removedAt);
  const memberIds = activeMembers.map(m => m.id);
  const [form,                setForm]                = useState(() => initForm(session?.memberId, memberIds));
  const [error,               setError]               = useState('');
  const [saving,              setSaving]              = useState(false);
  const [amountFocused,       setAmountFocused]       = useState(false);
  const [showCurrencyPicker,  setShowCurrencyPicker]  = useState(false);
  const [showCategoryPicker,  setShowCategoryPicker]  = useState(false);
  const [currencySearch,      setCurrencySearch]      = useState('');
  const [rateData,            setRateData]            = useState({ rates: {}, fetchedAt: null });

  // Load rates when currency picker opens
  useEffect(() => {
    if (showCurrencyPicker) {
      getExchangeRateData().then(setRateData).catch(() => {});
    }
  }, [showCurrencyPicker]);

  useEffect(() => {
    if (open) {
      setForm(initForm(session?.memberId, activeMembers.map(m => m.id)));
      setError('');
      setAmountFocused(false);
      setCurrencySearch('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setError('');
  }

  function toggleSplit(id) {
    setForm(f => ({
      ...f,
      splitBetween: f.splitBetween.includes(id)
        ? f.splitBetween.filter(x => x !== id)
        : [...f.splitBetween, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!form.description.trim()) { setError('Add a description'); return; }
    if (!amt || amt <= 0)          { setError('Enter a valid amount'); return; }
    if (!form.splitBetween.length) { setError('Select at least one person to split with'); return; }

    setSaving(true);
    try {
      const rates    = await getExchangeRates();
      const amountUsd = convertToUsd(amt, form.currency.code, rates);
      await addTransaction(session.code, {
        description:  form.description.trim(),
        amount:       Math.round(amt * 100) / 100,
        date:         form.date,
        category:     form.category,
        paidBy:       form.paidBy,
        splitBetween: form.splitBetween,
        isSettlement: false,
        currencyCode: form.currency.code,
        amountUsd,
      });
      onClose();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const amt        = parseFloat(form.amount) || 0;
  const splitCount = form.splitBetween.length;
  const perPerson  = splitCount > 0 && amt > 0 ? amt / splitCount : 0;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Add Expense">
        <form onSubmit={handleSubmit} style={s.form}>

          {/* ── Amount row: [currency btn] | [amount input] ──────────── */}
          <div style={s.inputRow}>
            <button
              type="button"
              style={s.selectorBtn}
              onClick={() => setShowCurrencyPicker(true)}
            >
              <div style={s.currencyBox}>
                <span style={s.currencySymbol}>{form.currency.symbol}</span>
              </div>
              <Chevron />
            </button>
            <input
              style={{ ...s.rowInput, ...s.amountInput, ...(amountFocused || form.amount ? {} : s.amountPlaceholder) }}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder={amountFocused ? '' : '0.00'}
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
            />
          </div>

          {/* ── Description row: [category btn] | [description input] ── */}
          <div style={s.inputRow}>
            <button
              type="button"
              style={s.selectorBtn}
              onClick={() => setShowCategoryPicker(true)}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{CAT_ICONS[form.category]}</span>
              <Chevron />
            </button>
            <div style={s.rowDivider} />
            <input
              style={s.rowInput}
              placeholder="What is it for?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* ── Date ──────────────────────────────────────────────────── */}
          <div style={s.field}>
            <label style={s.label}>Date</label>
            <input
              style={s.input}
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          {/* ── Paid by ───────────────────────────────────────────────── */}
          <div style={s.field}>
            <label style={s.label}>Paid by</label>
            <div style={s.pillRow}>
              {activeMembers.map(m => {
                const active = form.paidBy === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    style={{ ...s.pill, ...(active ? s.pillActive : {}) }}
                    onClick={() => set('paidBy', m.id)}
                  >
                    {m.avatarData
                      ? <img src={m.avatarData} alt={m.name} style={s.pillAvatarImg} />
                      : <div style={{
                          ...s.pillAvatar,
                          background: active ? 'rgba(255,255,255,0.25)' : colors.cardPrimary,
                          color: active ? '#fff' : colors.textSecondary,
                        }}>{m.name[0].toUpperCase()}</div>
                    }
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Split between ─────────────────────────────────────────── */}
          <div style={s.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={s.label}>Split between</label>
              {perPerson > 0 && (
                <span style={{ fontSize: 12, color: colors.accent, fontWeight: 700 }}>
                  {fmt(perPerson)} each
                </span>
              )}
            </div>
            <div style={s.pillRow}>
              {activeMembers.map(m => {
                const active = form.splitBetween.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    style={{ ...s.pill, ...(active ? s.pillActive : {}) }}
                    onClick={() => toggleSplit(m.id)}
                  >
                    {m.avatarData
                      ? <img src={m.avatarData} alt={m.name} style={s.pillAvatarImg} />
                      : <div style={{
                          ...s.pillAvatar,
                          background: active ? 'rgba(255,255,255,0.25)' : colors.cardPrimary,
                          color: active ? '#fff' : colors.textSecondary,
                        }}>{m.name[0].toUpperCase()}</div>
                    }
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            style={{ ...s.submitBtn, ...(saving ? s.submitDisabled : {}) }}
          >
            {saving ? 'Saving…' : 'Save Expense'}
          </button>

        </form>
      </BottomSheet>

      {/* ── Currency picker ───────────────────────────────────────── */}
      <BottomSheet
        open={showCurrencyPicker}
        onClose={() => { setShowCurrencyPicker(false); setCurrencySearch(''); }}
        title="Currency"
        fixedHeight="80svh"
      >
        {/* Sticky: search bar + rate date — never scrolls */}
        <div style={{ flexShrink: 0, padding: '0 20px 4px' }}>
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

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={s.pickerList}>
            {CURRENCIES
              .filter(c => {
                const q = currencySearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  c.code.toLowerCase().includes(q) ||
                  c.name.toLowerCase().includes(q) ||
                  c.symbol.toLowerCase().includes(q)
                );
              })
              .map(c => {
                const active   = form.currency.code === c.code;
                const rateStr  = fmtUsdRate(c.code, rateData.rates);
                return (
                  <button
                    key={c.code}
                    style={{ ...s.pickerRow, ...(active ? s.pickerRowActive : {}) }}
                    onClick={() => { set('currency', c); saveLastCurrency(c.code); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                  >
                    <div style={s.currencySymbolBox}>
                      <span style={{ ...s.currencySymbolText, color: active ? colors.accent : colors.textPrimary }}>
                        {c.symbol}
                      </span>
                    </div>
                    <div style={s.pickerRowInfo}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
                        {c.name}
                      </span>
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

      {/* ── Category picker ───────────────────────────────────────── */}
      <BottomSheet
        open={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        title="Category"
        fixedHeight="80svh"
      >
        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={s.pickerList}>
            {CATEGORIES.map(c => {
              const active = form.category === c;
              return (
                <button
                  key={c}
                  style={{ ...s.pickerRow, ...(active ? s.pickerRowActive : {}) }}
                  onClick={() => { set('category', c); setShowCategoryPicker(false); }}
                >
                  <div style={s.catIconBox}>
                    <span style={{ fontSize: 26 }}>{CAT_ICONS[c]}</span>
                  </div>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
                    {c}
                  </span>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '0 20px',
  },

  // ── Two-column input rows ──────────────────────────────────────
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
  rowDivider: {
    display: 'none',
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
  amountPlaceholder: {
    color: `${colors.accent}4D`,
  },

  // ── Other fields ──────────────────────────────────────────────
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  input: {
    padding: '11px 13px',
    borderRadius: radius.input,
    border: `1.5px solid ${colors.border}`,
    fontSize: 14,
    fontFamily: font.sans,
    color: colors.textPrimary,
    background: colors.cardSecondary,
    outline: 'none',
  },

  // ── Pills (Paid by + Split between) ───────────────────────────
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px 7px 8px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
    fontSize: 13,
    fontWeight: 500,
    color: colors.textSecondary,
    cursor: 'pointer',
    fontFamily: font.sans,
    transition: 'all 0.12s',
  },
  pillActive: {
    background: colors.accent,
    borderColor: colors.accent,
    color: '#fff',
  },
  pillAvatar: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  pillAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    display: 'block',
  },

  // ── Currency search ───────────────────────────────────────────
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

  // ── Picker sheets (currency + category) ───────────────────────
  pickerList: {
    padding: '0 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  pickerRow: {
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
  pickerRowActive: {
    background: colors.settlementBg,
  },
  pickerRowInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    textAlign: 'left',
  },
  currencySymbolBox: {
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
  currencySymbolText: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
  },
  catIconBox: {
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

  // ── Submit ────────────────────────────────────────────────────
  error: {
    fontSize: 13,
    color: colors.accent,
    background: colors.settlementBg,
    border: `1px solid ${colors.settlementBorder}`,
    borderRadius: radius.input,
    padding: '9px 13px',
    lineHeight: 1.5,
  },
  submitBtn: {
    padding: '14px',
    borderRadius: radius.pill,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    boxShadow: '0 4px 20px rgba(232,48,42,0.4)',
    transition: 'opacity 0.15s',
    marginBottom: 4,
  },
  submitDisabled: {
    opacity: 0.5,
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
};
