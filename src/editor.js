import { BP } from './core/blueprint.js';
import { HV, rotQ, normDir, railKey, railEndsOf, tmplVariants, tmplMQ, tmplPieces, tmplEnds, slotsAtEnd, railMoves, planRails } from './core/rails.js';

/* ===== Editor: estado, historial, índice y dibujo ===== */
const { DEFS, CATS, TILES, def, sz, tileDef, PORTS, PORTCOND } = BP;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const deep = o => o == null ? o : JSON.parse(JSON.stringify(o));
const K = (x, y) => x + ',' + y;
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const card = d => ((Math.round((d | 0) / 4) % 4) + 4) % 4;
const isCard = d => ((d | 0) % 4) === 0;
const vecDir = (sx, sy) => sx > 0 ? 4 : sx < 0 ? 12 : sy > 0 ? 8 : 0;
const UIF = '"Titillium Web","Segoe UI",system-ui,sans-serif';
const BB = '#2c2d30';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const newMeta = () => ({ label: '', description: '', icons: null, version: null, scheme: 2, extraBp: {}, schedules: null, stock: null });
const S = { ents: new Map(), tiles: new Map(), wires: [], nextId: 1, meta: newMeta(), target: 2 };
const sel = new Set(), selT = new Set();
let mode = 'select', tool = null, curDir = 0, ugFlip = false, held = null, clip = null;
let showGrid = true, showAreas = false, showWires = true;
const hover = { wx: 0, wy: 0, tx: 0, ty: 0, inside: false };
let dirty = true, idxDirty = true, P = null;

// ---------- historial ----------
let TX = null; const UNDO = [], REDO = [];
const cloneEnt = e => ({ id: e.id, name: e.name, n1: e.n1 || null, x: e.x, y: e.y, dir: e.dir | 0, xs: e.xs || 2, extra: deep(e.extra) || {} });
function txBegin() { if (!TX) TX = { e: new Map(), t: new Map(), w: null }; }
function tE(id) { if (TX && !TX.e.has(id)) TX.e.set(id, S.ents.has(id) ? cloneEnt(S.ents.get(id)) : null); }
function tT(k) { if (TX && !TX.t.has(k)) TX.t.set(k, S.tiles.get(k) || null); }
function tW() { if (TX && !TX.w) TX.w = S.wires.map(w => w.slice()); }
function txCommit() {
  const tx = TX; TX = null; if (!tx) return;
  const rec = { e: [], t: [], w: null };
  for (const [id, b] of tx.e) { const a = S.ents.has(id) ? cloneEnt(S.ents.get(id)) : null; if (JSON.stringify(a) !== JSON.stringify(b)) rec.e.push([id, b, a]); }
  for (const [k, b] of tx.t) { const a = S.tiles.get(k) || null; if ((a && a.name) !== (b && b.name)) rec.t.push([k, b, a]); }
  if (tx.w && JSON.stringify(tx.w) !== JSON.stringify(S.wires)) rec.w = [tx.w, S.wires.map(w => w.slice())];
  if (rec.e.length || rec.t.length || rec.w) { UNDO.push(rec); if (UNDO.length > 300) UNDO.shift(); REDO.length = 0; }
  changed();
}
function act(fn) { if (TX) return fn(); txBegin(); try { fn(); } finally { txCommit(); } }
function applyRec(rec, after) {
  for (const r of rec.e) { const v = after ? r[2] : r[1]; if (v) S.ents.set(r[0], cloneEnt(v)); else { S.ents.delete(r[0]); sel.delete(r[0]); } }
  for (const r of rec.t) { const v = after ? r[2] : r[1]; if (v) S.tiles.set(r[0], v); else { S.tiles.delete(r[0]); selT.delete(r[0]); } }
  if (rec.w) S.wires = (after ? rec.w[1] : rec.w[0]).map(w => w.slice());
}
function undo() { if (TX) txCommit(); const r = UNDO.pop(); if (!r) return toast('No hay nada que deshacer'); applyRec(r, false); REDO.push(r); changed(); }
function redo() { if (TX) txCommit(); const r = REDO.pop(); if (!r) return toast('No hay nada que rehacer'); applyRec(r, true); UNDO.push(r); changed(); }

// ---------- mutaciones ----------
function addEnt(o) { const id = S.nextId++; tE(id); S.ents.set(id, { id, name: o.name, n1: o.n1 || null, x: o.x, y: o.y, dir: o.dir | 0, xs: o.xs || 2, extra: deep(o.extra) || {} }); idxDirty = true; return id; }
function delEnt(id) { if (!S.ents.has(id)) return; tE(id); S.ents.delete(id); sel.delete(id); idxDirty = true; }
function setEnt(id, p) { const e = S.ents.get(id); if (!e) return; tE(id); Object.assign(e, p); idxDirty = true; }
function setTile(x, y, name) { const k = K(x, y); tT(k); if (name) S.tiles.set(k, { x, y, name }); else { S.tiles.delete(k); selT.delete(k); } }

// ---------- geometría e índice ----------
// ---------- vías: trazado y caché (la geometría base está en ./core/rails.js) ----------
const RPC = new Map();
function railPath(e) {
  const key = railKey(e.name, e.x, e.y, e.dir); let p = RPC.get(key); if (p) return p;
  const E = railEndsOf(e.name, e.x, e.y, e.dir); if (!E) return null;
  const [a, b] = E, ua = HV[a[2]], ub = HV[b[2]], ch = Math.hypot(b[0] - a[0], b[1] - a[1]), k = ch / 3;
  const P1 = [a[0] - ua[0] * k, a[1] - ua[1] * k], P2 = [b[0] - ub[0] * k, b[1] - ub[1] * k], n = Math.max(4, Math.ceil(ch * 2)), pts = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t, c0 = m * m * m, c1 = 3 * m * m * t, c2 = 3 * m * t * t, c3 = t * t * t;
    const x = c0 * a[0] + c1 * P1[0] + c2 * P2[0] + c3 * b[0], y = c0 * a[1] + c1 * P1[1] + c2 * P2[1] + c3 * b[1];
    let tx = 3 * m * m * (P1[0] - a[0]) + 6 * m * t * (P2[0] - P1[0]) + 3 * t * t * (b[0] - P2[0]);
    let ty = 3 * m * m * (P1[1] - a[1]) + 6 * m * t * (P2[1] - P1[1]) + 3 * t * t * (b[1] - P2[1]);
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    pts.push([x, y, -ty, tx]);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const straight = def(e.name).rt === 'S' && normDir(e.name, e.dir) % 4 === 0;
  p = { pts, ends: E, len: ch, box: straight ? { x: e.x - 1, y: e.y - 1, w: 2, h: 2 } : { x: x0 - .8, y: y0 - .8, w: x1 - x0 + 1.6, h: y1 - y0 + 1.6 } };
  if (RPC.size > 4000) RPC.clear(); RPC.set(key, p); return p;
}
function bb(e) {
  const d = def(e.name);
  if (d.kind === 'rail') { const p = railPath(e); if (p) return p.box; }
  const [w, h] = sz(d, e.dir); return { x: e.x - w / 2, y: e.y - h / 2, w, h };
}
function span(name, x, y, dir) { const [w, h] = sz(def(name), dir); const bx = x - w / 2, by = y - h / 2; return [Math.floor(bx + 1e-6), Math.floor(by + 1e-6), Math.ceil(bx + w - 1e-6), Math.ceil(by + h - 1e-6)]; }
function placePos(name, dir, wx, wy) { const [w, h] = sz(def(name), dir); return { x: Math.round(wx - w / 2) + w / 2, y: Math.round(wy - h / 2) + h / 2 }; }
const occ = new Map(); let curves = new Map(), pairs = [];
const occR = new Map(), railIdx = new Map(); let RE = null;
const entAtTile = (x, y) => { const id = occ.get(K(x, y)); if (id != null) return S.ents.get(id); const r = occR.get(K(x, y)); return r && r.length ? S.ents.get(r[r.length - 1]) : null; };
const ugType = e => e.extra && e.extra.type === 'output' ? 'output' : 'input';
function ix() { if (idxDirty) reindex(); }
function reindex() {
  idxDirty = false; occ.clear(); occR.clear(); railIdx.clear(); RE = null;
  for (const e of S.ents.values()) {
    if (def(e.name).kind === 'rail') {   // las vías no bloquean (en el juego se cruzan); van en su propio índice
      railIdx.set(railKey(e.name, e.x, e.y, e.dir), e.id);
      const p = railPath(e); if (!p) continue; const seen = new Set();
      for (let i = 1; i < p.pts.length - 1; i++) { const [x, y, nx, ny] = p.pts[i]; for (const o of [-.6, 0, .6]) { const k = K(Math.floor(x + nx * o), Math.floor(y + ny * o)); if (seen.has(k)) continue; seen.add(k); const a = occR.get(k); if (a) a.push(e.id); else occR.set(k, [e.id]); } }
      continue;
    }
    const [x0, y0, x1, y1] = span(e.name, e.x, e.y, e.dir); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occ.set(K(x, y), e.id);
  }
  curves = new Map(); pairs = [];
  const seen = new Set();
  for (const e of S.ents.values()) {
    const d = def(e.name); if (!isCard(e.dir)) continue;
    const tx = Math.floor(e.x), ty = Math.floor(e.y), v = DV[card(e.dir)];
    if (d.kind === 'belt') { const c = beltCurve(e); if (c) curves.set(e.id, c); }
    else if (d.kind === 'ug' && ugType(e) === 'input') {
      for (let k = 1; k <= (d.max || 5); k++) { const o = entAtTile(tx + v[0] * k, ty + v[1] * k); if (o && o.name === e.name && o.dir === e.dir) { if (ugType(o) === 'output') pairs.push([e.id, o.id, d.color]); break; } }
    } else if (d.kind === 'ptg') {
      for (let k = 1; k <= (d.max || 10); k++) { const o = entAtTile(tx - v[0] * k, ty - v[1] * k); if (o && o.name === e.name && o.dir === (e.dir + 8) % 16) { const key = Math.min(e.id, o.id) + '-' + Math.max(e.id, o.id); if (!seen.has(key)) { seen.add(key); pairs.push([e.id, o.id, '#9fb2c4']); } break; } }
    }
  }
}
function feeds(o, tx, ty) {
  if (!o || !isCard(o.dir)) return false; const d = def(o.name);
  if (!(d.kind === 'belt' || d.kind === 'split' || (d.kind === 'ug' && ugType(o) === 'output'))) return false;
  const v = DV[card(o.dir)], [x0, y0, x1, y1] = span(o.name, o.x, o.y, o.dir), sx = tx - v[0], sy = ty - v[1];
  return sx >= x0 && sx < x1 && sy >= y0 && sy < y1;
}
function beltCurve(e) {
  const tx = Math.floor(e.x), ty = Math.floor(e.y), c = card(e.dir), v = DV[c];
  if (feeds(entAtTile(tx - v[0], ty - v[1]), tx, ty)) return null;
  const L = DV[(c + 3) % 4], Rr = DV[(c + 1) % 4];
  const fl = feeds(entAtTile(tx + L[0], ty + L[1]), tx, ty), fr = feeds(entAtTile(tx + Rr[0], ty + Rr[1]), tx, ty);
  return fl && !fr ? 'L' : fr && !fl ? 'R' : null;
}
function pipeConns(e) {
  const d = def(e.name), tx = Math.floor(e.x), ty = Math.floor(e.y), out = [false, false, false, false];
  for (let k = 0; k < 4; k++) {
    const o = entAtTile(tx + DV[k][0], ty + DV[k][1]); if (!o) continue; const od = def(o.name);
    if (od.kind === 'pipe') out[k] = !!od.heat === !!d.heat;
    else if (od.kind === 'ptg') out[k] = !d.heat && isCard(o.dir) && card(o.dir) === (k + 2) % 4;
    else if (PORTS[o.name]) out[k] = portList(o).some(p => p.kind === (d.heat ? 1 : 0) && Math.floor(p.x + DV[card(p.dir)][0]) === tx && Math.floor(p.y + DV[card(p.dir)][1]) === ty);
    else out[k] = d.heat ? !!od.heat : !!od.fluid;
  }
  return out;
}
function hits(name, x, y, dir, ignore) {
  ix(); const [x0, y0, x1, y1] = span(name, x, y, dir), out = new Set();
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) { const id = occ.get(K(tx, ty)); if (id != null && !(ignore && ignore.has(id))) out.add(id); }
  return out;
}
const fam = d => d.fam || (['belt', 'ug', 'split', 'ins', 'chest', 'pole', 'railsig'].includes(d.kind) ? d.kind + d.w : null);
function sameFam(a, b) { const fa = fam(a); return !!fa && fa === fam(b) && a.w === b.w && a.h === b.h; }

// ---------- vista ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
let DPR = 1, CW = 1, CH = 1;
const V = { ox: -12, oy: -8, s: 32 };
function resize() {
  const r = cv.getBoundingClientRect(), cx = V.ox + CW / 2 / V.s, cy = V.oy + CH / 2 / V.s;
  DPR = Math.min(window.devicePixelRatio || 1, 2.5); CW = Math.max(1, r.width); CH = Math.max(1, r.height);
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  V.ox = cx - CW / 2 / V.s; V.oy = cy - CH / 2 / V.s; dirty = true;
}
const s2w = (px, py) => [px / V.s + V.ox, py / V.s + V.oy];
let TH = {};
function readTheme() { const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim(); TH = { bg: g('--cv-bg'), grid: g('--cv-grid'), chunk: g('--cv-chunk'), axis: g('--cv-axis'), acc: g('--accent'), text: g('--text') }; dirty = true; }

