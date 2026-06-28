// js/charts.js
// Minimal canvas-based chart helpers — no external library dependency.
// Keeps the page lightweight and offline-capable.

/**
 * Draws a horizontal bar chart showing counts for each label.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{label: string, value: number, color: string}>} data
 */
export function drawBarChart(canvas, data) {
  const ctx    = canvas.getContext("2d");
  const dpr    = window.devicePixelRatio || 1;
  const W      = canvas.clientWidth;
  const H      = canvas.clientHeight;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!data.length) return;

  const maxVal   = Math.max(...data.map((d) => d.value), 1);
  const rowH     = H / data.length;
  const labelW   = 110;
  const barArea  = W - labelW - 50;
  const padding  = rowH * 0.2;
  const isDark   = document.documentElement.classList.contains("dark");
  const textClr  = isDark ? "#a0aec0" : "#4a5568";

  ctx.font      = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";

  data.forEach(({ label, value, color }, i) => {
    const y      = i * rowH + padding;
    const barH   = rowH - padding * 2;
    const barW   = (value / maxVal) * barArea;

    // Bar
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx, labelW, y, Math.max(barW, 2), barH, 3);
    ctx.fill();

    // Label (left)
    ctx.fillStyle  = textClr;
    ctx.textAlign  = "right";
    ctx.fillText(label, labelW - 8, y + barH / 2 + 4);

    // Value (right of bar)
    ctx.fillStyle  = color;
    ctx.textAlign  = "left";
    ctx.fillText(value.toLocaleString(), labelW + barW + 6, y + barH / 2 + 4);
  });
}

/**
 * Draws a donut chart (alive vs dead ratio).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} alive
 * @param {number} total
 */
export function drawDonutChart(canvas, alive, total) {
  const ctx  = canvas.getContext("2d");
  const dpr  = window.devicePixelRatio || 1;
  const W    = canvas.clientWidth;
  const H    = canvas.clientHeight;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const cx   = W / 2;
  const cy   = H / 2;
  const r    = Math.min(cx, cy) - 10;
  const inner = r * 0.6;
  const dead = total - alive;
  const isDark = document.documentElement.classList.contains("dark");

  const segments = [
    { value: alive, color: "#4ade80" },
    { value: dead,  color: isDark ? "#2d3748" : "#e2e8f0" },
  ];

  let start = -Math.PI / 2;
  segments.forEach(({ value, color }) => {
    if (!value) return;
    const slice = (value / Math.max(total, 1)) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    start += slice;
  });

  // Inner cutout
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? "#111827" : "#ffffff";
  ctx.fill();

  // Centre label
  const pct = total ? Math.round((alive / total) * 100) : 0;
  ctx.fillStyle = isDark ? "#e2e8f0" : "#1a202c";
  ctx.font      = `bold ${Math.round(r * 0.38)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${pct}%`, cx, cy - 6);
  ctx.font      = `10px 'JetBrains Mono', monospace`;
  ctx.fillStyle = isDark ? "#718096" : "#718096";
  ctx.fillText("alive", cx, cy + 14);
}

// ── Utility ────────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
