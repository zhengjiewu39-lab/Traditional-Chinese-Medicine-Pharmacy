/** Minimal dependency-free SVG charts for paper figures. */

const COLORS = {
  'fixed-allocation': '#9e9e9e',
  'reorder-point': '#8d6e63',
  'cost-first': '#1f77b4',
  'equity-aware': '#ff7f0e',
  'equity-constrained-rolling-horizon': '#2ca02c',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function niceRange(min, max, pad = 0.05) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max - min < 1e-9) return [min - 0.5, max + 0.5];
  const d = (max - min) * pad;
  return [min - d, max + d];
}

function ticks(lo, hi, n = 4) {
  const out = [];
  for (let i = 0; i <= n; i += 1) out.push(lo + ((hi - lo) * i) / n);
  return out;
}

function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  if (a >= 10) return v.toFixed(0);
  return v.toFixed(2);
}

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif" font-size="11">\n<rect width="100%" height="100%" fill="white"/>\n${body}\n</svg>\n`;
}

function legend(x, y, items) {
  return items.map((it, i) => `<g transform="translate(${x + i * 150},${y})"><rect width="12" height="12" fill="${it.color}"/><text x="16" y="10">${esc(it.label)}</text></g>`).join('\n');
}

/**
 * Small-multiple scatter panels: x = cost, y = worst-region essential fill; Pareto-efficient
 * points (cost ↓, worst-region fill ↑, unmet ↓) drawn with a black outline.
 */
function paretoPanels({ panels, labels, title }) {
  const cols = 4;
  const pw = 260;
  const ph = 200;
  const rows = Math.ceil(panels.length / cols);
  const W = cols * pw + 40;
  const H = rows * ph + 90;
  const parts = [`<text x="20" y="22" font-size="14" font-weight="bold">${esc(title)}</text>`];
  panels.forEach((p, idx) => {
    const ox = 20 + (idx % cols) * pw;
    const oy = 40 + Math.floor(idx / cols) * ph;
    const iw = pw - 60;
    const ih = ph - 60;
    const [x0, x1] = niceRange(Math.min(...p.points.map((q) => q.x)), Math.max(...p.points.map((q) => q.x)), 0.1);
    const [y0, y1] = niceRange(Math.min(...p.points.map((q) => q.y)), Math.max(...p.points.map((q) => q.y)), 0.1);
    const sx = (v) => ox + 45 + ((v - x0) / (x1 - x0)) * iw;
    const sy = (v) => oy + 20 + ih - ((v - y0) / (y1 - y0)) * ih;
    parts.push(`<text x="${ox + 45}" y="${oy + 12}" font-weight="bold">${esc(p.title)}</text>`);
    parts.push(`<rect x="${ox + 45}" y="${oy + 20}" width="${iw}" height="${ih}" fill="none" stroke="#ccc"/>`);
    for (const t of ticks(y0, y1, 3)) parts.push(`<text x="${ox + 41}" y="${sy(t) + 3}" text-anchor="end" font-size="9">${t.toFixed(2)}</text>`);
    for (const t of ticks(x0, x1, 2)) parts.push(`<text x="${sx(t)}" y="${oy + 32 + ih}" text-anchor="middle" font-size="9">${shortNum(t)}</text>`);
    const front = p.points.filter((q) => q.efficient).sort((a, b) => a.x - b.x);
    if (front.length > 1) {
      parts.push(`<polyline fill="none" stroke="#555" stroke-dasharray="3,2" points="${front.map((q) => `${sx(q.x)},${sy(q.y)}`).join(' ')}"/>`);
    }
    for (const q of p.points) {
      const r = 4 + 6 * (q.sizeNorm ?? 0);
      parts.push(`<circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="${r.toFixed(1)}" fill="${COLORS[q.policy] || '#333'}" fill-opacity="0.8" stroke="${q.efficient ? '#000' : 'none'}" stroke-width="1.5"><title>${esc(`${q.policy}: cost ${q.x.toFixed(0)}, worst fill ${q.y.toFixed(3)}, unmet ${q.z?.toFixed(0)}`)}</title></circle>`);
    }
  });
  parts.push(legend(20, H - 40, Object.entries(labels).map(([k, label]) => ({ color: COLORS[k] || '#333', label }))));
  parts.push(`<text x="20" y="${H - 12}" font-size="10">x: mean total cost; y: mean worst-region essential fill rate; marker size ∝ unmet essential demand; outlined = Pareto-efficient on (cost, worst-region fill, unmet). Synthetic data; 100 test seeds per point.</text>`);
  return svgDoc(W, H, parts.join('\n'));
}

