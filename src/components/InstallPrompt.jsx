import { useState, useEffect } from 'react';
import { colors, font, radius } from '../styles/tokens.js';

const DISMISSED_KEY = 'splitkit_install_dismissed';

export default function InstallPrompt() {
  const [prompt,    setPrompt]    = useState(null);  // BeforeInstallPromptEvent
  const [visible,   setVisible]   = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already dismissed by user
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    function handleBeforeInstall(e) {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setVisible(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    } else {
      dismiss();
    }
    setPrompt(null);
  }

  if (!visible || installed) return null;

  return (
    <div style={s.banner}>
      <div style={s.iconWrap}>
        <img src="/icons/icon-192x192.png" alt="Split Kit" style={s.icon} />
      </div>
      <div style={s.text}>
        <span style={s.title}>Add to Home Screen</span>
        <span style={s.sub}>Install Split Kit for the best experience</span>
      </div>
      <div style={s.actions}>
        <button style={s.installBtn} onClick={install}>Install</button>
        <button style={s.dismissBtn} onClick={dismiss} aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6"  y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const s = {
  banner: {
    position: 'fixed',
    bottom: 88,           // sits just above the BottomNav pill
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: 448,
    background: colors.cardPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 150,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: font.sans,
  },
  iconWrap: {
    flexShrink: 0,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'block',
  },
  text: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  installBtn: {
    padding: '8px 16px',
    borderRadius: radius.pill,
    background: colors.accent,
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
    whiteSpace: 'nowrap',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: colors.cardSecondary,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
};
