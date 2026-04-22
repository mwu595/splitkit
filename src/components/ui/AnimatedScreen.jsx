import { useEffect, useRef, useState } from 'react';

/**
 * Wraps children with a fade+slide transition whenever `screenKey` changes.
 * Uses CSS classes defined in globals.css:
 *   .screen-enter  — fadeSlideIn  0.28s spring
 *   .screen-exit   — fadeSlideOut 0.14s ease-in
 */
export default function AnimatedScreen({ children, screenKey }) {
  const [displayKey,      setDisplayKey]      = useState(screenKey);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [animClass,       setAnimClass]       = useState('screen-enter');
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey === prevKey.current) {
      // Same screen — just update children in place (e.g. data refresh)
      setDisplayChildren(children);
      return;
    }

    // New screen — exit current, then swap + enter
    setAnimClass('screen-exit');
    const exitTimer = setTimeout(() => {
      prevKey.current = screenKey;
      setDisplayKey(screenKey);
      setDisplayChildren(children);
      setAnimClass('screen-enter');

      const enterTimer = setTimeout(() => setAnimClass(''), 300);
      return () => clearTimeout(enterTimer);
    }, 140); // matches fadeSlideOut duration

    return () => clearTimeout(exitTimer);
  }, [screenKey, children]);

  return (
    <div key={displayKey} className={animClass} style={{ flex: 1 }}>
      {displayChildren}
    </div>
  );
}