function lineChart({ series, title, xLabel, yLabel, shade }) {
  const W = 720;
  const H = 360;
  const ml = 55;
  const mt = 35;
  const iw = W - ml - 20;
  const ih = H - mt - 80;
  const all = series.flatMap((s) => s.values);
  const n = Math.max(...series.map((s) => s.values.length));
  const [y0, y1] = niceRange(Math.min(...all), Math.max(...all));
  const sx = (i) => ml + (i / Math.max(1, n - 1)) * iw;
  const sy = (v) => mt + ih - ((v - y0) / (y1 - y0)) * ih;
  const parts = [`<text x="${ml}" y="20" font-size="14" font-weight="bold">${esc(title)}</text>`];
  if (shade) parts.push(`<rect x="${sx(shade[0])}" y="${mt}" width="${sx(shade[1]) - sx(shade[0])}" height="${ih}" fill="#fbe9e7"/>`);
  parts.push(`<rect x="${ml}" y="${mt}" width="${iw}" height="${ih}" fill="none" stroke="#ccc"/>`);
  for (const t of ticks(y0, y1, 4)) parts.push(`<text x="${ml - 5}" y="${sy(t) + 3}" text-anchor="end">${t.toFixed(2)}</text>`);
  for (let d = 0; d < n; d += 20) parts.push(`<text x="${sx(d)}" y="${mt + ih + 14}" text-anchor="middle">${d}</text>`);
  for (const s of series) {
    parts.push(`<polyline fill="none" stroke="${s.color}" stroke-width="1.8" points="${s.values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')}"/>`);
  }
  parts.push(`<text x="${ml + iw / 2}" y="${mt + ih + 32}" text-anchor="middle">${esc(xLabel)}</text>`);
  parts.push(`<text transform="translate(14,${mt + ih / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`);
  parts.push(legend(ml, H - 22, series.map((s) => ({ color: s.color, label: s.label }))));
  return svgDoc(W, H, parts.join('\n'));
}

function tornado({ rows, title, xLabel }) {
  const W = 640;
  const bh = 22;
  const ml = 210;
  const H = 70 + rows.length * bh + 40;
  const iw = W - ml - 30;
  const maxAbs = Math.max(0.05, ...rows.map((r) => Math.abs(r.value)));
  const sx = (v) => ml + iw / 2 + (v / maxAbs) * (iw / 2);
  const parts = [`<text x="20" y="22" font-size="14" font-weight="bold">${esc(title)}</text>`];
  rows.forEach((r, i) => {
    const y = 45 + i * bh;
    const x = Math.min(sx(0), sx(r.value));
    parts.push(`<text x="${ml - 6}" y="${y + 14}" text-anchor="end">${esc(r.label)}</text>`);
    parts.push(`<rect x="${x}" y="${y + 3}" width="${Math.abs(sx(r.value) - sx(0))}" height="${bh - 6}" fill="${r.value >= 0 ? '#2ca02c' : '#d62728'}"/>`);
    parts.push(`<text x="${r.value >= 0 ? sx(r.value) + 4 : sx(r.value) - 4}" y="${y + 14}" text-anchor="${r.value >= 0 ? 'start' : 'end'}" font-size="10">${r.value.toFixed(2)}</text>`);
  });
  const yEnd = 45 + rows.length * bh;
  parts.push(`<line x1="${sx(0)}" y1="40" x2="${sx(0)}" y2="${yEnd}" stroke="#333"/>`);
  parts.push(`<text x="${ml + iw / 2}" y="${yEnd + 25}" text-anchor="middle">${esc(xLabel)}</text>`);
  return svgDoc(W, H, parts.join('\n'));
}

function heatmap({ xs, ys, values, title, xLabel, yLabel, fmtCell = (v) => v.toFixed(2) }) {
  const cw = 80;
  const ch = 40;
  const ml = 90;
  const mt = 45;
  const W = ml + xs.length * cw + 40;
  const H = mt + ys.length * ch + 70;
  const flat = values.flat().filter(Number.isFinite);
  const maxAbs = Math.max(1e-6, ...flat.map(Math.abs));
  const color = (v) => {
    if (!Number.isFinite(v)) return '#eee';
    const t = Math.min(1, Math.abs(v) / maxAbs);
    const c = Math.round(255 - t * 160);
    return v >= 0 ? `rgb(${c},${255 - Math.round(t * 60)},${c})` : `rgb(255,${c},${c})`;
  };
  const parts = [`<text x="20" y="22" font-size="14" font-weight="bold">${esc(title)}</text>`];
  ys.forEach((yv, j) => {
    parts.push(`<text x="${ml - 6}" y="${mt + j * ch + ch / 2 + 4}" text-anchor="end">${esc(yv)}</text>`);
    xs.forEach((xv, i) => {
      const v = values[j][i];
      parts.push(`<rect x="${ml + i * cw}" y="${mt + j * ch}" width="${cw - 2}" height="${ch - 2}" fill="${color(v)}"/>`);
      parts.push(`<text x="${ml + i * cw + cw / 2}" y="${mt + j * ch + ch / 2 + 4}" text-anchor="middle">${Number.isFinite(v) ? fmtCell(v) : '—'}</text>`);
    });
  });
  xs.forEach((xv, i) => parts.push(`<text x="${ml + i * cw + cw / 2}" y="${mt + ys.length * ch + 14}" text-anchor="middle">${esc(xv)}</text>`));
  parts.push(`<text x="${ml + (xs.length * cw) / 2}" y="${mt + ys.length * ch + 34}" text-anchor="middle">${esc(xLabel)}</text>`);
  parts.push(`<text transform="translate(14,${mt + (ys.length * ch) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`);
  return svgDoc(W, H, parts.join('\n'));
}

module.exports = { COLORS, paretoPanels, lineChart, tornado, heatmap };