// ---------- utilidades de dibujo ----------
const SH = new Map();
function shade(hex, a) {
  const k = hex + a; let v = SH.get(k); if (v) return v;
  const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`; SH.set(k, v); return v;
}
function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rot(c, cx, cy, dir) { c.translate(cx, cy); c.rotate((dir | 0) * Math.PI / 8); }
function chev(c, y, r) { c.beginPath(); c.moveTo(-r, y + r * .65); c.lineTo(0, y - r * .35); c.lineTo(r, y + r * .65); c.stroke(); }
function initials(n) { return n.split('-').filter(Boolean).map(s => s[0]).join('').slice(0, 3).toUpperCase(); }
function fitText(c, t, x, y, maxW, fs, wt) {
  for (let f = fs; f >= 9; f--) { c.font = `${wt} ${f}px ${UIF}`; if (c.measureText(t).width <= maxW) return c.fillText(t, x, y); }
  let s = t; while (s.length > 2 && c.measureText(s + '…').width > maxW) s = s.slice(0, -1); c.fillText(s + '…', x, y);
}

function beltStraight(c, col) {
  c.fillStyle = BB; c.fillRect(-.42, -.5, .84, 1);
  c.fillStyle = shade(col, -.3); c.fillRect(-.42, -.5, .08, 1); c.fillRect(.34, -.5, .08, 1);
  c.strokeStyle = col; c.lineWidth = .11; c.lineCap = 'round'; c.lineJoin = 'round'; chev(c, -.17, .19); chev(c, .23, .19);
}
function beltCurveDraw(c, col) {
  const cx = -.5, cy = -.5, H = Math.PI / 2;
  c.fillStyle = BB; c.beginPath(); c.arc(cx, cy, .92, 0, H); c.arc(cx, cy, .08, H, 0, true); c.closePath(); c.fill();
  c.strokeStyle = shade(col, -.3); c.lineWidth = .08;
  c.beginPath(); c.arc(cx, cy, .88, 0, H); c.stroke(); c.beginPath(); c.arc(cx, cy, .12, 0, H); c.stroke();
  c.strokeStyle = col; c.lineWidth = .11; c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(cx + .5 * Math.SQRT1_2, cy + .5 * Math.SQRT1_2); c.rotate(Math.PI / 4); chev(c, .02, .19); c.restore();
}
function dBelt(c, d, X, Y, s, dir, curve) { c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s); if (curve) { if (curve === 'R') c.scale(-1, 1); beltCurveDraw(c, d.color); } else beltStraight(c, d.color); c.restore(); }
function dUG(c, d, X, Y, s, dir, t) {
  c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s);
  const inp = t !== 'output', col = d.color, ty = inp ? -.02 : -.5;
  c.fillStyle = BB; c.fillRect(-.42, ty, .84, .52);
  c.fillStyle = shade(col, -.3); c.fillRect(-.42, ty, .08, .52); c.fillRect(.34, ty, .08, .52);
  c.strokeStyle = col; c.lineWidth = .11; c.lineCap = 'round'; c.lineJoin = 'round'; chev(c, inp ? .26 : -.24, .17);
  c.fillStyle = shade(col, -.1); rr(c, -.46, inp ? -.47 : .02, .92, .45, .1); c.fill(); c.lineWidth = .05; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  c.fillStyle = 'rgba(0,0,0,.75)'; rr(c, -.3, inp ? -.13 : .03, .6, .1, .04); c.fill();
  c.restore();
}
function dSplit(c, d, X, Y, W, H, s, dir) {
  c.save(); rot(c, X + W / 2, Y + H / 2, dir); c.scale(s, s);
  for (const ox of [-.5, .5]) { c.save(); c.translate(ox, 0); beltStraight(c, d.color); c.restore(); }
  c.fillStyle = shade(d.color, -.08); rr(c, -.96, -.2, 1.92, .34, .08); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.stroke();
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-.035, -.2, .07, .34);
  c.restore();
}
function dIns(c, d, X, Y, s, dir) {
  c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s);
  c.fillStyle = '#45484d'; rr(c, -.3, -.3, .6, .6, .1); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.stroke();
  const col = d.color; c.strokeStyle = col; c.lineWidth = .13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -.42); c.lineTo(0, .16); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-.21, .12); c.lineTo(.21, .12); c.lineTo(0, .47); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .03; c.stroke();
  if (d.long) { c.strokeStyle = col; c.lineWidth = .07; c.beginPath(); c.moveTo(-.15, -.38); c.lineTo(.15, -.38); c.moveTo(-.15, -.26); c.lineTo(.15, -.26); c.stroke(); }
  c.fillStyle = shade(col, -.35); c.beginPath(); c.arc(0, -.06, .085, 0, 7); c.fill();
  c.restore();
}
function dPipe(c, d, X, Y, s, conns) {
  const col = d.color, L = conns || [false, true, false, true];
  c.save(); c.translate(X + s / 2, Y + s / 2); c.scale(s, s); c.lineCap = 'butt';
  for (const [w, st] of [[.44, shade(col, -.45)], [.28, col]]) for (let k = 0; k < 4; k++) if (L[k]) { c.strokeStyle = st; c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(DV[k][0] * .5, DV[k][1] * .5); c.stroke(); }
  c.fillStyle = col; rr(c, -.24, -.24, .48, .48, .1); c.fill(); c.strokeStyle = shade(col, -.45); c.lineWidth = .06; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-.14, -.17, .28, .06);
  c.restore();
}
function dPTG(c, d, X, Y, s, dir) {
  const col = d.color; c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s);
  for (const [w, st] of [[.44, shade(col, -.45)], [.28, col]]) { c.strokeStyle = st; c.lineWidth = w; c.beginPath(); c.moveTo(0, .05); c.lineTo(0, -.5); c.stroke(); }
  c.fillStyle = shade(col, -.2); rr(c, -.34, -.08, .68, .5, .14); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.stroke();
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(-.22, .27, .44, .08);
  c.restore();
}
function dChest(c, d, X, Y, s) {
  const p = s * .13, w = s - 2 * p, col = d.color;
  rr(c, X + p, Y + p, w, w, s * .06); c.fillStyle = col; c.fill(); c.lineWidth = Math.max(1, s * .04); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(X + p, Y + p + w * .36, w, Math.max(1, s * .05));
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(X + p + w * .1, Y + p + w * .1, w * .8, Math.max(1, s * .04));
  c.fillStyle = shade(col, -.45); c.fillRect(X + s / 2 - s * .06, Y + p + w * .3, s * .12, s * .14);
}
function dPole(c, d, X, Y, W, H) {
  const cx = X + W / 2, cy = Y + H / 2, u = Math.min(W, H), col = d.color;
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.arc(cx + u * .05, cy + u * .06, u * .3, 0, 7); c.fill();
  c.lineWidth = Math.max(1, u * .045); c.strokeStyle = 'rgba(0,0,0,.65)';
  if (d.name === 'substation') {
    rr(c, X + u * .14, Y + u * .14, W - u * .28, H - u * .28, u * .08); c.fillStyle = col; c.fill(); c.stroke();
    rr(c, X + u * .32, Y + u * .32, W - u * .64, H - u * .64, u * .05); c.fillStyle = shade(col, -.35); c.fill();
    c.fillStyle = '#f4d35e'; for (const [a, b] of [[.24, .24], [.76, .24], [.24, .76], [.76, .76]]) { c.beginPath(); c.arc(X + W * a, Y + H * b, u * .05, 0, 7); c.fill(); }
  } else if (d.w === 2) {
    c.strokeStyle = col; c.lineWidth = Math.max(1.5, u * .07); c.beginPath(); c.moveTo(X + u * .2, Y + u * .2); c.lineTo(X + W - u * .2, Y + H - u * .2); c.moveTo(X + W - u * .2, Y + u * .2); c.lineTo(X + u * .2, Y + H - u * .2); c.stroke();
    rr(c, X + u * .15, Y + u * .15, W - u * .3, H - u * .3, u * .05); c.lineWidth = Math.max(1, u * .045); c.strokeStyle = shade(col, -.3); c.stroke();
    c.fillStyle = shade(col, .15); c.beginPath(); c.arc(cx, cy, u * .1, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  } else {
    c.fillStyle = col;
    rr(c, cx - u * .36, cy - u * .1, u * .72, u * .18, u * .04); c.fill(); c.stroke();
    rr(c, cx - u * .11, cy - u * .22, u * .22, u * .44, u * .05); c.fill(); c.stroke();
    c.fillStyle = '#e6dfd0'; for (const a of [-.27, .27]) { c.beginPath(); c.arc(cx + u * a, cy - u * .01, u * .045, 0, 7); c.fill(); }
  }
}
function dWall(c, d, X, Y, s, dir) {
  if (d.gate) {
    c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s);
    c.beginPath(); c.rect(-.5, -.3, 1, .6); c.save(); c.clip(); c.fillStyle = '#2f3034'; c.fillRect(-.5, -.3, 1, .6);
    c.fillStyle = '#e6b422'; for (let i = -3; i < 4; i++) { c.beginPath(); c.moveTo(i * .28 - .1, -.3); c.lineTo(i * .28 + .04, -.3); c.lineTo(i * .28 + .16, .3); c.lineTo(i * .28 + .02, .3); c.closePath(); c.fill(); }
    c.restore(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.strokeRect(-.5, -.3, 1, .6); c.restore(); return;
  }
  c.fillStyle = d.color; c.fillRect(X + .5, Y + .5, s - 1, s - 1);
  c.strokeStyle = 'rgba(0,0,0,.33)'; c.lineWidth = Math.max(1, s * .04); c.beginPath();
  c.moveTo(X, Y + s / 2); c.lineTo(X + s, Y + s / 2); c.moveTo(X + s * .5, Y); c.lineTo(X + s * .5, Y + s / 2); c.moveTo(X + s * .25, Y + s / 2); c.lineTo(X + s * .25, Y + s); c.moveTo(X + s * .75, Y + s / 2); c.lineTo(X + s * .75, Y + s); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeRect(X + .5, Y + .5, s - 1, s - 1);
}
function dLamp(c, d, X, Y, s) {
  const cx = X + s / 2, cy = Y + s / 2, g = c.createRadialGradient(cx, cy, s * .05, cx, cy, s * .5);
  g.addColorStop(0, 'rgba(255,240,170,.85)'); g.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = g; c.fillRect(X, Y, s, s);
  c.fillStyle = d.color; c.beginPath(); c.arc(cx, cy, s * .24, 0, 7); c.fill(); c.lineWidth = Math.max(1, s * .04); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
}
function dComb(c, d, X, Y, W, H, s, dir) {
  c.save(); rot(c, X + W / 2, Y + H / 2, dir); c.scale(s, s);
  const h = d.h; rr(c, -.4, -h / 2 + .08, .8, h - .16, .1); c.fillStyle = d.color; c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.stroke();
  c.fillStyle = '#e8d9a8'; c.fillRect(-.22, -h / 2 + .02, .44, .1);
  if (d.two) { c.fillStyle = '#9fb3c4'; c.fillRect(-.22, h / 2 - .12, .44, .1); }
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.93)'; c.font = `700 ${Math.max(8, Math.round(Math.min(W, H) * .5))}px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.sym || '', X + W / 2, Y + H / 2 + 1);
}
function dTurret(c, d, X, Y, W, H, dir) {
  const u = Math.min(W, H);
  rr(c, X + u * .08, Y + u * .08, W - u * .16, H - u * .16, u * .14); c.fillStyle = shade(d.color, -.35); c.fill(); c.lineWidth = Math.max(1, u * .03); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  c.save(); rot(c, X + W / 2, Y + H / 2, d.rot === false ? 0 : dir);
  c.fillStyle = d.color; c.beginPath(); c.arc(0, 0, u * .3, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = '#2a2b2e'; c.lineWidth = Math.max(2, u * .1); c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -u * .1); c.lineTo(0, -u * .44); c.stroke();
  c.restore();
}
function dRail(c, d, X, Y, W, H, s, dir) {
  c.save(); rot(c, X + W / 2, Y + H / 2, dir); c.scale(s, s); const h = d.h / 2;
  c.fillStyle = '#6b5a45'; for (let y = -h + .12; y < h; y += .4) c.fillRect(-.85, y, 1.7, .16);
  c.fillStyle = '#a5adb5'; c.fillRect(-.6, -h, .12, 2 * h); c.fillRect(.48, -h, .12, 2 * h); c.restore();
}
function glyph(c, g, x, y, r) {
  c.save(); c.translate(x, y); c.scale(r, r);
  c.fillStyle = 'rgba(255,255,255,.86)'; c.strokeStyle = 'rgba(255,255,255,.86)'; c.lineWidth = .16; c.lineCap = 'round'; c.lineJoin = 'round';
  const poly = pts => { c.beginPath(); pts.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); };
  switch (g) {
    case 'gear': { c.beginPath(); const n = 8, w = Math.PI / n * .5; for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; for (const [q, aa] of [[.62, a - w * 1.6], [.95, a - w * .8], [.95, a + w * .8], [.62, a + w * 1.6]]) c.lineTo(Math.cos(aa) * q, Math.sin(aa) * q); } c.closePath(); c.moveTo(.32, 0); c.arc(0, 0, .32, 0, Math.PI * 2, true); c.fill('evenodd'); break; }
    case 'flame': c.beginPath(); c.moveTo(0, .9); c.bezierCurveTo(-.75, .7, -.6, -.15, -.05, -.95); c.bezierCurveTo(.05, -.4, .7, -.3, .62, .3); c.bezierCurveTo(.58, .72, .25, .9, 0, .9); c.fill(); break;
    case 'bolt': poly([[.18, -.95], [-.5, .12], [-.06, .12], [-.22, .95], [.5, -.18], [.06, -.18]]); c.fill(); break;
    case 'flask': poly([[-.22, -.9], [.22, -.9], [.22, -.3], [.7, .72], [.6, .9], [-.6, .9], [-.7, .72], [-.22, -.3]]); c.lineWidth = .13; c.stroke(); poly([[-.42, .3], [.42, .3], [.64, .74], [.56, .84], [-.56, .84], [-.64, .74]]); c.fill(); break;
    case 'sun': c.beginPath(); c.arc(0, 0, .38, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * .56, Math.sin(a) * .56); c.lineTo(Math.cos(a) * .9, Math.sin(a) * .9); c.stroke(); } break;
    case 'battery': rr(c, -.45, -.66, .9, 1.52, .1); c.lineWidth = .13; c.stroke(); c.fillRect(-.18, -.9, .36, .2); c.fillRect(-.27, .05, .54, .62); break;
    case 'tank': c.beginPath(); c.arc(0, 0, .8, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, .42, 0, 7); c.fill(); break;
    case 'tower': c.fillRect(-.8, -.25, .42, 1.15); c.fillRect(-.21, -.95, .42, 1.85); c.fillRect(.38, -.55, .42, 1.45); break;
    case 'atom': c.lineWidth = .11; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI / 3); c.beginPath(); c.ellipse(0, 0, .9, .34, 0, 0, 7); c.stroke(); c.restore(); } c.beginPath(); c.arc(0, 0, .17, 0, 7); c.fill(); break;
    case 'beacon': poly([[0, -.95], [.62, 0], [0, .95], [-.62, 0]]); c.lineWidth = .14; c.stroke(); c.beginPath(); c.arc(0, 0, .25, 0, 7); c.fill(); break;
    case 'robot': for (const [a, b] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) { rr(c, a - .25, b - .25, .5, .5, .08); c.fill(); } c.beginPath(); c.arc(0, 0, .2, 0, 7); c.fill(); break;
    case 'radar': c.beginPath(); c.arc(0, .35, .85, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); c.beginPath(); c.moveTo(0, .35); c.lineTo(.45, -.25); c.stroke(); c.beginPath(); c.arc(0, .35, .18, 0, 7); c.fill(); c.fillRect(-.35, .62, .7, .2); break;
    case 'drop': c.beginPath(); c.moveTo(0, -.92); c.bezierCurveTo(.62, -.15, .72, .78, 0, .85); c.bezierCurveTo(-.72, .78, -.62, -.15, 0, -.92); c.fill(); break;
    case 'drill': poly([[-.5, -.7], [.5, -.7], [.5, -.2], [0, .92], [-.5, -.2]]); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = .1; c.beginPath(); c.moveTo(-.5, -.2); c.lineTo(.4, .05); c.moveTo(.5, -.2); c.lineTo(-.25, .45); c.stroke(); break;
    case 'rocket': poly([[0, -.95], [.32, -.45], [.32, .45], [.6, .85], [-.6, .85], [-.32, .45], [-.32, -.45]]); c.fill(); break;
    case 'leaf': c.save(); c.rotate(-Math.PI / 4); c.beginPath(); c.ellipse(0, 0, .42, .85, 0, 0, 7); c.fill(); c.restore(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .1; c.beginPath(); c.moveTo(-.55, .55); c.lineTo(.45, -.45); c.stroke(); break;
    default: c.beginPath(); c.arc(0, 0, .42, 0, 7); c.fill();
  }
  c.restore();
}
function notch(c, X, Y, W, H, dir, u, col) {
  const k = card(dir), v = DV[k], r = clamp(u * .075, 3, 10), cx = X + W / 2 + v[0] * (W / 2 - r * 1.6), cy = Y + H / 2 + v[1] * (H / 2 - r * 1.6);
  c.save(); c.translate(cx, cy); c.rotate(k * Math.PI / 2); c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, -r); c.lineTo(r, r * .6); c.lineTo(-r, r * .6); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function dMachine(c, d, e, X, Y, W, H, s, icon) {
  const u = Math.min(W, H), p = Math.max(1, Math.min(s * .1, u * .06)), col = d.color;
  rr(c, X + p, Y + p, W - 2 * p, H - 2 * p, u * .08);
  const gr = c.createLinearGradient(X, Y, X, Y + H); gr.addColorStop(0, shade(col, .12)); gr.addColorStop(1, shade(col, -.2));
  c.fillStyle = gr; c.fill(); c.lineWidth = Math.max(1, u * .025); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  const q = p + u * .1;
  if (W - 2 * q > 6 && H - 2 * q > 6) { rr(c, X + q, Y + q, W - 2 * q, H - 2 * q, u * .05); c.fillStyle = 'rgba(0,0,0,.16)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 1; c.stroke(); }
  const recipe = e.extra && typeof e.extra.recipe === 'string' ? e.extra.recipe : null;
  const txt = !icon && u >= 58;
  if (d.unknown) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `700 ${Math.max(7, Math.round(u * .3))}px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(initials(d.name), X + W / 2, Y + H / 2 - (txt ? u * .08 : 0)); }
  else glyph(c, d.g || (d.kind === 'drill' ? 'drill' : 'dot'), X + W / 2, Y + H / 2 - (txt ? u * .1 : 0), u * (txt ? .19 : .27));
  if (d.kind === 'drill' && isCard(e.dir)) notch(c, X, Y, W, H, e.dir, u, '#ffcf3f');
  else if (d.rot && (d.fluid || d.unknown) && isCard(e.dir) && (icon || s >= 10)) notch(c, X, Y, W, H, e.dir, u, 'rgba(255,255,255,.88)');
  if (txt) {
    const fs = clamp(Math.round(u * .12), 10, 15); c.font = `600 ${fs}px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 3; c.fillStyle = '#fff';
    fitText(c, recipe ? BP.recipeName(recipe) : (d.ab || d.label), X + W / 2, Y + H / 2 + u * .25, W - 2 * q - 6, fs, 600);
    c.shadowBlur = 0; c.shadowColor = 'transparent';
  }
}
// vías: balasto y traviesas en una pasada y carriles en otra, para que los cruces se vean limpios
function drawRailBed(c, e, ox, oy, s) {
  const p = railPath(e); if (!p) return; const d = def(e.name), pts = p.pts;
  c.lineCap = 'butt'; c.lineJoin = 'round'; c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(ox + x * s, oy + y * s) : c.moveTo(ox + x * s, oy + y * s));
  if (s < 7) { c.strokeStyle = d.elev ? '#a59a8a' : '#7b6a57'; c.lineWidth = Math.max(1.6, 1.15 * s); c.stroke(); return; }
  c.strokeStyle = d.elev ? 'rgba(165,154,138,.9)' : 'rgba(128,112,92,.5)'; c.lineWidth = 1.7 * s; c.stroke();
  c.strokeStyle = '#5b4736'; c.lineWidth = Math.max(1, .2 * s); c.beginPath();
  for (let i = 1; i < pts.length - 1; i++) { const [x, y, nx, ny] = pts[i]; c.moveTo(ox + (x - nx * .62) * s, oy + (y - ny * .62) * s); c.lineTo(ox + (x + nx * .62) * s, oy + (y + ny * .62) * s); }
  c.stroke();
}
function drawRailSteel(c, e, ox, oy, s) {
  if (s < 7) return; const p = railPath(e); if (!p) return;
  c.strokeStyle = '#c9d0d7'; c.lineWidth = Math.max(1, .11 * s); c.lineCap = 'butt';
  for (const o of [-.36, .36]) { c.beginPath(); p.pts.forEach(([x, y, nx, ny], i) => { const X = ox + (x + nx * o) * s, Y = oy + (y + ny * o) * s; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
}
function dRailPiece(c, e, X, Y, s) { const b = bb(e), ox = X - b.x * s, oy = Y - b.y * s; drawRailBed(c, e, ox, oy, s); drawRailSteel(c, e, ox, oy, s); }
function dSignal(c, d, X, Y, s, dir) {
  c.save(); rot(c, X + s / 2, Y + s / 2, dir); c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(.05, .07, .36, 0, 7); c.fill();
  rr(c, -.25, -.42, .5, .84, .14); c.fillStyle = '#2b2d31'; c.fill(); c.lineWidth = .08; c.strokeStyle = d.color; c.stroke();
  const L = d.chain ? ['#e5534b', '#4aa3ff'] : ['#e5534b', '#e3b341', '#4cc06a'], st = d.chain ? .34 : .25;
  L.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(0, -.24 + i * st + (d.chain ? .07 : 0), .085, 0, 7); c.fill(); });
  c.fillStyle = d.color; c.beginPath(); c.moveTo(-.13, -.44); c.lineTo(.13, -.44); c.lineTo(0, -.6); c.closePath(); c.fill();
  c.restore();
}
function dTrainStop(c, d, e, X, Y, W, H, s) {
  const u = Math.min(W, H);
  rr(c, X + u * .08, Y + u * .08, W - u * .16, H - u * .16, u * .12); c.fillStyle = shade(d.color, -.45); c.fill(); c.lineWidth = Math.max(1, u * .03); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  c.fillStyle = d.color; c.beginPath(); c.arc(X + W / 2, Y + H / 2, u * .27, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(X + W / 2 - u * .15, Y + H / 2 - u * .045, u * .3, u * .09);
  if (isCard(e.dir)) notch(c, X, Y, W, H, e.dir, u, '#ffffff');
  const nm = e.extra && e.extra.station;
  if (nm && u >= 44) { const fs = clamp(Math.round(u * .16), 10, 14); c.textAlign = 'center'; c.textBaseline = 'top'; c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 3; c.fillStyle = '#fff'; fitText(c, nm, X + W / 2, Y + H + 2, u * 3, fs, 600); c.shadowBlur = 0; c.shadowColor = 'transparent'; }
}
function dTrain(c, d, e, X, Y, W, H, s) {
  c.save(); rot(c, X + W / 2, Y + H / 2, e.dir); c.scale(s, s);
  const L = d.h / 2 - .15, w = .72;
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -w + .08, -L + .1, 2 * w, 2 * L, .3); c.fill();
  rr(c, -w, -L, 2 * w, 2 * L, .3); c.fillStyle = d.color; c.fill(); c.lineWidth = .08; c.strokeStyle = 'rgba(0,0,0,.65)'; c.stroke();
  if (d.loco) { c.fillStyle = shade(d.color, -.4); rr(c, -w + .18, -L + .35, 2 * w - .36, 1.25, .16); c.fill(); c.fillStyle = 'rgba(190,220,255,.8)'; c.fillRect(-w + .3, -L + .5, 2 * w - .6, .32); c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(0, -L + .14, .12, 0, 7); c.fill(); }
  else if (d.tank) { c.fillStyle = shade(d.color, .18); rr(c, -w + .1, -L + .45, 2 * w - .2, 2 * L - .9, .62); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = .06; c.stroke(); }
  else { c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = .07; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(-w + .16, i); c.lineTo(w - .16, i); } c.stroke(); }
  c.restore();
}
// conexiones de fluido y calor (datos del juego): casilla interior y lado por el que conectan, giradas con el edificio
function portList(e) {
  const pp = PORTS[e.name]; if (!pp) return null;
  const q = def(e.name).rot === false ? 0 : card(e.dir | 0);
  return pp.map(([x, y, pd, flow, kind, pos4]) => { const [rx, ry] = pos4 ? pos4[q] : rotQ(x, y, q); return { x: e.x + rx, y: e.y + ry, dir: (pd + 4 * q) % 16, flow, kind }; });
}
function drawPorts(c, e, X, Y, W, H, s) {
  const L = portList(e); if (!L) return;
  const b = bb(e), ox = X - b.x * s, oy = Y - b.y * s, r = Math.max(3, s * .17);
  c.save(); if (PORTCOND.has(e.name)) c.globalAlpha *= .45;
  for (const p of L) {
    const k = card(p.dir), [ux, uy] = DV[k];
    c.save(); c.translate(ox + (p.x + ux * .5) * s, oy + (p.y + uy * .5) * s); c.rotate(k * Math.PI / 2);
    c.fillStyle = p.kind ? '#ff6a3d' : '#3d9bff'; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1; c.beginPath();
    if (p.flow === 2) c.rect(-r * .75, -r * .75, r * 1.5, r * 1.5);
    else if (p.flow === 1) { c.moveTo(-r, r * .45); c.lineTo(0, -r * .9); c.lineTo(r, r * .45); c.closePath(); }   // salida: la punta mira hacia fuera
    else { c.moveTo(-r, -r * .6); c.lineTo(0, r * .75); c.lineTo(r, -r * .6); c.closePath(); }                       // entrada: la punta mira hacia dentro
    c.fill(); c.stroke(); c.restore();
  }
  c.restore();
}
// flecha verde del planificador: extremo de vía desde el que se planifica y hacia dónde sale
function drawRailArrow(c, a, s) {
  const [x, y, h] = a, [ux, uy] = HV[h], L = Math.max(14, s * 1.3), X = (x - V.ox) * s + ux * L * .35, Y = (y - V.oy) * s + uy * L * .35;
  c.save(); c.translate(X, Y); c.rotate(Math.atan2(uy, ux));
  c.beginPath(); c.moveTo(L * .55, 0); c.lineTo(-L * .45, L * .42); c.lineTo(-L * .2, 0); c.lineTo(-L * .45, -L * .42); c.closePath();
  c.fillStyle = '#4cc06a'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1.5; c.fill(); c.stroke(); c.restore();
}
// info: {curve, conns, ug, icon}
function drawEnt(c, e, X, Y, W, H, s, info) {
  drawEntBody(c, e, X, Y, W, H, s, info);
  if (s >= 9 && PORTS[e.name] && !(info && info.icon)) drawPorts(c, e, X, Y, W, H, s);
}
function drawEntBody(c, e, X, Y, W, H, s, info) {
  const d = def(e.name); info = info || {};
  if (s < 7 && !info.icon && d.kind !== 'rail') { c.fillStyle = d.kind === 'belt' || d.kind === 'ug' ? shade(d.color, -.15) : d.color; c.fillRect(X + .5, Y + .5, Math.max(1, W - 1), Math.max(1, H - 1)); return; }
  switch (d.kind) {
    case 'belt': return dBelt(c, d, X, Y, s, e.dir, info.curve);
    case 'ug': return dUG(c, d, X, Y, s, e.dir, info.ug || ugType(e));
    case 'split': return dSplit(c, d, X, Y, W, H, s, e.dir);
    case 'ins': return dIns(c, d, X, Y, s, e.dir);
    case 'pipe': return dPipe(c, d, X, Y, s, info.conns);
    case 'ptg': return dPTG(c, d, X, Y, s, e.dir);
    case 'chest': return dChest(c, d, X, Y, s);
    case 'pole': return dPole(c, d, X, Y, W, H);
    case 'wall': return dWall(c, d, X, Y, s, e.dir);
    case 'lamp': return dLamp(c, d, X, Y, s);
    case 'comb': return dComb(c, d, X, Y, W, H, s, e.dir);
    case 'turret': return dTurret(c, d, X, Y, W, H, e.dir);
    case 'legacyrail': return dRail(c, d, X, Y, W, H, s, e.dir);
    case 'rail': return dRailPiece(c, e, X, Y, s);
    case 'railsig': return dSignal(c, d, X, Y, s, e.dir);
    case 'trainstop': return dTrainStop(c, d, e, X, Y, W, H, s);
    case 'train': return dTrain(c, d, e, X, Y, W, H, s);
    default: return dMachine(c, d, e, X, Y, W, H, s, info.icon);
  }
}
function drawTile(c, name, X, Y, s) {
  const td = tileDef(name); c.fillStyle = td.color; c.fillRect(X, Y, s + .6, s + .6);
  if (td.hz && s >= 6) { c.save(); c.beginPath(); c.rect(X, Y, s, s); c.clip(); c.strokeStyle = 'rgba(25,25,25,.55)'; c.lineWidth = s * .16; c.beginPath(); for (let i = -1; i <= 2; i++) { c.moveTo(X + i * s * .5, Y + s); c.lineTo(X + i * s * .5 + s, Y); } c.stroke(); c.restore(); }
}
// icono en un canvas pequeño (paleta y chip)
function drawIcon(cnv, name, isTile, dir, ugt, v) {
  const c = cnv.getContext('2d'), Wc = cnv.width, Hc = cnv.height; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, Wc, Hc);
  if (isTile) { const m = Wc * .16; drawTile(c, name, m, m, Wc - 2 * m); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.strokeRect(m + .5, m + .5, Wc - 2 * m - 1, Hc - 2 * m - 1); return; }
  const d = def(name);
  if (d.kind === 'tmpl') {
    const ps = tmplPieces(d.tmpl, v || 0, 0, 0); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of ps) { const b = bb(p); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    const s = Math.min(Wc * .88 / (x1 - x0), Hc * .88 / (y1 - y0)), ox = (Wc - (x1 - x0) * s) / 2 - x0 * s, oy = (Hc - (y1 - y0) * s) / 2 - y0 * s;
    for (const p of ps) drawRailBed(c, p, ox, oy, s);
    for (const p of ps) drawRailSteel(c, p, ox, oy, s);
    return;
  }
  const dd = dir == null ? (d.kind === 'ins' ? 8 : 0) : (d.rot === false ? 0 : dir);
  const [w, h] = sz(d, dd), s = Math.min(Wc * .86 / w, Hc * .86 / h, Wc * .72), W = w * s, H = h * s;
  drawEnt(c, { name, dir: dd, x: 1, y: 1, extra: { type: ugt || 'input' } }, (Wc - W) / 2, (Hc - H) / 2, W, H, s, { icon: 1 });
}

