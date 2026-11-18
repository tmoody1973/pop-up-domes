// Free zoom: mouse wheel / trackpad (incl. ctrl+wheel pinch on macOS), two-finger touch pinch, and the + / - / 0 keys.
// Drives follow.zoomBy(); follow.js eases the distance and blends toward a high map view when zoomed far out.
// [phone] Also owns multi-finger taps (2, 3, 4 fingers, short and still) -> onTap(fingers): the touch stand-ins for N / V / M.

const WHEEL_RATE = 0.0015; // zoom factor per wheel delta pixel
const KEY_STEP = 1.25;
const TAP_MS = 350; // a multi-finger tap: all fingers down and up within this, ...
const TAP_SLOP = 14; // ... none moving further than this (CSS px)

export function createZoom({ domElement, follow, onTap = () => {} }) {
  const onWheel = (e) => {
    e.preventDefault(); // stop the page itself from scrolling or browser-zooming
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines -> pixels
    const rate = e.ctrlKey ? WHEEL_RATE * 4 : WHEEL_RATE; // trackpad pinch arrives as small ctrl+wheel deltas
    follow.zoomBy(Math.exp(px * rate));
  };

  // two-finger pinch: zoom by the change in finger spread
  const touches = new Map();
  let lastSpread = 0;
  const starts = new Map(); let tapT0 = 0; let tapMax = 0; let tapMoved = false;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const onPointerDown = (e) => {
    if (e.pointerType !== 'touch') return;
    if (touches.size === 0) { tapT0 = e.timeStamp; tapMax = 0; tapMoved = false; }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    starts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tapMax = Math.max(tapMax, touches.size);
    if (touches.size === 2) lastSpread = spread();
  };
  const onPointerMove = (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s0 = starts.get(e.pointerId);
    if (s0 && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > TAP_SLOP) tapMoved = true;
    if (touches.size !== 2) return;
    const s = spread();
    if (lastSpread > 0 && s > 0) follow.zoomBy(lastSpread / s); // fingers apart -> closer
    lastSpread = s;
  };
  const onPointerUp = (e) => {
    if (!touches.delete(e.pointerId)) return;
    starts.delete(e.pointerId);
    if (touches.size < 2) lastSpread = 0;
    if (touches.size === 0 && tapMax >= 2 && !tapMoved && e.type === 'pointerup' && e.timeStamp - tapT0 < TAP_MS) onTap(tapMax);
  };

  const onKey = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') follow.zoomBy(1 / KEY_STEP);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') follow.zoomBy(KEY_STEP);
    else if (e.code === 'Digit0' || e.code === 'Numpad0') follow.resetZoom();
  };

  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKey);

  return {
    dispose() {
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKey);
    },
  };
}
