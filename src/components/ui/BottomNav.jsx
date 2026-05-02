import { colors, font } from '../../styles/tokens.js';

const BASE_ITEMS = [
  {
    id: 'dashboard',
    label: 'Expenses',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v9l5 3"/>
      </svg>
    ),
  },
];

const MY_PROJECTS_ITEM = {
  id: 'myprojects',
  label: 'Projects',
  icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 12h18M3 17h18"/>
    </svg>
  ),
};

export default function BottomNav({ activeTab, onTabChange, authUser }) {
  const ITEMS = authUser ? [...BASE_ITEMS, MY_PROJECTS_ITEM] : BASE_ITEMS;

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        {ITEMS.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              style={s.tab}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div style={{
                ...s.iconWrap,
                background: active ? 'rgba(232,48,42,0.13)' : 'transparent',
              }}>
                <span style={{ color: active ? colors.accent : colors.textMuted, display: 'flex' }}>
                  {item.icon}
                </span>
              </div>
              <span style={{
                ...s.label,
                color: active ? colors.textPrimary : colors.textMuted,
                fontWeight: active ? 700 : 500,
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 100,
    pointerEvents: 'none',
  },
  card: {
    background: colors.cardPrimary,
    borderTop: `1px solid ${colors.border}`,
    padding: '10px 4px 6px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'auto',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '4px 4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
  },
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  label: {
    fontSize: 10,
    letterSpacing: '0.2px',
    fontFamily: font.sans,
  },
};