// ---------- dibujo principal ----------
function areaOf(e, d) { return { x: e.x - d.area / 2, y: e.y - d.area / 2, w: d.area }; }
function drawArea(c, e, d, a) {
  const A = areaOf(e, d), X = (A.x - V.ox) * V.s, Y = (A.y - V.oy) * V.s, W = A.w * V.s;
  const rgb = d.kind === 'pole' ? '90,170,255' : d.name === 'beacon' ? '185,120,255' : '255,175,50';
  c.fillStyle = `rgba(${rgb},${a})`; c.fillRect(X, Y, W, W);
  c.strokeStyle = `rgba(${rgb},.75)`; c.lineWidth = 1; c.setLineDash([6, 4]); c.strokeRect(X + .5, Y + .5, W, W); c.setLineDash([]);
}
function outline(c, b, col, lw, fill) {
  const X = (b.x - V.ox) * V.s, Y = (b.y - V.oy) * V.s, W = b.w * V.s, H = b.h * V.s;
  rr(c, X + 1, Y + 1, W - 2, H - 2, Math.min(6, W * .12));
  if (fill) { c.fillStyle = fill; c.fill(); }
  c.strokeStyle = col; c.lineWidth = lw; c.stroke();
}
function infoFor(e) { const d = def(e.name); return d.kind === 'belt' ? { curve: curves.get(e.id) } : d.kind === 'pipe' ? { conns: pipeConns(e) } : null; }
function heldOffset() { const g = groupBox(held), st = held.g2 ? 2 : 1; return [st * Math.round((hover.wx - (g.x0 + g.x1) / 2) / st), st * Math.round((hover.wy - (g.y0 + g.y1) / 2) / st)]; }
function groupBox(g) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of g.ents) { const b = bb(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  for (const t of g.tiles) { x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x + 1); y1 = Math.max(y1, t.y + 1); }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0, y0, x1, y1 };
}
function ghostEnt() {
  const d = def(tool.name), dir = d.rot === false ? 0 : curDir, p = placePos(tool.name, dir, hover.wx, hover.wy);
  const g = { name: tool.name, x: p.x, y: p.y, dir, extra: {} };
  if (d.kind === 'ug') g.extra.type = autoUg(tool.name, p.x, p.y, dir, ugFlip);
  return g;
}
function ghostBad(g) { const h = hits(g.name, g.x, g.y, g.dir); if (!h.size) return false; if (h.size > 1) return true; const o = S.ents.get([...h][0]); return !(o && o.x === g.x && o.y === g.y && sameFam(def(o.name), def(g.name))); }
function draw() {
  ix();
  const c = ctx, s = V.s; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = TH.bg; c.fillRect(0, 0, CW, CH);
  const wx0 = V.ox, wy0 = V.oy, wx1 = V.ox + CW / s, wy1 = V.oy + CH / s;
  const SX = x => (x - V.ox) * s, SY = y => (y - V.oy) * s;
  for (const t of S.tiles.values()) { if (t.x + 1 < wx0 || t.x > wx1 || t.y + 1 < wy0 || t.y > wy1) continue; drawTile(c, t.name, SX(t.x), SY(t.y), s); }
  // rejilla
  if (showGrid) {
    if (s >= 7) { c.beginPath(); for (let x = Math.floor(wx0); x <= wx1; x++) { const X = Math.round(SX(x)) + .5; c.moveTo(X, 0); c.lineTo(X, CH); } for (let y = Math.floor(wy0); y <= wy1; y++) { const Yy = Math.round(SY(y)) + .5; c.moveTo(0, Yy); c.lineTo(CW, Yy); } c.strokeStyle = TH.grid; c.lineWidth = 1; c.stroke(); }
    c.beginPath(); for (let x = Math.floor(wx0 / 32) * 32; x <= wx1; x += 32) { const X = Math.round(SX(x)) + .5; c.moveTo(X, 0); c.lineTo(X, CH); } for (let y = Math.floor(wy0 / 32) * 32; y <= wy1; y += 32) { const Yy = Math.round(SY(y)) + .5; c.moveTo(0, Yy); c.lineTo(CW, Yy); } c.strokeStyle = TH.chunk; c.lineWidth = 1; c.stroke();
    c.beginPath(); const X0 = Math.round(SX(0)) + .5, Y0 = Math.round(SY(0)) + .5; c.moveTo(X0, 0); c.lineTo(X0, CH); c.moveTo(0, Y0); c.lineTo(CW, Y0); c.strokeStyle = TH.axis; c.stroke();
  }
  const sn = BP.getSnap(S.meta.extraBp);   // cuadrícula de ajuste del plano (bloques de megabase)
  if (sn && sn.w * s >= 6 && sn.h * s >= 6) {
    c.beginPath(); for (let x = Math.floor(wx0 / sn.w) * sn.w; x <= wx1; x += sn.w) { const X = Math.round(SX(x)) + .5; c.moveTo(X, 0); c.lineTo(X, CH); } for (let y = Math.floor(wy0 / sn.h) * sn.h; y <= wy1; y += sn.h) { const Yy = Math.round(SY(y)) + .5; c.moveTo(0, Yy); c.lineTo(CW, Yy); }
    c.save(); c.strokeStyle = TH.acc; c.globalAlpha = sn.abs ? .8 : .45; c.lineWidth = 1.5; c.setLineDash([10, 6]); c.stroke(); c.restore();
  }
  if (showAreas) for (const e of S.ents.values()) { const d = def(e.name); if (d.area) drawArea(c, e, d, .05); }
  const moving = P && P.kind === 'move' && (P.dx || P.dy) ? P.ids : null;
  const RV = [];
  for (const e of S.ents.values()) { if (def(e.name).kind !== 'rail' || (moving && moving.has(e.id))) continue; const b = bb(e); if (b.x + b.w < wx0 || b.x > wx1 || b.y + b.h < wy0 || b.y > wy1) continue; RV.push(e); }
  for (const e of RV) drawRailBed(c, e, -V.ox * s, -V.oy * s, s);
  for (const e of RV) drawRailSteel(c, e, -V.ox * s, -V.oy * s, s);
  for (const e of S.ents.values()) {
    if (moving && moving.has(e.id)) continue;
    if (def(e.name).kind === 'rail') continue;
    const b = bb(e); if (b.x + b.w < wx0 || b.x > wx1 || b.y + b.h < wy0 || b.y > wy1) continue;
    drawEnt(c, e, SX(b.x), SY(b.y), b.w * s, b.h * s, s, infoFor(e));
  }
  if (s >= 8) { c.save(); c.setLineDash([4, 4]); c.lineWidth = 2; for (const [a, b2, col] of pairs) { const A = S.ents.get(a), Bq = S.ents.get(b2); if (!A || !Bq) continue; c.strokeStyle = col; c.globalAlpha = .55; c.beginPath(); c.moveTo(SX(A.x), SY(A.y)); c.lineTo(SX(Bq.x), SY(Bq.y)); c.stroke(); } c.restore(); }
  if (showWires) for (const w of S.wires) {
    const A = S.ents.get(w[0]), Bq = S.ents.get(w[2]); if (!A || !Bq) continue;
    const cu = w[1] >= 5 || w[3] >= 5, red = !cu && (w[1] === 1 || w[1] === 3), off = cu ? -.15 : red ? -.08 : .08;
    c.strokeStyle = cu ? 'rgba(214,132,60,.7)' : red ? 'rgba(232,64,64,.95)' : 'rgba(64,200,96,.95)'; c.lineWidth = cu ? 1 : 1.7;
    c.beginPath(); c.moveTo(SX(A.x + off), SY(A.y + off)); c.lineTo(SX(Bq.x + off), SY(Bq.y + off)); c.stroke();
  }
  for (const k of selT) { const t = S.tiles.get(k); if (t) { c.fillStyle = 'rgba(255,155,31,.22)'; c.fillRect(SX(t.x), SY(t.y), s, s); } }
  for (const id of sel) { const e = S.ents.get(id); if (e && !(moving && moving.has(id))) outline(c, bb(e), TH.acc, 2, 'rgba(255,155,31,.16)'); }
  if (moving) {
    c.globalAlpha = .8;
    for (const id of moving) { const e = S.ents.get(id); if (!e) continue; const g = Object.assign({}, e, { x: e.x + P.dx, y: e.y + P.dy }), b = bb(g); drawEnt(c, g, SX(b.x), SY(b.y), b.w * s, b.h * s, s, infoFor(e)); }
    c.globalAlpha = 1;
    for (const id of moving) { const e = S.ents.get(id); if (e) outline(c, bb(Object.assign({}, e, { x: e.x + P.dx, y: e.y + P.dy })), P.bad ? '#e5484d' : TH.acc, 2); }
  }
  const hv = hover.inside && !(P && (P.kind === 'pan' || P.kind === 'pinch'));
  if (hv && mode === 'select' && !P) { const e = entAtTile(hover.tx, hover.ty); if (e) { outline(c, bb(e), TH.text, 1); const d = def(e.name); if (d.area && !showAreas) drawArea(c, e, d, .1); } }
  if (hv && mode === 'erase') { const e = entAtTile(hover.tx, hover.ty); if (e) outline(c, bb(e), '#e5484d', 2, 'rgba(229,72,77,.25)'); else { c.strokeStyle = '#e5484d'; c.lineWidth = 1.5; c.strokeRect(SX(hover.tx) + 1, SY(hover.ty) + 1, s - 2, s - 2); } }
  if (hv && mode === 'place' && tool) {
    if (tool.tile) { c.globalAlpha = .65; drawTile(c, tool.name, SX(hover.tx), SY(hover.ty), s); c.globalAlpha = 1; c.strokeStyle = TH.acc; c.lineWidth = 1.5; c.strokeRect(SX(hover.tx) + .5, SY(hover.ty) + .5, s - 1, s - 1); }
    else {
      const gl = RP && railTool() ? { ents: RP.plan || [], bad: false, pt: RP.goalPt, arrow: RP.from } : ghostList(), bad = gl.bad;
      c.globalAlpha = .62;
      for (const g of gl.ents) { const b = bb(g); drawEnt(c, g, SX(b.x), SY(b.y), b.w * s, b.h * s, s, def(g.name).kind === 'belt' ? {} : null); }
      c.globalAlpha = 1;
      for (const g of gl.ents) { const d = def(g.name); if (d.area) drawArea(c, g, d, .1); if (d.kind !== 'rail' || bad) outline(c, bb(g), bad ? '#e5484d' : TH.acc, 1.5, bad ? 'rgba(229,72,77,.3)' : null); }
      if (RP && railTool()) { c.strokeStyle = 'rgba(70,150,255,.38)'; c.lineWidth = Math.max(3, 1.5 * s); c.lineCap = 'round'; for (const g of gl.ents) { const rp = railPath(g); if (!rp) continue; c.beginPath(); rp.pts.forEach(([x, y], i) => i ? c.lineTo(SX(x), SY(y)) : c.moveTo(SX(x), SY(y))); c.stroke(); } }   // trazado previsto en azul, como los fantasmas del juego
      if (gl.arrow) drawRailArrow(c, gl.arrow, s);
      for (const q of [gl.pt, gl.pt0]) if (q) { c.strokeStyle = TH.acc; c.lineWidth = 2.5; c.beginPath(); c.arc(SX(q[0]), SY(q[1]), Math.max(6, s * .5), 0, 7); c.stroke(); }
    }
  }
  if (hv && mode === 'hold' && held) {
    const [ox, oy] = heldOffset();
    c.globalAlpha = .6;
    for (const t of held.tiles) drawTile(c, t.name, SX(t.x + ox), SY(t.y + oy), s);
    for (const e of held.ents) { const g = Object.assign({}, e, { x: e.x + ox, y: e.y + oy }), b = bb(g); drawEnt(c, g, SX(b.x), SY(b.y), b.w * s, b.h * s, s, null); }
    c.globalAlpha = 1;
    for (const e of held.ents) { if (hits(e.name, e.x + ox, e.y + oy, e.dir).size) { const b = bb(Object.assign({}, e, { x: e.x + ox, y: e.y + oy })); c.fillStyle = 'rgba(229,72,77,.4)'; c.fillRect(SX(b.x), SY(b.y), b.w * s, b.h * s); } }
    const g = groupBox(held); c.strokeStyle = TH.acc; c.setLineDash([6, 4]); c.lineWidth = 1.5; c.strokeRect(SX(g.x0 + ox), SY(g.y0 + oy), (g.x1 - g.x0) * s, (g.y1 - g.y0) * s); c.setLineDash([]);
  }
  if (P && P.kind === 'marquee') {
    const x0 = Math.min(P.x0, P.x1), y0 = Math.min(P.y0, P.y1), w = Math.abs(P.x1 - P.x0), h = Math.abs(P.y1 - P.y0);
    c.fillStyle = 'rgba(255,155,31,.12)'; c.fillRect(SX(x0), SY(y0), w * s, h * s); c.strokeStyle = TH.acc; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.strokeRect(SX(x0) + .5, SY(y0) + .5, w * s, h * s); c.setLineDash([]);
  }
}
function frame() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(frame); }
/* ===== Interacción ===== */
function autoUg(name, x, y, dir, flip) {
  ix(); const d = def(name); let t = 'input';
  if (isCard(dir)) { const v = DV[card(dir)], tx = Math.floor(x), ty = Math.floor(y);
    for (let k = 1; k <= (d.max || 5); k++) { const o = entAtTile(tx - v[0] * k, ty - v[1] * k); if (o && o.name === name && o.dir === dir) { if (ugType(o) === 'input') t = 'output'; break; } } }
  return flip ? (t === 'input' ? 'output' : 'input') : t;
}
// coloca o hace reemplazo rápido (misma familia y posición). Devuelve id o null.
function tryPlace(name, x, y, dir, extra) {
  const d = def(name); dir = d.rot === false ? 0 : dir;
  const h = hits(name, x, y, dir);
  if (h.size) {
    if (h.size > 1) return null;
    const id = [...h][0], o = S.ents.get(id);
    if (o && o.x === x && o.y === y && sameFam(def(o.name), d)) { if (o.name !== name || o.dir !== dir) setEnt(id, { name, dir, n1: null }); return id; }
    return null;
  }
  const ex = extra ? deep(extra) : {};
  if (d.kind === 'ug' && !ex.type) ex.type = autoUg(name, x, y, dir, ugFlip);
  return addEnt({ name, x, y, dir, xs: 2, extra: ex });
}
function setMode(m) {
  RP = null; mode = m; if (m !== 'place') tool = null; if (m !== 'hold') held = null;
  document.querySelectorAll('.tool[data-act]').forEach(b => { const a = b.dataset.act; if (['select', 'erase'].includes(a)) b.classList.toggle('on', a === m); });
  document.querySelectorAll('.slot.on').forEach(b => b.classList.remove('on'));
  if (m === 'place' && tool) { const b = document.querySelector(`.slot[data-name="${tool.name}"]`); if (b) b.classList.add('on'); }
  cv.className = m === 'select' ? 'c-sel' : ''; updateChip(); dirty = true;
}
function pickTool(name, isTile) {
  if (mode === 'place' && tool && tool.name === name) return setMode('select');
  tool = { name, tile: !!isTile }; ugFlip = false; tmplV = 0; held = null; mode = 'place'; setMode('place'); sel.clear(); selT.clear(); renderSel();
}
function holdGroup(g, msg) {
  if (!g || (!g.ents.length && !g.tiles.length)) return;
  g.g2 = g.ents.some(e => def(e.name).g2); held = g; tool = null; mode = 'hold'; setMode('hold'); held = g; updateChip(); dirty = true;
  toast(msg || 'Plano en el cursor: haz clic para colocarlo. Mayús+clic reemplaza lo que choque, R lo gira, Esc lo suelta.');
}

