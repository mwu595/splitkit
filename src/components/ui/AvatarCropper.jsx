import { useState, useRef, useEffect, useCallback } from 'react';
import { colors, font, radius } from '../../styles/tokens.js';
import BottomSheet from './BottomSheet.jsx';

const CROP_SIZE   = 260;
const OUTPUT_SIZE = 200;

function clampPan(img, pan, zoom) {
  if (!img) return pan;
  const fitScale = CROP_SIZE / Math.min(img.width, img.height);
  const drawW    = img.width  * fitScale * zoom;
  const drawH    = img.height * fitScale * zoom;
  const maxX     = Math.max(0, (drawW - CROP_SIZE) / 2);
  const maxY     = Math.max(0, (drawH - CROP_SIZE) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export default function AvatarCropper({ imageSrc, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const zoomRef   = useRef(1);
  const panRef    = useRef({ x: 0, y: 0 });
  const dragRef   = useRef(null);
  const pinchRef  = useRef(null);
  const ptrMap    = useRef(new Map());

  const [zoom,      setZoom]      = useState(1);
  const [pan,       setPan]       = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  // Load image
  useEffect(() => {
    if (!imageSrc) {
      setImgLoaded(false);
      imgRef.current = null;
      return;
    }
    setImgLoaded(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      zoomRef.current = 1;
      panRef.current  = { x: 0, y: 0 };
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw canvas
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const img    = imgRef.current;
    const z      = zoom;
    const p      = pan;

    const fitScale = CROP_SIZE / Math.min(img.width, img.height);
    const drawW    = img.width  * fitScale * z;
    const drawH    = img.height * fitScale * z;
    const drawX    = CROP_SIZE / 2 + p.x - drawW / 2;
    const drawY    = CROP_SIZE / 2 + p.y - drawH / 2;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Dim outside the crop circle
    ctx.save();
    ctx.fillStyle = 'rgba(15,14,14,0.78)';
    ctx.beginPath();
    ctx.rect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();

    // Subtle circle border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [zoom, pan, imgLoaded]);

  // Helpers (stable — only read refs and call stable setters)
  const applyZoom = useCallback((newZoom) => {
    const z = Math.max(1, Math.min(4, newZoom));
    const p = clampPan(imgRef.current, panRef.current, z);
    zoomRef.current = z;
    panRef.current  = p;
    setZoom(z);
    setPan(p);
  }, []);

  const applyPan = useCallback((newPan) => {
    const p = clampPan(imgRef.current, newPan, zoomRef.current);
    panRef.current = p;
    setPan(p);
  }, []);

  // Pointer events (handles mouse + touch via Pointer Events API)
  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrMap.current.size === 1) {
      dragRef.current  = { startX: e.clientX, startY: e.clientY, startPan: { ...panRef.current } };
      pinchRef.current = null;
    } else if (ptrMap.current.size === 2) {
      const pts = [...ptrMap.current.values()];
      pinchRef.current = {
        startDist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        startZoom: zoomRef.current,
      };
      dragRef.current = null;
    }
  }, []);

  const onPointerMove = useCallback((e) => {
    ptrMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrMap.current.size === 1 && dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      applyPan({ x: dragRef.current.startPan.x + dx, y: dragRef.current.startPan.y + dy });
    } else if (ptrMap.current.size === 2 && pinchRef.current) {
      const pts  = [...ptrMap.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      applyZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist));
    }
  }, [applyPan, applyZoom]);

  const onPointerUp = useCallback((e) => {
    ptrMap.current.delete(e.pointerId);
    if (ptrMap.current.size < 2) pinchRef.current = null;
    if (ptrMap.current.size === 0) dragRef.current = null;
  }, []);

  // Scroll-to-zoom (non-passive — must be added via useEffect)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded) return;
    const onWheel = (e) => {
      e.preventDefault();
      applyZoom(zoomRef.current * (1 - e.deltaY * 0.001));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [imgLoaded, applyZoom]);

  // Confirm: render crop to 200×200 and return base64 JPEG
  function handleConfirm() {
    if (!imgRef.current) return;
    const img   = imgRef.current;
    const out   = document.createElement('canvas');
    out.width   = OUTPUT_SIZE;
    out.height  = OUTPUT_SIZE;
    const ctx   = out.getContext('2d');
    const ratio = OUTPUT_SIZE / CROP_SIZE;

    const fitScale = OUTPUT_SIZE / Math.min(img.width, img.height);
    const drawW    = img.width  * fitScale * zoomRef.current;
    const drawH    = img.height * fitScale * zoomRef.current;
    const drawX    = OUTPUT_SIZE / 2 + panRef.current.x * ratio - drawW / 2;
    const drawY    = OUTPUT_SIZE / 2 + panRef.current.y * ratio - drawH / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    onConfirm(out.toDataURL('image/jpeg', 0.82));
  }

  return (
    <BottomSheet open={!!imageSrc} onClose={onCancel} title="Adjust Photo" fixedHeight="85svh">
      <div style={s.content}>

        {/* Crop canvas */}
        <div style={s.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={CROP_SIZE}
            height={CROP_SIZE}
            style={s.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {!imgLoaded && (
            <div style={s.loadingOverlay}>
              <span style={{ color: colors.textMuted, fontSize: 13, fontFamily: font.sans }}>Loading…</span>
            </div>
          )}
        </div>

        {/* Hint */}
        <p style={s.hint}>Drag to reposition · Pinch or slide to zoom</p>

        {/* Zoom slider */}
        <div style={s.sliderRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="range"
            min="1" max="4" step="0.01"
            value={zoom}
            onChange={e => applyZoom(parseFloat(e.target.value))}
            style={s.slider}
          />
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>

        {/* Action buttons */}
        <div style={s.btnRow}>
          <button style={s.cancelBtn} onClick={onCancel} type="button">Cancel</button>
          <button
            style={{ ...s.confirmBtn, ...(!imgLoaded ? { opacity: 0.5 } : {}) }}
            onClick={handleConfirm}
            disabled={!imgLoaded}
            type="button"
          >
            Use Photo
          </button>
        </div>

      </div>
    </BottomSheet>
  );
}

const s = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 20px 32px',
    gap: 20,
  },
  canvasWrap: {
    position: 'relative',
    width: CROP_SIZE,
    height: CROP_SIZE,
    flexShrink: 0,
  },
  canvas: {
    display: 'block',
    width: CROP_SIZE,
    height: CROP_SIZE,
    touchAction: 'none',
    cursor: 'grab',
    userSelect: 'none',
    background: colors.bg,
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.cardSecondary,
    borderRadius: '50%',
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: font.sans,
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  slider: {
    flex: 1,
    accentColor: colors.accent,
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: radius.pill,
    border: `1.5px solid ${colors.border}`,
    background: colors.cardSecondary,
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    cursor: 'pointer',
    fontFamily: font.sans,
  },
  confirmBtn: {
    flex: 2,
    padding: '14px',
    borderRadius: radius.pill,
    border: 'none',
    background: colors.accent,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.sans,
  },
};
