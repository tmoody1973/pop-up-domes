// Free zoom: mouse wheel / trackpad (incl. ctrl+wheel pinch on macOS), two-finger touch pinch, and the + / - / 0 keys.
// Drives follow.zoomBy(); follow.js eases the distance and blends toward a high map view when zoomed far out.

const WHEEL_RATE = 0.0015; // zoom factor per wheel delta pixel
const KEY_STEP = 1.25;

export function createZoom({ domElement, follow }) {
  const onWheel = (e) => {
    e.preventDefault(); // stop the page itself from scrolling or browser-zooming
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines -> pixels
    const rate = e.ctrlKey ? WHEEL_RATE * 4 : WHEEL_RATE; // trackpad pinch arrives as small ctrl+wheel deltas
    follow.zoomBy(Math.exp(px * rate));
  };

  // two-finger pinch: zoom by the change in finger spread
  const touches = new Map();
  let lastSpread = 0;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const onPointerDown = (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) lastSpread = spread();
  };
  const onPointerMove = (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2) return;
    const s = spread();
    if (lastSpread > 0 && s > 0) follow.zoomBy(lastSpread / s); // fingers apart -> closer
    lastSpread = s;
  };
  const onPointerUp = (e) => { touches.delete(e.pointerId); if (touches.size < 2) lastSpread = 0; };

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
