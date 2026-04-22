import { useEffect, useRef, useState } from 'react';
import { colors } from '../../styles/tokens.js';

/**
 * Reusable slide-up bottom sheet with animated backdrop.
 *
 * Props:
 *   open        {boolean}   — controls visibility
 *   onClose     {function}  — called when backdrop tapped or close button pressed
 *   title       {string?}   — optional header title (renders handle + title + × button)
 *   fixedHeight {string?}   — CSS height (e.g. "80svh") — locks sheet to that height and
 *                             makes the children area a flex column so sticky/scrollable
 *                             sub-sections work. Without this prop, sheet auto-sizes.
 *   children    {ReactNode}
 */
export default function BottomSheet({ open, onClose, title, children, fixedHeight }) {
  const [mounted,  setMounted]  = useState(false);
  const [showing,  setShowing]  = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (open) {
      setMounted(true);
      // Tiny delay so the browser paints the element before the animation fires
      timerRef.current = setTimeout(() => setShowing(true), 16);
    } else {
      setShowing(false);
      // Wait for sheetDown (0.2s) + small buffer before unmounting
      timerRef.current = setTimeout(() => setMounted(false), 280);
    }

    return () => clearTimeout(timerRef.current);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: showing ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        backdropFilter: showing ? 'blur(4px)' : 'none',
        transition: 'background 0.28s, backdrop-filter 0.28s',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        className={showing ? 'sheet-enter' : 'sheet-exit'}
        style={{
          width: '100%',
          maxWidth: 480,
          background: colors.cardPrimary,
          borderRadius: '20px 20px 0 0',
          WebkitOverflowScrolling: 'touch',
          // Fixed-height mode: lock height, flex column so children control their own scroll
          ...(fixedHeight
            ? { height: fixedHeight, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : { maxHeight: '92svh', overflowY: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }
          ),
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — always pinned, never scrolls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 0 8px',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 4,
            borderRadius: 99,
            background: colors.border,
          }} />
        </div>

        {/* Optional header — always pinned, never scrolls */}
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 20px 16px',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 17,
              fontWeight: 700,
              color: colors.textPrimary,
            }}>
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: colors.cardSecondary,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6"  x2="6"  y2="18" />
                <line x1="6"  y1="6"  x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Content area — in fixed-height mode this is a flex column that fills remaining space */}
        {fixedHeight ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          }}>
            {children}
          </div>
        ) : children}
      </div>
    </div>
  );
}
