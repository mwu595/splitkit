import { useState } from 'react';
import { colors, font } from '../../styles/tokens.js';

const ITEMS = [
  {
    id: 'dashboard',
    label: 'Expenses',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v9l5 3"/>
      </svg>
    ),
  },
];

export default function MenuButton({ activeTab, onTabChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Bare 3-line hamburger */}
      <button style={s.btn} onClick={() => setOpen(o => !o)} aria-label="Menu">
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="0" y1="2"  x2="20" y2="2"/>
          <line x1="0" y1="8"  x2="20" y2="8"/>
          <line x1="0" y1="14" x2="20" y2="14"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Invisible backdrop to catch outside clicks */}
          <div style={s.backdrop} onClick={() => setOpen(false)} />
          {/* Anchored popover */}
          <div style={s.popover}>
            {ITEMS.map((item, i) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  style={{
                    ...s.item,
                    ...(active ? s.itemActive : {}),
                    ...(i < ITEMS.length - 1 ? { borderBottom: `1px solid ${colors.border}` } : {}),
                  }}
                  onClick={() => { onTabChange(item.id); setOpen(false); }}
                >
                  <span style={{ ...s.itemIcon, ...(active ? s.itemIconActive : {}) }}>
                    {item.icon}
                  </span>
                  <span style={{ ...s.itemLabel, ...(active ? s.itemLabelActive : {}) }}>
                    {item.label}
                  </span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  btn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textPrimary,
    fontFamily: font.sans,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 199,
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: colors.cardPrimary,
    borderRadius: '14px',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    zIndex: 200,
    minWidth: '160px',
    animation: 'popoverIn 0.15s cubic-bezier(0.22,1,0.36,1)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '13px 16px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: font.sans,
    transition: 'background 0.1s',
  },
  itemActive: { background: colors.settlementBg },
  itemIcon: { color: colors.textSecondary, display: 'flex', flexShrink: 0 },
  itemIconActive: { color: colors.accent },
  itemLabel: { fontSize: '14px', fontWeight: '600', color: colors.textSecondary, flex: 1, textAlign: 'left' },
  itemLabelActive: { color: colors.textPrimary },
};