// ----- trazos -----
// ---------- herramientas de trenes ----------
let tmplV = 0, emptyHint = false, RP = null;   // RP: planificación de vías en curso
// vías a ras de suelo y elevadas (Space Age): cada nivel solo empalma consigo mismo
const RAIL_TOOLS = new Set(['straight-rail', 'elevated-straight-rail']);
const railTool = () => !!tool && RAIL_TOOLS.has(tool.name);
const elevOf = name => def(name).elev ? 1 : 0;
const toLayer = (name, elev) => elev ? (name.startsWith('elevated-') ? name : 'elevated-' + name) : name.replace(/^elevated-/, '');
const railLayer = () => tool ? elevOf(tool.name) : 0;
function railEndsAll(layer) {
  ix(); RE = RE || {}; const ck = layer == null ? 'all' : layer; if (RE[ck]) return RE[ck];
  const m = new Map();
  for (const e of S.ents.values()) { if (def(e.name).kind !== 'rail' || (layer != null && elevOf(e.name) !== layer)) continue; const E = railEndsOf(e.name, e.x, e.y, e.dir); if (!E) continue; for (const [x, y, h] of E) { const k = K(x, y), a = m.get(k); if (a) a.push(h); else m.set(k, [h]); } }
  const free = [];
  for (const [k, hs] of m) { const [x, y] = k.split(',').map(Number); for (const h of hs) if (!hs.includes((h + 8) % 16)) free.push([x, y, h]); }
  return RE[ck] = { m, free, slots: null };
}
// imán: si hay un final de vía libre cerca con el rumbo opuesto a un extremo de la plantilla, la plantilla se empalma ahí
function tmplAnchor(k, v) {
  const ends = tmplEnds(k, v), q = tmplMQ(k, v)[1]; let best = null, bd = 3.2 * 3.2;
  for (const [fx, fy, fh] of railEndsAll(0).free) {
    const dd = (fx - hover.wx) ** 2 + (fy - hover.wy) ** 2; if (dd > bd) continue;
    for (const [tx, ty, th] of ends) if ((th + 8) % 16 === fh) { bd = dd; best = { x: fx - tx, y: fy - ty, pt: [fx, fy] }; }
  }
  if (best) return best;
  return q % 2 === 0 ? { x: 2 * Math.floor(hover.wx / 2) + 1, y: 2 * Math.round(hover.wy / 2) } : { x: 2 * Math.round(hover.wx / 2), y: 2 * Math.floor(hover.wy / 2) + 1 };
}
// huecos para señales (regla sacada de los planos del juego): a 1,5 del eje y a ±0,5 del final de cada tramo;
// a la derecha del rumbo mirando hacia atrás y a la izquierda mirando hacia delante
function signalSlots() {
  const R = railEndsAll(); if (R.slots) return R.slots;
  const out = new Map();
  for (const [k, hs] of R.m) { const [x, y] = k.split(',').map(Number); for (const h of new Set(hs)) for (const sl of slotsAtEnd(x, y, h)) { const kk = K(sl[0], sl[1]); if (!out.has(kk)) out.set(kk, sl); } }
  return R.slots = [...out.values()];
}
function nearestSlot() { let best = null, bd = 1.6 * 1.6; for (const sl of signalSlots()) { const d2 = (sl[0] - hover.wx) ** 2 + (sl[1] - hover.wy) ** 2; if (d2 < bd) { bd = d2; best = sl; } } return best; }
// la parada va a la derecha de la vía según el sentido de marcha
function stopDirs(x, y) { ix(); const out = []; for (const u of [0, 4, 8, 12]) { const [rx, ry] = DV[(u / 4 + 1) % 4]; if (railIdx.has(railKey('straight-rail', x - 2 * rx, y - 2 * ry, u))) out.push(u); } return out; }
function trainSpot() {
  ix(); let rail = null;
  for (const id of occR.get(K(hover.tx, hover.ty)) || []) { const o = S.ents.get(id); if (o && o.name === 'straight-rail' && o.dir % 4 === 0) { rail = o; break; } }
  let dir = curDir % 4 === 0 ? curDir : 0, x = Math.round(hover.wx * 2) / 2, y = Math.round(hover.wy * 2) / 2;
  if (rail) { if (rail.dir % 8 === 0) { x = rail.x; if (dir % 8) dir = 0; } else { y = rail.y; if (dir % 8 !== 4) dir = 4; } }
  const vert = dir % 8 === 0;
  for (const o of S.ents.values()) {   // acoplar: centros a 7 casillas de otro vehículo en la misma vía
    if (def(o.name).kind !== 'train' || o.dir % 8 !== dir % 8 || (vert ? o.x !== x : o.y !== y)) continue;
    const a = vert ? o.y : o.x, cur = vert ? y : x;
    for (const t of [a - 7, a + 7]) if (Math.abs(cur - t) < 2.5) { if (vert) y = t; else x = t; }
  }
  return { x, y, dir };
}
function railCell(wx, wy, diag) { return diag ? [2 * Math.round(wx / 2), 2 * Math.round(wy / 2)] : [2 * Math.floor(wx / 2) + 1, 2 * Math.floor(wy / 2) + 1]; }
function placeRail(name, x, y, dir) { ix(); const id = railIdx.get(railKey(name, x, y, dir)); if (id != null) return { id, made: false }; return { id: addEnt({ name, x, y, dir: normDir(name, dir), xs: 2, extra: {} }), made: true }; }
function ghostList() {
  const d = def(tool.name), mk = (name, x, y, dir) => ({ name, x, y, dir, extra: {} });
  if (railTool()) {
    const a = railArrowAt(); if (a) return { ents: [], bad: false, arrow: a };   // sobre una vía: flecha verde para planificar desde ahí
    const [x, y] = railCell(hover.wx, hover.wy, curDir % 4 === 2); return { ents: [mk(tool.name, x, y, curDir % 8)], bad: false };
  }
  if (d.tmpl) { const a = tmplAnchor(d.tmpl, tmplV); return { ents: tmplPieces(d.tmpl, tmplV, a.x, a.y), bad: false, pt: a.pt }; }
  if (d.kind === 'railsig') {
    const sl = nearestSlot(); if (!sl) return { ents: [mk(tool.name, hover.tx + .5, hover.ty + .5, 0)], bad: true, why: 'Acerca la señal a una vía: va a un lado, junto al final de un tramo' };
    const g = mk(tool.name, sl[0], sl[1], sl[2]); return { ents: [g], bad: ghostBad(g), why: 'Ahí ya hay algo' };
  }
  if (d.kind === 'trainstop') { const x = 2 * Math.floor(hover.wx / 2) + 1, y = 2 * Math.floor(hover.wy / 2) + 1, ok = stopDirs(x, y), g = mk(tool.name, x, y, ok.includes(curDir) ? curDir : ok.length ? ok[0] : curDir % 4 === 0 ? curDir : 0); return { ents: [g], bad: ghostBad(g), why: 'Ahí ya hay algo' }; }
  if (d.kind === 'train') { const p = trainSpot(), g = mk(tool.name, p.x, p.y, p.dir); return { ents: [g], bad: ghostBad(g), why: 'Choca con otra cosa' }; }
  const g = ghostEnt(); return { ents: [g], bad: ghostBad(g) };
}
function freeEndNear(x, y, r, skip) {
  let best = null, bd = r * r;
  for (const f of railEndsAll().free) {
    if (skip && f[0] === skip[0] && f[1] === skip[1] && f[2] === skip[2]) continue;
    const d2 = (f[0] - x) ** 2 + (f[1] - y) ** 2; if (d2 < bd) { bd = d2; best = f; }
  }
  return best;
}
// inicio del trazado: el final de vía libre más cercano o, en vacío, un punto de la rejilla por cada rumbo recto o diagonal
// Como en el juego: con la vía en la mano, una flecha verde marca el extremo de la vía bajo el cursor. Un clic en ella empieza a
// planificar, el trazado sigue al cursor sin mantener el botón y cada clic lo coloca y sigue desde su final. Esc, Q o clic derecho terminan.
function railArrowAt() {
  ix(); let best = null, bs = Infinity;
  const L = railLayer();
  for (const [fx, fy, fh] of railEndsAll(L).free) { const s = Math.hypot(fx - hover.wx, fy - hover.wy); if (s < 1.2 && s < bs) { bs = s; best = [fx, fy, fh]; } }
  for (const id of occR.get(K(hover.tx, hover.ty)) || []) {   // cualquier vía bajo el cursor, aunque esté conectada: así se hacen desvíos
    const e = S.ents.get(id), E = e && elevOf(e.name) === L && railEndsOf(e.name, e.x, e.y, e.dir); if (!E) continue;
    for (const [x, y, h] of E) { const s = Math.hypot(x - hover.wx, y - hover.wy) + 0.3 * Math.hypot(e.x - hover.wx, e.y - hover.wy); if (s < bs) { bs = s; best = [x, y, h]; } }
  }
  return best;
}
// punto de conexión de una vía existente junto al cursor, libre o no: el trazado acaba empalmando o haciendo un desvío
function railGoalNear(x, y, from) {
  let best = null, bd = 2.2 * 2.2;
  for (const [k, hs] of railEndsAll(railLayer()).m) {
    const [px, py] = k.split(',').map(Number); if (Math.hypot(px - from[0], py - from[1]) < 4) continue;
    const d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < bd) { bd = d2; best = { x: px, y: py, hs: [...new Set(hs)].map(h => (h + 8) % 16) }; }
  }
  return best;
}
function railPlanUpdate(force) {
  const tk = Math.round(hover.wx * 2) + ',' + Math.round(hover.wy * 2); if (!force && tk === RP.tk) return; RP.tk = tk;
  const g = railGoalNear(hover.wx, hover.wy, RP.from);
  let path = g ? planRails([RP.from], { x: g.x, y: g.y, hs: g.hs }) : null;
  RP.goalPt = path ? [g.x, g.y] : null;
  if (!path && Math.hypot(hover.wx - RP.from[0], hover.wy - RP.from[1]) > 1.2) path = planRails([RP.from], { x: hover.wx, y: hover.wy, r: 1.5 });
  const L = railLayer(); if (path) for (const g of path) g.name = toLayer(g.name, L);
  RP.plan = path || []; updateChip(); dirty = true;
}
function railClick() {
  if (RP) {   // coloca el tramo y sigue planificando desde su final
    const plan = RP.plan; if (!plan || !plan.length) return;
    for (const g of plan) placeRail(g.name, g.x, g.y, g.dir);
    RP = { from: plan.end, tk: null, plan: [] }; railPlanUpdate(true); return;
  }
  const a = railArrowAt();
  if (a) { RP = { from: a, tk: null, plan: [] }; railPlanUpdate(true); return; }
  const [x, y] = railCell(hover.wx, hover.wy, curDir % 4 === 2); placeRail(tool.name, x, y, curDir % 8);   // en vacío: una vía suelta
}
function startPlace() {
  txBegin(); P = { kind: 'place', tx: hover.tx, ty: hover.ty, last: null };
  if (tool.tile) return setTile(hover.tx, hover.ty, tool.name);
  const d = def(tool.name);
  if (railTool()) { P.noDrag = true; railClick(); return; }
  if (d.tmpl || d.kind === 'railsig' || d.kind === 'trainstop' || d.kind === 'train') {
    P.noDrag = true; const gl = ghostList();
    if (gl.bad) return toast(gl.why || 'No cabe ahí', 'warn');
    for (const g of gl.ents) { if (def(g.name).kind === 'rail') placeRail(g.name, g.x, g.y, g.dir); else tryPlace(g.name, g.x, g.y, g.dir); }
    return;
  }
  const g = ghostEnt(); P.last = tryPlace(tool.name, g.x, g.y, g.dir);
}
function stepPlace(sx, sy) {
  if (tool.tile) return setTile(P.tx, P.ty, tool.name);
  const d = def(tool.name);
  if (d.kind === 'belt') {
    const dir = vecDir(sx, sy); curDir = dir;
    if (P.last != null) { const o = S.ents.get(P.last); if (o && def(o.name).kind === 'belt') setEnt(P.last, { dir }); }
    P.last = tryPlace(tool.name, P.tx + .5, P.ty + .5, dir);
  } else {
    const dir = d.rot === false ? 0 : curDir, p = placePos(tool.name, dir, P.tx + .5, P.ty + .5);
    const id = tryPlace(tool.name, p.x, p.y, dir); if (id != null) P.last = id;
  }
}
function contPlace() {
  if (P.noDrag) return;
  let guard = 0;
  while ((P.tx !== hover.tx || P.ty !== hover.ty) && guard++ < 500) {
    const dx = hover.tx - P.tx, dy = hover.ty - P.ty; let sx = 0, sy = 0;
    if (Math.abs(dx) >= Math.abs(dy)) sx = Math.sign(dx); else sy = Math.sign(dy);
    P.tx += sx; P.ty += sy; stepPlace(sx, sy);
  }
  updateChip(); dirty = true;
}
function eraseAt() { const e = entAtTile(hover.tx, hover.ty); if (e) delEnt(e.id); else if (S.tiles.has(K(hover.tx, hover.ty))) setTile(hover.tx, hover.ty, null); dirty = true; }

