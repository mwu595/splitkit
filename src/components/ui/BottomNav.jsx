import { colors } from '../../styles/tokens.js';

// ─── SVG icons ────────────────────────────────────────────────────────────────

function GridIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function BarsIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4"  />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

function PersonIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Expenses', Icon: GridIcon  },
  { id: 'summary',   label: 'Summary',  Icon: BarsIcon  },
  { id: 'profile',   label: 'Profile',  Icon: PersonIcon },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        // Keep nav within the 480px app column on desktop
        maxWidth: 480,
        width: '100%',
        pointerEvents: 'none', // let clicks pass through the wrapper
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: colors.cardPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: 99,
        padding: '6px 8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        pointerEvents: 'all',
      }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              style={{
                position: 'relative',
                width: 52,
                height: 44,
                borderRadius: 99,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Active indicator circle */}
              {active && (
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 99,
                  background: colors.accent,
                  transition: 'opacity 0.2s',
                }} />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>
                <Icon color={active ? '#fff' : colors.textMuted} />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