// ----- selección -----
function selectRect(x0, y0, x1, y1, add, base) {
  sel.clear(); selT.clear(); if (add) base.e.forEach(i => sel.add(i)), base.t.forEach(k => selT.add(k));
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
  for (const e of S.ents.values()) { const b = bb(e); if (b.x < bx && b.x + b.w > ax && b.y < by && b.y + b.h > ay) sel.add(e.id); }
  for (const [k, t] of S.tiles) if (t.x < bx && t.x + 1 > ax && t.y < by && t.y + 1 > ay) selT.add(k);
}
function moveBad(dx, dy) { for (const id of sel) { const e = S.ents.get(id); if (e && hits(e.name, e.x + dx, e.y + dy, e.dir, sel).size) return true; } return false; }
function moveSel(dx, dy) {
  if (!dx && !dy) return;
  if (moveBad(dx, dy)) return toast('No cabe ahí: chocaría con otras entidades', 'warn');
  const tiles = [...selT].map(k => S.tiles.get(k)).filter(Boolean);
  act(() => {
    for (const id of sel) { const e = S.ents.get(id); setEnt(id, { x: e.x + dx, y: e.y + dy }); }
    for (const t of tiles) setTile(t.x, t.y, null);
    for (const t of tiles) setTile(t.x + dx, t.y + dy, t.name);
  });
  selT.clear(); for (const t of tiles) selT.add(K(t.x + dx, t.y + dy)); renderSel();
}
function deleteSel(quiet) {
  if (!sel.size && !selT.size) return;
  const n = sel.size; act(() => { for (const id of [...sel]) delEnt(id); for (const k of [...selT]) { const t = S.tiles.get(k); if (t) setTile(t.x, t.y, null); } });
  sel.clear(); selT.clear(); renderSel(); if (quiet !== true) toast(n ? `Borradas ${n} entidades` : 'Suelo borrado');
}
function rotPoint(x, y, cx, cy, ccw) { return ccw ? [cx + (y - cy), cy - (x - cx)] : [cx - (y - cy), cy + (x - cx)]; }
function rotOne(id, ccw, toDir) {
  const e = S.ents.get(id); if (!e) return false; const d = def(e.name);
  if (d.rot === false) { toast(`${d.label} no se puede rotar`, 'warn'); return false; }
  if (d.kind === 'legacyrail') { toast('Las vías de 1.1 no se pueden girar aquí', 'warn'); return false; }
  if (d.kind === 'rail') {   // una pieza suelta gira sobre un punto válido de la rejilla de vías
    if (d.rt === 'S') { act(() => setEnt(id, { dir: normDir(e.name, toDir != null ? toDir : e.dir + (ccw ? 12 : 4)) })); return true; }
    const cx = 2 * Math.floor(e.x / 2) + 1, cy = 2 * Math.floor(e.y / 2) + 1, [x, y] = rotPoint(e.x, e.y, cx, cy, ccw);
    act(() => setEnt(id, { x, y, dir: normDir(e.name, e.dir + (ccw ? 12 : 4)) })); return true;
  }
  const nd = toDir != null ? toDir : (e.dir + (ccw ? 12 : 4)) % 16;
  const b = bb(e), [w, h] = sz(d, nd); let x = e.x, y = e.y;
  if (w !== b.w || h !== b.h) { x = b.x + w / 2; y = b.y + h / 2; }
  if (hits(e.name, x, y, nd, new Set([id])).size) { toast('No hay sitio para rotarla', 'warn'); return false; }
  act(() => setEnt(id, { dir: nd, x, y })); return true;
}
function rotateSel(ccw) {
  if (sel.size === 1 && !selT.size) return rotOne([...sel][0], ccw);
  const g = groupBox({ ents: [...sel].map(i => S.ents.get(i)), tiles: [...selT].map(k => S.tiles.get(k)) });
  const cx = Math.round((g.x0 + g.x1) / 2); let cy = Math.round((g.y0 + g.y1) / 2);
  if ([...sel].some(i => def(S.ents.get(i).name).g2) && Math.abs(cx + cy) % 2 === 1) cy += 1;   // con vías, el centro de giro debe conservar la rejilla de 2×2
  const plan = [...sel].map(id => { const e = S.ents.get(id), [x, y] = rotPoint(e.x, e.y, cx, cy, ccw), d = def(e.name); return { id, x, y, dir: d.rot === false ? e.dir : normDir(e.name, e.dir + (ccw ? 12 : 4)), name: e.name }; });
  for (const p of plan) if (hits(p.name, p.x, p.y, p.dir, sel).size) return toast('No hay sitio para rotar la selección', 'warn');
  const tiles = [...selT].map(k => S.tiles.get(k)).filter(Boolean);
  const nt = tiles.map(t => { const [x, y] = rotPoint(t.x + .5, t.y + .5, cx, cy, ccw); return { x: x - .5, y: y - .5, name: t.name }; });
  act(() => { for (const p of plan) setEnt(p.id, { x: p.x, y: p.y, dir: p.dir }); for (const t of tiles) setTile(t.x, t.y, null); for (const t of nt) setTile(t.x, t.y, t.name); });
  selT.clear(); for (const t of nt) selT.add(K(t.x, t.y));
}
function rotateHeld(ccw) {
  for (const e of held.ents) { const [x, y] = rotPoint(e.x, e.y, 0, 0, ccw); e.x = x; e.y = y; const d = def(e.name); if (d.rot !== false) e.dir = normDir(e.name, e.dir + (ccw ? 12 : 4)); }
  held.tiles = held.tiles.map(t => { const [x, y] = rotPoint(t.x + .5, t.y + .5, 0, 0, ccw); return { x: x - .5, y: y - .5, name: t.name }; });
  dirty = true;
}
function doRotate(ccw) {
  if (mode === 'place' && tool && !tool.tile) {
    const d = def(tool.name);
    if (d.tmpl) { const n = tmplVariants(d.tmpl); tmplV = (tmplV + (ccw ? n - 1 : 1)) % n; updateChip(); dirty = true; return; }
    if (d.kind === 'railsig') return toast('Las señales se orientan solas según el lado de la vía');
    if (d.rot === false) return toast(`${d.label} no se puede rotar`, 'warn');
    curDir = railTool() ? (curDir % 8 + (ccw ? 6 : 2)) % 8 : (curDir + (ccw ? 12 : 4)) % 16;
    updateChip(); dirty = true; return;
  }
  if (mode === 'hold' && held) return rotateHeld(ccw);
  if (sel.size > 1 || selT.size) return rotateSel(ccw);
  const e = hover.inside ? entAtTile(hover.tx, hover.ty) : null;
  if (e) return rotOne(e.id, ccw);
  if (sel.size === 1) return rotOne([...sel][0], ccw);
}
function pipette() {
  const e = hover.inside ? entAtTile(hover.tx, hover.ty) : null;
  if (!e) { if (mode !== 'select') setMode('select'); return; }
  const d = def(e.name);
  if (d.kind === 'rail' && !RAIL_TOOLS.has(e.name)) return toast('Para curvas usa «Curva de 90°» o «Curva de 45°» de la paleta', 'warn');
  if (!d.cat) return toast('Esa entidad no está en la paleta', 'warn');
  tool = { name: e.name, tile: false }; curDir = e.dir; ugFlip = d.kind === 'ug' && ugType(e) !== autoUg(e.name, e.x, e.y, e.dir, false);
  setMode('place'); ugFlip = d.kind === 'ug' ? ugFlip : false; updateChip();
}
function toggleUg() {
  if (mode === 'place' && tool && def(tool.name).kind === 'ug') { ugFlip = !ugFlip; updateChip(); dirty = true; return; }
  const e = hover.inside ? entAtTile(hover.tx, hover.ty) : (sel.size === 1 ? S.ents.get([...sel][0]) : null);
  if (e && def(e.name).kind === 'ug') { act(() => setEnt(e.id, { extra: Object.assign({}, e.extra, { type: ugType(e) === 'input' ? 'output' : 'input' }) })); renderSel(); }
}

// ----- grupos (copiar / pegar) -----
function selGroup() {
  const ids = new Set(sel);
  return { ents: [...sel].map(id => cloneEnt(S.ents.get(id))), tiles: [...selT].map(k => S.tiles.get(k)).filter(Boolean),
    wires: S.wires.filter(w => ids.has(w[0]) && ids.has(w[2])).map(w => w.slice()) };
}
function placeHeld(replace) {
  const [ox, oy] = heldOffset(), coll = new Set();
  for (const e of held.ents) hits(e.name, e.x + ox, e.y + oy, e.dir).forEach(i => coll.add(i));
  if (coll.size && !replace) return toast(`Choca con ${coll.size} entidades. Usa Mayús+clic para reemplazarlas.`, 'warn');
  const map = new Map();
  act(() => {
    for (const id of coll) delEnt(id);
    ix(); const have = new Map(railIdx);
    for (const e of held.ents) { const x = e.x + ox, y = e.y + oy, ex = def(e.name).kind === 'rail' ? have.get(railKey(e.name, x, y, e.dir)) : undefined; map.set(e.id, ex != null ? ex : addEnt(Object.assign({}, e, { x, y }))); }
    for (const t of held.tiles) setTile(t.x + ox, t.y + oy, t.name);
    if (held.wires && held.wires.length) { tW(); for (const w of held.wires) if (map.has(w[0]) && map.has(w[2])) S.wires.push([map.get(w[0]), w[1], map.get(w[2]), w[3]]); }
  });
}
function groupString(g, label) {
  return BP.encodeSync(BP.buildBlueprint({ ents: g.ents, wires: g.wires, tiles: g.tiles, meta: { label: label || '' }, target: S.target }));
}
// Portapapeles: un textarea oculto recibe el copiado y el pegado nativos del teclado.
// Así funciona en todos los navegadores y dentro de iframes, sin pedir permisos.
const hta = document.createElement('textarea');
hta.className = 'clipta'; hta.tabIndex = -1; hta.spellcheck = false;
hta.setAttribute('aria-hidden', 'true'); hta.setAttribute('autocomplete', 'off');
document.body.appendChild(hta);
let clipOp = null, clipN = 0, clipPrev = null;
function clipDone() {
  clipOp = null; hta.value = '';
  if (document.activeElement === hta) { const p = clipPrev && clipPrev.isConnected && clipPrev !== document.body && clipPrev !== hta ? clipPrev : cv; p.focus({ preventScroll: true }); }
  clipPrev = null;
}
function armClip(op, text, n) {
  clipPrev = document.activeElement; clipOp = op; clipN = n || 0;
  hta.value = text || ''; hta.focus({ preventScroll: true }); hta.select();
  setTimeout(() => { if (clipOp === op) clipDone(); }, 100);
}
function copySync(text) {
  const prev = document.activeElement; let ok = false;
  clipOp = 'manual'; hta.value = text; hta.focus({ preventScroll: true }); hta.select();
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  clipOp = null; hta.value = '';
  if (prev && prev !== hta && prev.focus) prev.focus({ preventScroll: true });
  return ok;
}
async function writeClip(text) {
  if (copySync(text)) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
const typing = t => !!t && t !== hta && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const modalOpen = () => !!document.querySelector('.modal:not([hidden])');
const pageTextSelected = () => !!(window.getSelection && String(window.getSelection()));
const copyMsg = (cut, n) => `${cut ? 'Cortado' : 'Copiado'}: ${n} entidades. Pégalo en Factorio con «Importar cadena», o aquí con Ctrl+V.`;
function onCopyCut(ev, cut) {
  if (ev.target === hta) {
    if (clipOp === 'copy' || clipOp === 'cut') { const op = clipOp; clipOp = 'done'; toast(copyMsg(op === 'cut', clipN), 'ok'); if (op === 'cut') deleteSel(true); setTimeout(clipDone, 0); }
    return;
  }
  if (typing(ev.target) || modalOpen() || (!sel.size && !selT.size) || pageTextSelected() || !ev.clipboardData) return;
  const g = selGroup(); clip = g;
  ev.preventDefault(); ev.clipboardData.setData('text/plain', groupString(g));
  toast(copyMsg(cut, g.ents.length), 'ok'); if (cut) deleteSel(true);
}
document.addEventListener('copy', e => onCopyCut(e, false));
document.addEventListener('cut', e => onCopyCut(e, true));
document.addEventListener('paste', e => {
  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  if (e.target === hta) { e.preventDefault(); if (clipOp === 'paste') { clipDone(); pasteText(text); } return; }
  if (typing(e.target) || modalOpen()) return;
  e.preventDefault(); pasteText(text);
});
async function pasteText(text) {
  if (text && text.trim()) {
    try { const obj = await BP.decode(text); return importObject(obj, S.ents.size || S.tiles.size ? 'hold' : 'open', text); }
    catch (err) { if (!clip) return toast(err.message, 'err'); }
  }
  if (clip) holdGroup(JSON.parse(JSON.stringify(clip)));
  else toast('El portapapeles está vacío. Copia un plano en Factorio con «Exportar cadena».', 'warn');
}

// ----- puntero -----
const ptrs = new Map();
function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function setHover(px, py) {
  const [wx, wy] = s2w(px, py), otx = hover.tx, oty = hover.ty;
  hover.wx = wx; hover.wy = wy; hover.tx = Math.floor(wx); hover.ty = Math.floor(wy); hover.inside = true;
  if ((otx !== hover.tx || oty !== hover.ty) && mode === 'place' && tool && !tool.tile && def(tool.name).kind === 'ug') updateChip();
  if (RP && mode === 'place' && railTool()) railPlanUpdate();
  updateStatus();
}
let spaceDown = false;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId);
  const [px, py] = local(e); ptrs.set(e.pointerId, { x: px, y: py }); setHover(px, py);
  if (ptrs.size === 2) {
    if (TX) txCommit(); if (P && P.kind === 'move') P = null;
    const [a, b] = [...ptrs.values()]; P = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: V.s, ox: V.ox, oy: V.oy };
    return;
  }
  if (ptrs.size > 2) return;
  if (e.button === 1 || (e.button === 0 && spaceDown)) { P = { kind: 'pan', sx: px, sy: py, ox: V.ox, oy: V.oy }; cv.className = 'c-panning'; return; }
  if (e.button === 2) { if (RP) { RP = null; updateChip(); dirty = true; return; } if (mode === 'hold' || mode === 'place') { setMode('select'); return; } txBegin(); P = { kind: 'erase' }; eraseAt(); return; }
  if (e.button !== 0) return;
  if (mode === 'erase') { txBegin(); P = { kind: 'erase' }; eraseAt(); return; }
  if (mode === 'place' && tool) { startPlace(); dirty = true; return; }
  if (mode === 'hold' && held) { placeHeld(e.shiftKey); return; }
  const ent = entAtTile(hover.tx, hover.ty);
  if (ent) {
    if (e.shiftKey) { if (sel.has(ent.id)) sel.delete(ent.id); else sel.add(ent.id); renderSel(); dirty = true; return; }
    if (!sel.has(ent.id)) { sel.clear(); selT.clear(); sel.add(ent.id); }
    P = { kind: 'move', sx: hover.wx, sy: hover.wy, dx: 0, dy: 0, ids: new Set(sel), bad: false, g2: [...sel].some(i => def(S.ents.get(i).name).g2) }; renderSel(); dirty = true; return;
  }
  if (!S.ents.size && !S.tiles.size && !emptyHint) { emptyHint = true; toast('Para construir, elige primero una pieza en la paleta y luego haz clic en la cuadrícula.'); }
  if (e.pointerType === 'touch' && !e.shiftKey) { P = { kind: 'pan', sx: px, sy: py, ox: V.ox, oy: V.oy, tap: true }; return; }
  P = { kind: 'marquee', x0: hover.wx, y0: hover.wy, x1: hover.wx, y1: hover.wy, add: e.shiftKey, base: { e: new Set(sel), t: new Set(selT) } };
  if (!e.shiftKey) { sel.clear(); selT.clear(); }
  renderSel(); dirty = true;
});
cv.addEventListener('pointermove', e => {
  const [px, py] = local(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: px, y: py });
  if (P && P.kind === 'pinch') {
    if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ns = clamp(P.s * d / Math.max(1, P.d), 2, 128), wx = P.mx / P.s + P.ox, wy = P.my / P.s + P.oy;
    V.s = ns; V.ox = wx - mx / ns; V.oy = wy - my / ns; dirty = true; updateStatus(); return;
  }
  setHover(px, py);
  if (P) {
    if (P.kind === 'pan') { V.ox = P.ox - (px - P.sx) / V.s; V.oy = P.oy - (py - P.sy) / V.s; if (Math.hypot(px - P.sx, py - P.sy) > 6) P.tap = false; }
    else if (P.kind === 'place') contPlace();
    else if (P.kind === 'erase') eraseAt();
    else if (P.kind === 'move') { const st = P.g2 ? 2 : 1, dx = st * Math.round((hover.wx - P.sx) / st), dy = st * Math.round((hover.wy - P.sy) / st); if (dx !== P.dx || dy !== P.dy) { P.dx = dx; P.dy = dy; P.bad = moveBad(dx, dy); } cv.className = 'c-move'; }
    else if (P.kind === 'marquee') { P.x1 = hover.wx; P.y1 = hover.wy; selectRect(P.x0, P.y0, P.x1, P.y1, P.add, P.base); renderSelSoon(); }
  }
  dirty = true;
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (!P) return;
  if (P.kind === 'pinch') { if (ptrs.size < 2) P = null; return; }
  const k = P.kind, p = P; P = null;
  if (k === 'place' || k === 'erase') txCommit();
  else if (k === 'move') { if (p.dx || p.dy) { if (p.bad) toast('No cabe ahí: chocaría con otras entidades', 'warn'); else moveSel(p.dx, p.dy); } }
  else if (k === 'pan' && p.tap) { sel.clear(); selT.clear(); }
  cv.className = mode === 'select' ? 'c-sel' : (spaceDown ? 'c-pan' : '');
  renderSel(); updateChip(); dirty = true;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !P) { hover.inside = false; dirty = true; } });
cv.addEventListener('wheel', e => {
  e.preventDefault(); const [px, py] = local(e);
  if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0.5) { V.ox += e.deltaX / V.s; V.oy += e.deltaY / V.s; }
  else zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode === 1 ? .05 : e.ctrlKey ? .01 : .0018)));
  setHover(px, py); dirty = true;
}, { passive: false });
function zoomAt(px, py, f) { const [wx, wy] = s2w(px, py); V.s = clamp(V.s * f, 2, 128); V.ox = wx - px / V.s; V.oy = wy - py / V.s; dirty = true; updateStatus(); }
function fitView() {
  const g = groupBox({ ents: [...S.ents.values()], tiles: [...S.tiles.values()] });
  if (g.x1 - g.x0 <= 0) { V.s = 32; V.ox = -CW / 2 / V.s; V.oy = -CH / 2 / V.s; }
  else { const w = g.x1 - g.x0 + 4, h = g.y1 - g.y0 + 4; V.s = clamp(Math.min(CW / w, (CH - 30) / h), 2, 64); V.ox = (g.x0 + g.x1) / 2 - CW / 2 / V.s; V.oy = (g.y0 + g.y1) / 2 - CH / 2 / V.s; }
  dirty = true; updateStatus();
}

// ----- teclado -----
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const m = document.querySelector('.modal:not([hidden])'); if (m) { closeModal(m); return; } }
  if (typing(e.target) || modalOpen()) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod) {
    if (k === 'c' || k === 'x') {
      if (sel.size || selT.size) { const g = selGroup(); clip = g; armClip(k === 'x' ? 'cut' : 'copy', groupString(g), g.ents.length); }
      else if (!pageTextSelected()) toast('Selecciona algo para copiarlo. Para el plano entero usa «Copiar string» o Ctrl+S.');
      return;
    }
    if (k === 'v') { armClip('paste', ''); return; }
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (k === 'a') { e.preventDefault(); setMode('select'); S.ents.forEach((_, id) => sel.add(id)); S.tiles.forEach((_, kk) => selT.add(kk)); renderSel(); dirty = true; }
    else if (k === 's') { e.preventDefault(); copyAll(); }
    else if (k === 'b') { e.preventDefault(); openSave('sel'); }
    else if (k === 'd') { e.preventDefault(); if (sel.size || selT.size) repeatSel(1, 1, 0); else toast('Selecciona algo para repetirlo'); }
    return;
  }
  if (e.key === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.className = 'c-pan'; } return; }
  if (e.key === 'Escape') { if (RP) { RP = null; updateChip(); dirty = true; return; } if (P && P.kind === 'move') P = null; setMode('select'); sel.clear(); selT.clear(); renderSel(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (e.key.startsWith('Arrow') && (sel.size || selT.size)) { e.preventDefault(); const v = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; const m = (e.shiftKey ? 5 : 1) * ([...sel].some(i => def(S.ents.get(i).name).g2) ? 2 : 1); moveSel(v[0] * m, v[1] * m); return; }
  if (k === 'r') { e.preventDefault(); doRotate(e.shiftKey); }
  else if (k === 'q') { if (RP) { RP = null; updateChip(); dirty = true; } else pipette(); }
  else if (k === 't') toggleUg();
  else if (k === 'v') setMode('select');
  else if (k === 'x' || k === 'e') setMode(mode === 'erase' ? 'select' : 'erase');
  else if (k === 'f') fitView();
  else if (k === 'g') toggleFlag('grid');
  else if (k === '+' || k === '=') zoomAt(CW / 2, CH / 2, 1.25);
  else if (k === '-' || k === '_') zoomAt(CW / 2, CH / 2, .8);
});
window.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; cv.className = mode === 'select' ? 'c-sel' : ''; } });
window.addEventListener('blur', () => { spaceDown = false; });
/* ===== Paneles, importación/exportación y arranque ===== */
function toast(msg, kind, ms) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg; $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || (kind === 'err' ? 5000 : 2800));
}
let panelT = 0, saveT = 0, selT_ = 0;
function changed() { idxDirty = true; dirty = true; clearTimeout(panelT); panelT = setTimeout(() => { renderSel(); renderContents(); }, 60); clearTimeout(saveT); saveT = setTimeout(saveDraft, 900); updateEmpty(); updateStatus(); }
function renderSelSoon() { clearTimeout(selT_); selT_ = setTimeout(renderSel, 50); }
function updateEmpty() { $('#empty').hidden = !!(S.ents.size || S.tiles.size || mode !== 'select'); }
function updateStatus() {
  $('#st-pos').textContent = `x ${hover.tx}, y ${hover.ty}`;
  const e = hover.inside ? entAtTile(hover.tx, hover.ty) : null;
  $('#st-hover').textContent = e ? def(e.name).label + (e.extra && e.extra.recipe ? ` (${BP.recipeName(e.extra.recipe)})` : '') : '';
  $('#st-count').textContent = `${S.ents.size} entidades`;
  $('#st-zoom').textContent = `zoom ${Math.round(V.s / 32 * 100)} %`;
}
const DIRN = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
const RAILDIR = { 0: 'vertical', 2: 'diagonal hacia el noreste', 4: 'horizontal', 6: 'diagonal hacia el sureste' };
function updateChip() {
  const chip = $('#chip');
  if (mode === 'place' && tool) {
    chip.hidden = false; const lab = tool.tile ? tileDef(tool.name).label : def(tool.name).label; $('#chip-name').textContent = lab;
    const d = tool.tile ? null : def(tool.name), bits = [];
    const ugt = d && d.kind === 'ug' ? ghostEnt().extra.type : null;
    if (d && d.tmpl) bits.push(`variante ${tmplV + 1} de ${tmplVariants(d.tmpl)} (R)`, 'acércala al final de una vía y se empalma sola');
    else if (d && railTool()) bits.push(...(RP ? [`${RP.plan.length} piezas: clic para colocarlas y seguir`, 'Esc, Q o clic derecho terminan'] : [`${RAILDIR[curDir % 8]} (R gira 45°)`, 'clic en la flecha verde de una vía para planificar desde ahí']));
    else if (d && d.kind === 'railsig') bits.push('acércala a una vía: se coloca y se orienta sola');
    else if (d && d.kind === 'trainstop') bits.push('junto a una vía recta: se orienta sola');
    else if (d && d.kind === 'train') bits.push(`mirando al ${DIRN[Math.round((curDir % 4 === 0 ? curDir : 0) / 2) % 8]} (R)`, 'sobre una vía recta; se acopla a 7 casillas de otro vagón');
    else if (d && d.kind === 'ins') bits.push(`deja los objetos hacia el ${DIRN[(Math.round(curDir / 2) + 4) % 8]} (R)`);
    else if (d && d.rot !== false) bits.push(`mirando al ${DIRN[Math.round(curDir / 2) % 8]} (R)`);
    if (ugt) bits.push((ugt === 'output' ? 'salida' : 'entrada') + ' (T)');
    if (!(RP && railTool())) bits.push('Esc para soltar');
    $('#chip-keys').textContent = bits.join(', ');
    drawIcon($('#chip-cv'), tool.name, tool.tile, tool.tile ? 0 : (railTool() ? curDir % 8 : curDir), ugt, tmplV);
  } else if (mode === 'hold' && held) {
    chip.hidden = false; $('#chip-name').textContent = `Pegando ${held.ents.length} entidades`; $('#chip-keys').textContent = 'clic para colocar, Mayús+clic reemplaza, R gira, Esc suelta';
    const c = $('#chip-cv').getContext('2d'); c.clearRect(0, 0, 68, 68); glyphChip(c);
  } else if (mode === 'erase') { chip.hidden = false; $('#chip-name').textContent = 'Borrar'; $('#chip-keys').textContent = 'clic o arrastra sobre lo que quieras quitar, Esc para salir'; const c = $('#chip-cv').getContext('2d'); c.clearRect(0, 0, 68, 68); c.strokeStyle = '#e5484d'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, 20); c.lineTo(48, 48); c.moveTo(48, 20); c.lineTo(20, 48); c.stroke(); }
  else chip.hidden = true;
  updateEmpty();
}
function glyphChip(c) { c.fillStyle = '#1e4a73'; c.fillRect(8, 8, 52, 52); c.strokeStyle = 'rgba(220,235,255,.6)'; c.lineWidth = 1; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(8 + i * 13, 8); c.lineTo(8 + i * 13, 60); c.moveTo(8, 8 + i * 13); c.lineTo(60, 8 + i * 13); c.stroke(); } }

// ----- paleta -----
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function buildPalette() {
  const root = $('#pal-list'); root.innerHTML = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const [cat, label] of CATS) {
    const names = cat === 'tiles' ? Object.keys(TILES) : Object.values(DEFS).filter(d => d.cat === cat).map(d => d.name);
    const sec = document.createElement('div'); sec.className = 'pcat'; sec.innerHTML = `<h2>${esc(label)}</h2>`;
    const grid = document.createElement('div'); grid.className = 'pgrid';
    for (const n of names) {
      const isT = cat === 'tiles', lab = isT ? TILES[n].label : DEFS[n].label;
      const b = document.createElement('button'); b.className = 'slot'; b.dataset.name = n; b.dataset.q = norm(lab + ' ' + n); b.title = lab; b.setAttribute('aria-label', lab);
      const c = document.createElement('canvas'); c.width = c.height = Math.round(34 * dpr); b.appendChild(c);
      if ((isT ? TILES[n] : DEFS[n]).sa) { const t = document.createElement('span'); t.className = 'sa'; t.textContent = 'SA'; b.appendChild(t); }
      b.addEventListener('click', () => { pickTool(n, isT); cv.focus({ preventScroll: true }); });
      b.addEventListener('mouseenter', () => palInfo(n, isT)); b.addEventListener('focus', () => palInfo(n, isT));
      grid.appendChild(b); requestAnimationFrame(() => drawIcon(c, n, isT));
    }
    sec.appendChild(grid); root.appendChild(sec);
  }
}
function palInfo(n, isT) {
  const d = isT ? TILES[n] : DEFS[n], bits = [];
  if (isT && d.sa) bits.push('requiere Space Age');
  if (!isT) { bits.push(`${d.w}×${d.h}`); if (d.sa) bits.push('requiere Space Age'); if (d.cat === 'editor') bits.push('oculto en partidas normales: para el modo editor y mapas de pruebas'); if (d.elev) bits.push('solo empalma con otras vías elevadas; sube y baja con rampas'); if (d.kind === 'ins') bits.push('la flecha indica hacia dónde deja los objetos'); if (d.area) bits.push(`área ${d.area}×${d.area}`); const tip = { rail: 'clic en la flecha verde de una vía para planificar; en vacío pone una vía suelta', tmpl: 'se empalma sola con el final de una vía; R cambia la variante', railsig: 'se coloca y se orienta sola junto a una vía', trainstop: 'junto a una vía recta; se orienta sola', train: 'sobre una vía recta; se acopla a 7 casillas' }[d.kind]; if (tip) bits.push(tip); }
  $('#pal-info').innerHTML = `<b>${esc(d.label)}</b><code>${esc(n)}</code>${bits.length ? `<div class="hint" style="margin:2px 0 0">${esc(bits.join(', '))}</div>` : ''}`;
}
$('#pal-q').addEventListener('input', e => {
  const q = norm(e.target.value.trim());
  document.querySelectorAll('.pcat').forEach(sec => { let any = false; sec.querySelectorAll('.slot').forEach(b => { const ok = !q || b.dataset.q.includes(q); b.hidden = !ok; any = any || ok; }); sec.hidden = !any; });
});

// ----- panel de selección -----
const DIR4 = [['N', 0], ['E', 4], ['S', 8], ['O', 12]];
function renderSel() {
  const body = $('#sel-body'), n = sel.size, nt = selT.size;
  $('#lib-save-sel').disabled = !n && !nt;
  $('#sel-count').textContent = n || nt ? `${n} entidades${nt ? `, ${nt} casillas de suelo` : ''}` : '';
  if (!n && !nt) { body.innerHTML = `<p class="hint" style="margin:0">Haz clic en una entidad para ver y cambiar sus datos. Arrastra sobre una zona vacía para seleccionar varias.</p>`; return; }
  if (n === 1 && !nt) {
    const e = S.ents.get([...sel][0]); if (!e) return; const d = def(e.name);
    const showRecipe = d.recipe || (e.extra && e.extra.recipe != null);
    const ex = Object.assign({}, e.extra); if (d.kind === 'ug') delete ex.type; if (showRecipe) delete ex.recipe;
    body.innerHTML = `
      <div style="margin-bottom:8px"><b>${esc(d.label)}</b>${e.n1 ? ` <span class="hint">(en 1.1: ${esc(e.n1)})</span>` : ''}<div class="code-name">${esc(e.name)}</div></div>
      <dl class="kv"><dt>Posición</dt><dd>${e.x}, ${e.y}</dd><dt>Tamaño</dt><dd>${sz(d, e.dir).join(' × ')}</dd></dl>
      ${['rail', 'railsig', 'legacyrail'].includes(d.kind) ? '' : `<div class="field"><span>Dirección</span><div class="seg" id="sel-dir">${DIR4.map(([l, v]) => `<button data-d="${v}" ${e.dir === v ? 'class="on"' : ''} ${d.rot === false ? 'disabled' : ''} title="${({ N: 'Norte', E: 'Este', S: 'Sur', O: 'Oeste' })[l]}">${l}</button>`).join('')}</div></div>`}
      ${d.kind === 'ug' ? `<div class="field"><span>Tipo</span><div class="seg" id="sel-ug"><button data-t="input" ${ugType(e) === 'input' ? 'class="on"' : ''}>Entrada</button><button data-t="output" ${ugType(e) === 'output' ? 'class="on"' : ''}>Salida</button></div></div>` : ''}
      ${d.kind === 'trainstop' ? `<label class="field"><span>Nombre de la parada</span><input id="sel-station" value="${esc((e.extra && e.extra.station) || '')}" placeholder="Sin nombre" maxlength="200"></label>` : ''}
      ${showRecipe ? `<label class="field"><span>Receta (nombre interno)</span><input id="sel-recipe" list="dl-recipes" value="${esc(e.extra.recipe || '')}" placeholder="p. ej. iron-gear-wheel" spellcheck="false"></label>` : ''}
      <details class="adv"><summary>Datos avanzados (JSON)</summary><textarea class="code small" id="sel-json" spellcheck="false">${esc(JSON.stringify(ex, null, 1))}</textarea><div class="row" style="margin-top:6px"><button class="btn small" id="sel-json-apply">Aplicar datos</button><span class="err" id="sel-json-err" style="font-size:13px"></span></div></details>
      <div class="row" style="margin-top:10px"><button class="btn small" id="sel-pick">Usar como herramienta</button><button class="btn small danger" id="sel-del">Borrar</button></div>`;
    body.querySelectorAll('#sel-dir button').forEach(b => b.onclick = () => { if (rotOne(e.id, false, +b.dataset.d)) renderSel(); });
    body.querySelectorAll('#sel-ug button').forEach(b => b.onclick = () => { act(() => setEnt(e.id, { extra: Object.assign({}, e.extra, { type: b.dataset.t }) })); renderSel(); });
    const si = $('#sel-station'); if (si) si.onchange = () => { const v = si.value.trim(), x = Object.assign({}, e.extra); if (v) x.station = v; else delete x.station; act(() => setEnt(e.id, { extra: x })); };
    const ri = $('#sel-recipe'); if (ri) ri.onchange = () => { const v = ri.value.trim(); const x = Object.assign({}, e.extra); if (v) x.recipe = v; else delete x.recipe; act(() => setEnt(e.id, { extra: x })); };
    $('#sel-json-apply').onclick = () => {
      try { const v = JSON.parse($('#sel-json').value || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Debe ser un objeto { … }');
        for (const k of ['entity_number', 'name', 'position', 'direction']) delete v[k];
        if (d.kind === 'ug') v.type = ugType(e); if (showRecipe && e.extra.recipe && v.recipe == null) v.recipe = e.extra.recipe;
        act(() => setEnt(e.id, { extra: v })); toast('Datos aplicados', 'ok'); }
      catch (err) { $('#sel-json-err').textContent = 'JSON no válido: ' + err.message; }
    };
    $('#sel-pick').onclick = () => { tool = { name: e.name, tile: false }; curDir = e.dir; ugFlip = false; setMode('place'); };
    $('#sel-del').onclick = deleteSel;
    body.insertAdjacentHTML('beforeend', repeatHtml()); bindRepeat();
    return;
  }
  const counts = countBy([...sel].map(id => S.ents.get(id)).filter(Boolean));
  body.innerHTML = `<ul class="clist" style="margin:0 0 10px">${counts.slice(0, 8).map(([nm, c]) => `<li><span class="sw" style="background:${def(nm).color}"></span>${esc(def(nm).label)}<span class="n">${c}</span></li>`).join('')}</ul>
    <div class="row"><button class="btn small" id="ms-copy">Copiar como string</button><button class="btn small" id="ms-save" title="Guardarla en Mis planos para reutilizarla (Ctrl+B)">Guardar como fragmento</button><button class="btn small" id="ms-rot">Rotar</button><button class="btn small danger" id="ms-del">Borrar</button></div>
    <p class="hint">Arrastra para moverla o usa las flechas. Ctrl+C también la copia como string.</p>${repeatHtml()}`;
  $('#ms-save').onclick = () => openSave('sel'); bindRepeat();
  $('#ms-copy').onclick = async () => { const g = selGroup(); clip = g; const ok = await writeClip(groupString(g)); toast(ok ? copyMsg(false, g.ents.length) : 'El navegador bloqueó el portapapeles; prueba con Ctrl+C', ok ? 'ok' : 'warn'); };
  $('#ms-rot').onclick = () => rotateSel(false);
  $('#ms-del').onclick = deleteSel;
}
// ----- repetir la selección (teselar columnas de hornos, filas de balizas, bloques…) -----
const REPD = [['→', 1, 'derecha'], ['↓', 2, 'abajo'], ['←', 3, 'izquierda'], ['↑', 0, 'arriba']];
let repDir = 1;
function repeatHtml() {
  return `<div class="rep"><span>Repetir</span><div class="row"><input class="inp num" id="rp-n" type="number" min="1" max="200" value="${LS.get('bpr.repN', 3)}" aria-label="Número de copias"><span>copias</span><div class="seg" id="rp-d">${REPD.map(([l, d, t]) => `<button data-d="${d}" ${d === repDir ? 'class="on"' : ''} title="Hacia ${t}" aria-label="Hacia ${t}">${l}</button>`).join('')}</div></div>
    <span>Separación</span><div class="row"><input class="inp num" id="rp-gap" type="number" min="0" max="500" value="${LS.get('bpr.repGap', 0)}" aria-label="Casillas libres entre copias"><span>casillas</span><button class="btn small" id="rp-go">Repetir</button></div></div>`;
}
function bindRepeat() {
  document.querySelectorAll('#rp-d button').forEach(b => b.onclick = () => { repDir = +b.dataset.d; document.querySelectorAll('#rp-d button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#rp-go').onclick = () => { const n = clamp(Math.round(+$('#rp-n').value) || 1, 1, 200), gap = clamp(Math.round(+$('#rp-gap').value) || 0, 0, 500); LS.set('bpr.repN', n); LS.set('bpr.repGap', gap); repeatSel(n, repDir, gap); };
}
// n copias pegadas a la selección hacia dir (0 = arriba, 1 = derecha, 2 = abajo, 3 = izquierda), con gap casillas libres entre ellas
function repeatSel(n, dir, gap) {
  if (!sel.size && !selT.size) return;
  const g = selGroup(), b = tileBox(g), v = DV[dir], rails = g.ents.some(e => def(e.name).g2);
  let step = (v[0] ? b.x1 - b.x0 : b.y1 - b.y0) + gap; if (rails && step % 2) step++;   // las vías van en una rejilla de 2×2
  if (g.ents.length * n > 50000) return toast('Son demasiadas entidades de una vez; repite en varias tandas', 'warn');
  let bad = 0;
  for (let k = 1; k <= n && !bad; k++) for (const e of g.ents) if (def(e.name).kind !== 'rail' && hits(e.name, e.x + v[0] * step * k, e.y + v[1] * step * k, e.dir).size) { bad = k; break; }
  if (bad) return toast(`La copia ${bad} chocaría con lo que ya hay. Deja sitio o reduce las copias.`, 'warn');
  const added = [], addedT = [];
  act(() => {
    ix(); const have = new Map(railIdx);
    for (let k = 1; k <= n; k++) {
      const dx = v[0] * step * k, dy = v[1] * step * k, map = new Map();
      for (const e of g.ents) {
        const x = e.x + dx, y = e.y + dy, ex = def(e.name).kind === 'rail' ? have.get(railKey(e.name, x, y, e.dir)) : undefined;
        const id = ex != null ? ex : addEnt(Object.assign({}, e, { x, y })); map.set(e.id, id); added.push(id);
      }
      for (const t of g.tiles) { setTile(t.x + dx, t.y + dy, t.name); addedT.push(K(t.x + dx, t.y + dy)); }
      if (g.wires.length) { tW(); for (const w of g.wires) S.wires.push([map.get(w[0]), w[1], map.get(w[2]), w[3]]); }
    }
  });
  for (const id of added) sel.add(id); for (const k of addedT) selT.add(k);
  renderSel(); dirty = true; toast(`${n} ${n === 1 ? 'copia' : 'copias'} hacia ${REPD.find(r => r[1] === dir)[2]} cada ${step} casillas. Ctrl+Z las deshace.`, 'ok');
}
function countBy(list) { const m = new Map(); for (const e of list) m.set(e.name, (m.get(e.name) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function renderContents() {
  const ul = $('#contents'), all = [...S.ents.values()];
  const g = tileBox({ ents: all, tiles: [...S.tiles.values()] });
  $('#dims').textContent = all.length || S.tiles.size ? `${g.x1 - g.x0} × ${g.y1 - g.y0} casillas` : '';
  if (!all.length && !S.tiles.size) { ul.innerHTML = '<li class="hint" style="padding:0">El plano está vacío.</li>'; return; }
  const rows = countBy(all).map(([n, c]) => `<li><span class="sw" style="background:${def(n).color}"></span>${esc(def(n).label)}<span class="n">${c}</span></li>`);
  const tc = new Map(); for (const t of S.tiles.values()) tc.set(t.name, (tc.get(t.name) || 0) + 1);
  for (const [n, c] of tc) rows.push(`<li><span class="sw" style="background:${tileDef(n).color}"></span>${esc(tileDef(n).label)}<span class="n">${c}</span></li>`);
  ul.innerHTML = rows.join('');
}

// ----- importar -----
function instantiate(parsed) { // grupo con ids = entity_number
  return { ents: parsed.ents.map(e => ({ id: e.num, name: e.name, n1: e.n1, x: e.x, y: e.y, dir: e.dir, xs: e.xs, extra: e.extra })), tiles: parsed.tiles, wires: parsed.wires };
}
function openParsed(parsed) {
  S.ents.clear(); S.tiles.clear(); S.wires = []; S.nextId = 1; sel.clear(); selT.clear(); UNDO.length = 0; REDO.length = 0; TX = null;
  alignToSnap(parsed);
  const map = new Map();
  for (const e of parsed.ents) { const id = S.nextId++; map.set(e.num, id); S.ents.set(id, { id, name: e.name, n1: e.n1, x: e.x, y: e.y, dir: e.dir, xs: e.xs, extra: e.extra || {} }); }
  for (const t of parsed.tiles) S.tiles.set(K(t.x, t.y), t);
  for (const w of parsed.wires) if (map.has(w[0]) && map.has(w[2])) S.wires.push([map.get(w[0]), w[1], map.get(w[2]), w[3]]);
  const m = parsed.meta, fn = n => map.has(n) ? map.get(n) : null;
  S.meta = Object.assign(newMeta(), m, { schedules: BP.mapSched(m.schedules, fn), stock: BP.mapStock(m.stock, fn) });
  S.target = m.scheme; $('#bp-target').value = String(S.target);
  $('#bp-label').value = S.meta.label; $('#bp-desc').value = S.meta.description; renderSnap();
  setMode('select'); idxDirty = true; fitView(); changed(); renderBpSrc();
}
// con cuadrícula absoluta, el plano se desplaza para que su desfase respecto a la cuadrícula del editor sea el del juego
function alignToSnap(parsed) {
  const sn = BP.getSnap(parsed.meta && parsed.meta.extraBp); if (!sn || !sn.abs || !(parsed.ents.length + parsed.tiles.length)) return;
  const b = tileBox({ ents: parsed.ents, tiles: parsed.tiles });
  let dx = ((sn.ox - b.x0) % sn.w + sn.w) % sn.w, dy = ((sn.oy - b.y0) % sn.h + sn.h) % sn.h;
  if ((dx % 2 || dy % 2) && parsed.ents.some(e => def(e.name).g2)) return;   // las vías no admiten desplazamientos impares
  if (dx || dy) { for (const e of parsed.ents) { e.x += dx; e.y += dy; } parsed.tiles = parsed.tiles.map(t => ({ x: t.x + dx, y: t.y + dy, name: t.name })); }
}
function renderSnap() { setGridInputs('#bp', BP.getSnap(S.meta.extraBp)); dirty = true; }
['#bp-gw', '#bp-gh', '#bp-gabs'].forEach(id => $(id).addEventListener('change', () => { S.meta.extraBp = BP.setSnap(S.meta.extraBp, readGrid('#bp')); dirty = true; clearTimeout(saveT); saveT = setTimeout(saveDraft, 900); }));
let pendingBook = null;
function importObject(obj, how, srcText) {
  if (obj && obj.blueprint_book) {
    const list = BP.flattenBook(obj.blueprint_book);
    if (!list.length) return toast('El libro de planos está vacío', 'warn');
    openModal('m-import'); $('#imp-text').value = srcText || JSON.stringify(obj); showBook(list, how, obj.blueprint_book.label); return;
  }
  if (!obj || !obj.blueprint) {
    const kind = obj && (obj.upgrade_planner ? 'un planificador de mejoras' : obj.deconstruction_planner ? 'un planificador de deconstrucción' : null);
    return toast(kind ? `Ese string es ${kind}; aquí solo se editan planos.` : 'No contiene ningún plano.', 'err');
  }
  loadBp(obj.blueprint, how);
}
function loadBp(bp, how) {
  const parsed = BP.parseBlueprint(bp);
  if (!parsed.ents.length && !parsed.tiles.length) return toast('El plano no tiene entidades ni suelos', 'warn');
  if (how === 'hold') holdGroup(instantiate(parsed), `«${parsed.meta.label || 'Plano'}» en el cursor (${parsed.ents.length} entidades): clic para colocarlo, Mayús+clic reemplaza, Esc lo suelta.`);
  else { openParsed(parsed); toast(`Abierto «${parsed.meta.label || 'Plano sin nombre'}»: ${parsed.ents.length} entidades, versión ${BP.verStr(parsed.meta.version)}`, 'ok'); }
}
function showBook(list, how, label) {
  const ul = $('#imp-book'); pendingBook = { list, label: label || 'Libro importado' }; ul.hidden = false; $('#imp-lib').hidden = false;
  ul.innerHTML = list.map((it, i) => `<li><span title="${esc(it.label)}">${esc(it.label)}</span><small class="hint" style="margin:0">${it.n} ent.</small><button class="btn small" data-h="${i}">Al cursor</button><button class="btn small primary" data-o="${i}">Abrir</button></li>`).join('');
  ul.querySelectorAll('button').forEach(b => b.onclick = () => { const it = list[+(b.dataset.o ?? b.dataset.h)]; closeModal($('#m-import')); loadBp(it.bp, b.dataset.o != null ? 'open' : 'hold'); });
  $('#imp-sum').textContent = `Libro de planos con ${list.length} planos. Elige cuál abrir:`; $('#imp-err').textContent = '';
}
let impT = 0;
function checkImport() {
  clearTimeout(impT); impT = setTimeout(async () => {
    const t = $('#imp-text').value; $('#imp-book').hidden = true; $('#imp-lib').hidden = true; pendingBook = null; $('#imp-err').textContent = ''; $('#imp-sum').textContent = '';
    if (!t.trim()) return;
    try { const o = await BP.decode(t);
      if (o.blueprint_book) return showBook(BP.flattenBook(o.blueprint_book), 'open', o.blueprint_book.label);
      if (o.blueprint) { const b = o.blueprint; $('#imp-sum').textContent = `Plano «${b.label || 'sin nombre'}»: ${(b.entities || []).length} entidades, ${(b.tiles || []).length} suelos, versión ${BP.verStr(b.version)}`; }
      else $('#imp-err').textContent = 'Se puede leer, pero no es un plano.';
    } catch (e) { $('#imp-err').textContent = e.message; }
  }, 120);
}
$('#imp-text').addEventListener('input', checkImport);
async function doImport(how) {
  try { const o = await BP.decode($('#imp-text').value);
    if (o.blueprint_book) return showBook(BP.flattenBook(o.blueprint_book), how, o.blueprint_book.label);
    closeModal($('#m-import')); importObject(o, how);
  } catch (e) { $('#imp-err').textContent = e.message; }
}
$('#imp-open').onclick = () => doImport('open');
$('#imp-lib').onclick = () => { if (pendingBook && pendingBook.list.length) openSave('book', pendingBook); };
$('#imp-hold').onclick = () => doImport('hold');
$('#imp-paste').onclick = async () => {
  try { const t = await navigator.clipboard.readText(); $('#imp-text').value = t; checkImport(); }
  catch (e) { $('#imp-text').focus(); $('#imp-err').textContent = 'El navegador no deja leer el portapapeles desde un botón. Pulsa Ctrl+V dentro del cuadro.'; }
};

// ----- exportar -----
function fullBp() {
  S.meta.label = $('#bp-label').value.trim(); S.meta.description = $('#bp-desc').value.trim();
  const ents = [...S.ents.values()], tiles = [...S.tiles.values()];
  const meta = Object.assign({}, S.meta, { extraBp: snapExtra(S.meta.extraBp, BP.getSnap(S.meta.extraBp), { ents, tiles }) });
  return BP.buildBlueprint({ ents, wires: S.wires, tiles, meta, target: S.target });
}
function rails20() { let n = 0; for (const e of S.ents.values()) { const d = def(e.name); if (d.kind === 'rail' && (d.rt !== 'S' || e.dir % 4 === 2 || d.elev)) n++; } return n; }
async function copyAll() {
  if (!S.ents.size && !S.tiles.size) return toast('El plano está vacío: no hay nada que copiar', 'warn');
  const ok = await writeClip(BP.encodeSync(fullBp()));
  const r20 = S.target === 1 ? rails20() : 0;
  if (ok && r20) toast(`String copiado, pero ${r20} piezas de vía son de 2.0 (curvas o diagonales) y Factorio 1.1 no las reconoce. Cambia «Exportar para» a 2.0.`, 'warn', 6500);
  else if (ok) toast(`String copiado (${S.ents.size} entidades, para Factorio ${S.target === 1 ? '1.1' : '2.0'}). En el juego: «Importar cadena» y Ctrl+V.`, 'ok', 4200);
  else { openExport(); toast('El navegador bloqueó el portapapeles. Selecciona el texto y cópialo con Ctrl+C.', 'warn', 5000); }
}
async function openExport() {
  if (!S.ents.size && !S.tiles.size) return toast('El plano está vacío', 'warn');
  const bp = fullBp(), str = await BP.encode(bp);
  $('#ex-text').value = str; $('#ex-jtext').value = JSON.stringify(bp, null, 2); $('#ex-err').textContent = '';
  const r20 = S.target === 1 ? rails20() : 0;
  $('#ex-info').textContent = `${S.ents.size} entidades, ${str.length.toLocaleString('es')} caracteres, versión ${BP.verStr(bp.blueprint.version)}` + (r20 ? `. Ojo: ${r20} piezas de vía de 2.0 no existen en 1.1` : '');
  openModal('m-export'); setTab('str'); setTimeout(() => { $('#ex-text').focus(); $('#ex-text').select(); }, 30);
}
let exTab = 'str';
function setTab(t) { exTab = t; document.querySelectorAll('#m-export [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('#ex-str').hidden = t !== 'str'; $('#ex-json').hidden = t !== 'json'; $('#ex-apply').hidden = t !== 'json'; $('#ex-copy').textContent = t === 'json' ? 'Copiar JSON' : 'Copiar string'; }
document.querySelectorAll('#m-export [data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('#ex-copy').onclick = async () => { const ta = exTab === 'json' ? $('#ex-jtext') : $('#ex-text'); const ok = await writeClip(ta.value); if (!ok) { ta.focus(); ta.select(); } toast(ok ? 'Copiado al portapapeles' : 'Selecciona el texto y pulsa Ctrl+C', ok ? 'ok' : 'warn'); };
$('#ex-apply').onclick = () => { try { const o = JSON.parse($('#ex-jtext').value); closeModal($('#m-export')); importObject(o, 'open'); } catch (e) { $('#ex-err').textContent = 'JSON no válido: ' + e.message; } };

// ----- modales -----
let lastFocus = null;
function openModal(id, focusSel) { lastFocus = document.activeElement; const m = $('#' + id); m.hidden = false; const f = m.querySelector(focusSel || 'textarea,button.primary,button'); if (f) setTimeout(() => f.focus(), 20); }
function closeModal(m) {
  m.hidden = true;
  if (m.id === 'm-confirm' && confirmRes) { const r = confirmRes; confirmRes = null; r(false); }
  if (lastFocus && lastFocus.focus && lastFocus.isConnected && lastFocus !== document.body) lastFocus.focus({ preventScroll: true }); else cv.focus({ preventScroll: true });
}
// confirmación propia: confirm() del navegador puede estar bloqueado dentro de un visor enmarcado
let confirmRes = null;
function askConfirm(title, text, yes) {
  if (confirmRes) { const r = confirmRes; confirmRes = null; r(false); }
  $('#mc-t').textContent = title; $('#mc-d').textContent = text; $('#mc-yes').textContent = yes || 'Aceptar';
  openModal('m-confirm', '#mc-no');
  return new Promise(r => { confirmRes = r; });
}
$('#mc-yes').onclick = () => { const r = confirmRes; confirmRes = null; closeModal($('#m-confirm')); if (r) r(true); };
$('#mc-no').onclick = () => closeModal($('#m-confirm'));
document.querySelectorAll('.modal').forEach(m => { m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); }); });

// ----- biblioteca y borrador -----
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
// Biblioteca: planos completos y fragmentos guardados en este navegador (localStorage), agrupados por carpetas.
// Cada elemento guarda el string listo para Factorio; las carpetas se exportan como libros de planos.
let lib = LS.get('bpr.lib', []).filter(x => x && typeof x.str === 'string').map((x, i) => Object.assign({ folder: '', kind: 'plan' }, x, { id: x.id || 'l' + (+x.t || 0).toString(36) + i }));
const libClosed = new Set(LS.get('bpr.libClosed', []));
const saveLib = () => LS.set('bpr.lib', lib);
const libFolders = () => [...new Set(lib.map(x => x.folder || ''))].sort((a, b) => !a ? 1 : !b ? -1 : a.localeCompare(b, 'es'));
const THUMB = new Map();
// miniatura: la silueta del plano con los colores de cada entidad
async function drawThumb(cnv, it) {
  let p = THUMB.get(it.id);
  if (!p) { try { const o = await BP.decode(it.str); p = o.blueprint ? BP.parseBlueprint(o.blueprint) : null; } catch (e) { p = null; } THUMB.set(it.id, p); }
  const c = cnv.getContext('2d'), W = cnv.width; c.clearRect(0, 0, W, W); if (!p) return;
  const ents = p.ents.map(e => ({ name: e.name, x: e.x, y: e.y, dir: e.dir, extra: e.extra || {} })), g = groupBox({ ents, tiles: p.tiles });
  const s = Math.min(W * .9 / Math.max(1, g.x1 - g.x0), W * .9 / Math.max(1, g.y1 - g.y0), 6), ox = (W - (g.x1 - g.x0) * s) / 2 - g.x0 * s, oy = (W - (g.y1 - g.y0) * s) / 2 - g.y0 * s;
  for (const t of p.tiles) { c.fillStyle = tileDef(t.name).color; c.fillRect(ox + t.x * s, oy + t.y * s, s + .5, s + .5); }
  for (const e of ents) { if (def(e.name).kind === 'rail') drawRailBed(c, e, ox, oy, s); }
  for (const e of ents) { if (def(e.name).kind === 'rail') continue; const b = bb(e); drawEnt(c, e, ox + b.x * s, oy + b.y * s, b.w * s, b.h * s, s, null); }
}
function libMeta(it) {
  const bits = [`${it.n} ent.`]; if (it.w && it.h) bits.push(`${it.w}×${it.h}`); if (it.grid) bits.push(`cuadrícula ${it.grid}`);
  return bits.join(' · ') + ' · ' + new Date(it.t).toLocaleDateString('es');
}
function renderLib() {
  const root = $('#lib-list'), q = norm($('#lib-q').value.trim());
  $('#dl-folders').innerHTML = libFolders().filter(Boolean).map(f => `<option value="${esc(f)}">`).join('');
  $('#lib-book').disabled = !lib.length;
  if (!lib.length) { root.innerHTML = '<p class="hint">Aún no has guardado nada. Selecciona una parte de tu diseño y pulsa «Guardar selección» para tenerla a mano como fragmento.</p>'; return; }
  const view = lib.filter(it => !q || norm(it.name + ' ' + (it.folder || '')).includes(q));
  if (!view.length) { root.innerHTML = '<p class="hint">Nada coincide con la búsqueda.</p>'; return; }
  const groups = new Map(); for (const f of libFolders()) groups.set(f, []);
  for (const it of view.sort((a, b) => b.t - a.t)) groups.get(it.folder || '').push(it);
  root.innerHTML = [...groups].filter(([, l]) => l.length).map(([f, l]) => `<details class="lfold" data-f="${esc(f)}" ${q || !libClosed.has(f) ? 'open' : ''}>
    <summary><span class="fn">${esc(f || 'Sin carpeta')}</span><small>${l.length}</small><button class="btn small" data-fbook="${esc(f)}" title="Copiar la carpeta como libro de planos">Libro</button></summary>
    <ul class="clist lib">${l.map(it => `<li data-id="${esc(it.id)}"><canvas class="thumb" width="88" height="88" aria-hidden="true"></canvas><div class="lm"><b title="${esc(it.name)}">${it.kind === 'frag' ? '<span class="tag">Fragmento</span>' : ''}${esc(it.name)}</b><span class="meta">${esc(libMeta(it))}</span></div>
      <span class="acts"><button class="btn small primary" data-a="hold" title="Llevarlo en el cursor para colocarlo en el plano actual">Colocar</button></span>
      <div class="more"><button class="btn small" data-a="open">Abrir</button><button class="btn small" data-a="copy">Copiar string</button><button class="btn small" data-a="edit">Editar</button><button class="btn small danger" data-a="del">Borrar</button></div></li>`).join('')}</ul></details>`).join('');
  root.querySelectorAll('li[data-id]').forEach(li => { const it = lib.find(x => x.id === li.dataset.id); if (it) drawThumb(li.querySelector('canvas'), it); });
}
$('#lib-list').addEventListener('toggle', e => { const d = e.target; if (!d.matches || !d.matches('details.lfold') || $('#lib-q').value.trim()) return; if (d.open) libClosed.delete(d.dataset.f); else libClosed.add(d.dataset.f); LS.set('bpr.libClosed', [...libClosed]); }, true);
$('#lib-list').addEventListener('click', async e => {
  const fb = e.target.closest('[data-fbook]');
  if (fb) { e.preventDefault(); return copyBook(lib.filter(x => (x.folder || '') === fb.dataset.fbook), fb.dataset.fbook || 'Mis planos', false); }
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const it = lib.find(x => x.id === li.dataset.id); if (!it) return;
  const b = e.target.closest('button[data-a]');
  if (!b) { const was = li.classList.contains('open'); $('#lib-list').querySelectorAll('li.open').forEach(x => x.classList.remove('open')); li.classList.toggle('open', !was); return; }
  const a = b.dataset.a;
  if (a === 'hold' || a === 'open') {
    try { const o = await BP.decode(it.str); if (!o.blueprint) throw new Error('No contiene un plano'); if (a === 'open' && (S.ents.size || S.tiles.size) && !(await askConfirm(`¿Abrir «${it.name}»?`, 'Sustituye lo que hay en el lienzo. Si solo quieres añadirlo, usa «Colocar».', 'Abrir'))) return; loadBp(o.blueprint, a); }
    catch (err) { toast(err.message, 'err'); }
    $('#side').classList.remove('open'); return;
  }
  if (a === 'copy') { const ok = await writeClip(it.str); return toast(ok ? `String de «${it.name}» copiado` : 'No se pudo copiar', ok ? 'ok' : 'warn'); }
  if (a === 'edit') return openSave('edit', it);
  if (!(await askConfirm(`¿Borrar «${it.name}»?`, 'Se quitará de tus planos guardados. No se puede deshacer.', 'Borrar'))) return;
  lib = lib.filter(x => x.id !== it.id); THUMB.delete(it.id); saveLib(); renderLib(); toast(`Borrado «${it.name}»`);
});
$('#lib-q').addEventListener('input', renderLib);
function libAdd(items) {
  const prev = lib; lib = [...items, ...lib];
  if (saveLib()) return true;
  lib = prev; toast('No se pudo guardar: el navegador no tiene más sitio o no permite guardar datos aquí. Borra algún plano o copia el string para conservarlo.', 'warn', 6000); return false;
}
// libro de planos: con folders, una subcarpeta por carpeta
async function copyBook(items, label, folders) {
  if (!items.length) return toast('No hay planos que copiar', 'warn');
  const bpOf = async it => { try { const o = await BP.decode(it.str); return o.blueprint ? { blueprint: Object.assign({}, o.blueprint, { label: it.name }) } : null; } catch (e) { return null; } };
  const kids = [];
  if (folders) {
    for (const f of libFolders()) {
      const l = items.filter(x => (x.folder || '') === f); if (!l.length) continue;
      const bps = (await Promise.all(l.map(bpOf))).filter(Boolean);
      if (f) kids.push(BP.buildBook(f, bps, S.target)); else kids.push(...bps);
    }
  } else kids.push(...(await Promise.all(items.map(bpOf))).filter(Boolean));
  const ok = await writeClip(BP.encodeSync(BP.buildBook(label, kids, S.target)));
  toast(ok ? `Libro «${label}» copiado (${items.length} planos, para Factorio ${S.target === 1 ? '1.1' : '2.0'}). En el juego: «Importar cadena».` : 'El navegador bloqueó el portapapeles', ok ? 'ok' : 'warn', 4500);
}
$('#lib-book').onclick = () => copyBook(lib, 'Mis planos', true);
$('#lib-import').onclick = () => { openModal('m-import'); $('#imp-text').value = ''; checkImport(); toast('Pega un libro de planos y pulsa «Guardar libro en Mis planos»'); };

// ----- diálogo de guardado: plano completo, selección (fragmento), edición o libro importado -----
let SV = null;
function setGridInputs(pfx, g) { $(pfx + '-gw').value = g ? g.w : ''; $(pfx + '-gh').value = g ? g.h : ''; $(pfx + '-gabs').checked = !!(g && g.abs); }
function readGrid(pfx) { const w = Math.round(+$(pfx + '-gw').value), h = Math.round(+$(pfx + '-gh').value); return w > 0 && h > 0 ? { w, h, abs: $(pfx + '-gabs').checked } : null; }
function tileBox(g) { const b = groupBox(g); return { x0: Math.floor(b.x0 + 1e-6), y0: Math.floor(b.y0 + 1e-6), x1: Math.ceil(b.x1 - 1e-6), y1: Math.ceil(b.y1 - 1e-6) }; }
// la cuadrícula del editor empieza en (0, 0): el desfase del plano respecto a ella sale de su esquina superior izquierda
function snapExtra(extraBp, snap, g) { if (!snap) return BP.setSnap(extraBp, null); const b = tileBox(g); return BP.setSnap(extraBp, Object.assign({}, snap, { ox: b.x0, oy: b.y0 })); }
function openSave(kind, it) {
  if (kind === 'plan' && !S.ents.size && !S.tiles.size) return toast('El plano está vacío', 'warn');
  if (kind === 'sel' && !sel.size && !selT.size) return toast('Selecciona primero lo que quieras guardar (arrastra sobre una zona)', 'warn');
  const g = kind === 'sel' ? selGroup() : kind === 'plan' ? { ents: [...S.ents.values()], tiles: [...S.tiles.values()], wires: S.wires } : null;
  SV = { kind, it, g, book: kind === 'book' ? it : null };
  const b = g ? tileBox(g) : null; SV.size = b ? [b.x1 - b.x0, b.y1 - b.y0] : it && it.w ? [it.w, it.h] : null;
  $('#sv-t').textContent = { plan: 'Guardar el plano', sel: 'Guardar la selección', edit: 'Editar plano guardado', book: 'Guardar libro en Mis planos' }[kind];
  $('#sv-what').textContent = kind === 'sel' ? `Fragmento con ${g.ents.length} entidades${g.tiles.length ? ` y ${g.tiles.length} casillas de suelo` : ''} (${SV.size.join(' × ')}). Después podrás colocarlo con el cursor en cualquier plano.`
    : kind === 'plan' ? `Plano completo: ${g.ents.length} entidades (${SV.size.join(' × ')}).` : kind === 'book' ? `${it.list.length} planos. Se guardan en la carpeta que elijas.` : '';
  $('#sv-name').closest('.field').hidden = kind === 'book';
  $('#sv-name').value = kind === 'edit' ? it.name : kind === 'plan' ? ($('#bp-label').value.trim() || '') : '';
  $('#sv-folder').value = kind === 'edit' ? (it.folder || '') : kind === 'book' ? it.label : (LS.get('bpr.lastFolder', '') || '');
  $('#sv-grid').hidden = kind === 'book';
  setGridInputs('#sv', kind === 'plan' ? BP.getSnap(S.meta.extraBp) : kind === 'edit' ? it.snap || null : null);
  $('#sv-gfit').hidden = !SV.size;
  openModal('m-save', kind === 'book' ? '#sv-folder' : '#sv-name');
}
$('#sv-gfit').onclick = () => { if (!SV || !SV.size) return; $('#sv-gw').value = SV.size[0]; $('#sv-gh').value = SV.size[1]; };
$('#sv-ok').onclick = async () => {
  if (!SV) return;
  const { kind, it, g } = SV, folder = $('#sv-folder').value.trim().slice(0, 60), grid = readGrid('#sv');
  const name = ($('#sv-name').value.trim() || (kind === 'sel' ? 'Fragmento' : 'Plano sin nombre')).slice(0, 120);
  const btn = $('#sv-ok'); btn.disabled = true;
  try {
    if (kind === 'book') {
      const now = Date.now(), items = it.list.map((x, i) => { const p = BP.parseBlueprint(x.bp), b = tileBox({ ents: p.ents, tiles: p.tiles }), sn = BP.getSnap(p.meta.extraBp);
        return { id: 'l' + now.toString(36) + '-' + i, name: x.label.slice(0, 120), folder, kind: 'plan', str: BP.encodeSync({ blueprint: x.bp }), n: x.n, w: b.x1 - b.x0, h: b.y1 - b.y0, grid: sn ? `${sn.w}×${sn.h}` : null, snap: sn, t: now - i }; });
      if (libAdd(items.reverse())) { closeModal($('#m-save')); closeModal($('#m-import')); toast(`Guardados ${items.length} planos en «${folder || 'Sin carpeta'}»`, 'ok'); }
    } else if (kind === 'edit') {
      let str = it.str;
      if (JSON.stringify(grid) !== JSON.stringify(it.snap ? { w: it.snap.w, h: it.snap.h, abs: it.snap.abs } : null)) {   // la cuadrícula va dentro del string: se reescribe
        const o = await BP.decode(it.str), p = BP.parseBlueprint(o.blueprint);
        str = BP.encodeSync({ blueprint: Object.assign({}, BP.setSnap(o.blueprint, null), snapExtra({}, grid, { ents: p.ents, tiles: p.tiles })) });
      }
      Object.assign(it, { name, folder, str, grid: grid ? `${grid.w}×${grid.h}` : null, snap: grid }); THUMB.delete(it.id);
      if (saveLib()) { closeModal($('#m-save')); toast(`Guardado «${name}»`, 'ok'); }
    } else {
      const meta = kind === 'plan' ? Object.assign({}, S.meta, { label: name, description: $('#bp-desc').value.trim() }) : { label: name };
      meta.extraBp = snapExtra(kind === 'plan' ? S.meta.extraBp : {}, grid, g);
      const str = BP.encodeSync(BP.buildBlueprint({ ents: g.ents, wires: g.wires, tiles: g.tiles, meta, target: S.target }));
      const item = { id: 'l' + Date.now().toString(36), name, folder, kind: kind === 'sel' ? 'frag' : 'plan', str, n: g.ents.length, w: SV.size[0], h: SV.size[1], grid: grid ? `${grid.w}×${grid.h}` : null, snap: grid, t: Date.now() };
      if (libAdd([item])) { closeModal($('#m-save')); LS.set('bpr.lastFolder', folder); toast(`Guardado «${name}»${folder ? ` en «${folder}»` : ''}. Pulsa «Colocar» en Mis planos para reutilizarlo.`, 'ok', 4000); }
    }
    renderLib();
  } catch (err) { toast('No se pudo guardar: ' + err.message, 'err'); }
  finally { btn.disabled = false; }
};
$('#m-save').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); $('#sv-ok').click(); } });
$('#lib-save').onclick = () => openSave('plan');
$('#lib-save-sel').onclick = () => openSave('sel');
async function saveDraft() { try { if (!S.ents.size && !S.tiles.size) { localStorage.removeItem('bpr.draft'); return; } LS.set('bpr.draft', await BP.encode(fullBp())); } catch (e) { } }
function renderBpSrc() { $('#bp-src').textContent = S.meta.version ? `Importado de Factorio ${BP.verStr(S.meta.version)}.${S.meta.scheme !== S.target ? ' Al convertir de versión se traducen nombres y direcciones; revisa filtros y combinadores.' : ''}` : 'Si ya lo usas en el juego, elige la misma versión que tengas instalada.'; }

// ----- ejemplo -----
function loadExample() {
  const E = [], add = (name, x, y, dir, extra) => E.push({ num: E.length + 1, name, n1: null, x, y, dir: dir || 0, xs: 2, extra: extra || {} });
  for (let x = 0; x < 12; x++) add('transport-belt', x + .5, .5, 4);
  for (let i = 0; i < 3; i++) {
    const bx = i * 4;
    add('inserter', bx + 1.5, 1.5, 0); add('assembling-machine-2', bx + 1.5, 3.5, 0, { recipe: 'iron-gear-wheel' }); add('fast-inserter', bx + 1.5, 5.5, 0);
    add('medium-electric-pole', bx + 3.5, 3.5);
  }
  for (let x = 0; x < 12; x++) add('transport-belt', x + .5, 6.5, 4);
  add('underground-belt', 12.5, .5, 4, { type: 'input' }); add('underground-belt', 16.5, .5, 4, { type: 'output' });
  add('splitter', 12.5, 7, 4);
  for (let x = 13; x < 17; x++) { add('transport-belt', x + .5, 6.5, 4); add('transport-belt', x + .5, 7.5, 4); }
  const tiles = []; for (let x = -1; x < 18; x++) for (const y of [-1, 8]) tiles.push({ x, y, name: 'refined-concrete' });
  openParsed({ ents: E, tiles, wires: [], meta: Object.assign(newMeta(), { label: 'Ejemplo: engranajes', scheme: 2 }) });
  S.meta.version = null; renderBpSrc(); toast('Ejemplo cargado. Prueba a seleccionar, mover con las flechas o pulsar R.', 'ok');
}

// ----- botones -----
function toggleFlag(f) {
  if (f === 'grid') showGrid = !showGrid; else if (f === 'areas') showAreas = !showAreas; else if (f === 'wires') showWires = !showWires;
  const on = { grid: showGrid, areas: showAreas, wires: showWires }[f]; const b = document.querySelector(`.tool[data-act="${f}"]`); if (b) b.classList.toggle('on', on); dirty = true;
}
document.querySelectorAll('.tool[data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (a === 'select' || a === 'erase') setMode(a === mode && a === 'erase' ? 'select' : a);
  else if (a === 'rotate') doRotate(false); else if (a === 'pipette') { pipette(); if (!hover.inside) toast('Pasa el ratón sobre una entidad y pulsa Q', 'warn'); }
  else if (a === 'undo') undo(); else if (a === 'redo') redo(); else if (a === 'fit') fitView(); else toggleFlag(a);
  cv.focus({ preventScroll: true });
}));
$('#b-new').onclick = async () => { if ((S.ents.size || S.tiles.size) && !(await askConfirm('¿Empezar un plano vacío?', 'Lo que hay ahora en el lienzo se perderá si no lo has copiado o guardado.', 'Empezar de cero'))) return; openParsed({ ents: [], tiles: [], wires: [], meta: newMeta() }); S.target = 2; $('#bp-target').value = '2'; renderBpSrc(); };
$('#b-import').onclick = $('#e-import').onclick = () => { openModal('m-import'); $('#imp-text').select(); checkImport(); };
$('#b-copy').onclick = $('#s-copy').onclick = copyAll;
$('#s-export').onclick = openExport;
$('#b-help').onclick = () => openModal('m-help');
$('#e-example').onclick = loadExample;
$('#b-side').onclick = () => $('#side').classList.toggle('open');
$('#bp-target').onchange = e => { S.target = +e.target.value; renderBpSrc(); saveDraft(); };
$('#bp-label').oninput = $('#bp-desc').oninput = () => { clearTimeout(saveT); saveT = setTimeout(saveDraft, 900); };
$('#dl-recipes').innerHTML = BP.RECIPES.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
document.addEventListener('pointerdown', e => { const sd = $('#side'); if (sd.classList.contains('open') && !sd.contains(e.target) && e.target !== $('#b-side')) sd.classList.remove('open'); });

// ----- arranque -----
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
new ResizeObserver(resize).observe(cv);
resize(); V.s = 32; V.ox = -CW / 2 / V.s; V.oy = -CH / 2 / V.s;
buildPalette(); renderLib(); renderSel(); renderContents(); renderBpSrc(); setMode('select'); updateStatus();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });
requestAnimationFrame(frame);
(async () => {
  const d = LS.get('bpr.draft', null);
  if (d) { try { const o = await BP.decode(d); if (o.blueprint) { openParsed(BP.parseBlueprint(o.blueprint)); toast('Recuperado tu último plano'); } } catch (e) { } }
  updateEmpty();
})();
