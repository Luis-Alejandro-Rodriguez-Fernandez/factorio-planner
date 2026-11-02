import { describe, it, expect } from 'vitest';
import { BP } from '../src/core/blueprint.js';
import { rotQ } from '../src/core/rails.js';
import { vulcanusBook, PRESETS, RECIPE_FLUIDS, BLOCK, BUS } from '../src/core/presets.js';

const { def, sz, PORTS } = BP;
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const card = d => ((Math.round((d | 0) / 4) % 4) + 4) % 4;
const K = (x, y) => x + ',' + y;
const book = vulcanusBook().blueprint_book;
const plans = BP.flattenBook(book).map(it => ({ label: it.label, bp: it.bp, p: BP.parseBlueprint(it.bp) }));
const isBlock = pl => !!BP.getSnap(pl.p.meta.extraBp);

function tilesOf(e) { const [w, h] = sz(def(e.name), e.dir), x0 = Math.round(e.x - w / 2), y0 = Math.round(e.y - h / 2), out = []; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]); return out; }
function occMap(ents) { const m = new Map(); for (const e of ents) for (const [x, y] of tilesOf(e)) m.set(K(x, y), e); return m; }
function ports(e) {
  const pp = PORTS[e.name]; if (!pp) return [];
  const q = def(e.name).rot === false ? 0 : card(e.dir);
  return pp.map(([x, y, pd, flow, kind, pos4], k) => { const [rx, ry] = pos4 ? pos4[q] : rotQ(x, y, q), tx = Math.floor(e.x + rx), ty = Math.floor(e.y + ry), v = DV[card((pd + 4 * q) % 16)]; return { k, flow, tx, ty, nx: tx + v[0], ny: ty + v[1] }; });
}

// redes de fluidos: tuberías, tuberías subterráneas y conexiones de las máquinas (datos del juego)
function fluidNets(ents) {
  const occ = occMap(ents), parent = new Map();
  const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const node = a => { if (!parent.has(a)) parent.set(a, a); return a; };
  const join = (a, b) => { const ra = find(node(a)), rb = find(node(b)); if (ra !== rb) parent.set(ra, rb); };
  const portAt = new Map();   // casilla vecina → puertos que conectan hacia ella
  for (const e of ents) for (const p of ports(e)) { const id = e.id + ':' + p.k; node(id); const k = K(p.nx, p.ny); if (!portAt.has(k)) portAt.set(k, []); portAt.get(k).push([e, p, id]); }
  const face = e => card(e.dir);
  for (const e of ents) {
    const d = def(e.name); if (d.kind !== 'pipe' && d.kind !== 'ptg') continue;
    const tx = Math.floor(e.x), ty = Math.floor(e.y), me = 'p' + K(tx, ty); node(me);
    const sides = d.kind === 'pipe' ? [0, 1, 2, 3] : [face(e)];
    for (const k of sides) {
      const nx = tx + DV[k][0], ny = ty + DV[k][1], o = occ.get(K(nx, ny));
      if (o && def(o.name).kind === 'pipe') join(me, 'p' + K(nx, ny));
      if (o && def(o.name).kind === 'ptg' && face(o) === (k + 2) % 4) join(me, 'p' + K(nx, ny));
      for (const [, p, id] of portAt.get(K(tx, ty)) || []) if (p.tx === nx && p.ty === ny) join(me, id);
    }
    if (d.kind === 'ptg') { const v = DV[face(e)]; for (let s = 1; s <= 10; s++) { const o = occ.get(K(tx - v[0] * s, ty - v[1] * s)); if (o && def(o.name).kind === 'ptg' && face(o) === (face(e) + 2) % 4) { join(me, 'p' + K(tx - v[0] * s, ty - v[1] * s)); break; } } }
  }
  // máquinas pegadas por sus conexiones (turbinas en cadena) y cajas de paso (turbina, bomba)
  for (const e of ents) for (const p of ports(e)) for (const [o, q, id] of portAt.get(K(p.tx, p.ty)) || []) if (o !== e && q.tx === p.nx && q.ty === p.ny) join(e.id + ':' + p.k, id);
  for (const e of ents) if (e.name === 'steam-turbine' || e.name === 'pump') { const ps = ports(e); for (const p of ps) join(e.id + ':0', e.id + ':' + p.k); }
  return { find, node };
}
function portFluids(e) {
  if (e.name === 'steam-turbine') return ports(e).map(p => ({ p, f: 'steam', role: 'in' }));
  if (e.name === 'offshore-pump') return ports(e).map(p => ({ p, f: 'lava', role: 'out' }));
  const rf = RECIPE_FLUIDS[e.extra && e.extra.recipe]; if (!rf) return [];
  const ps = ports(e), ins = ps.filter(p => p.flow === 0), outs = ps.filter(p => p.flow === 1), r = [];
  rf.in.forEach((f, i) => ins[i] && r.push({ p: ins[i], f, role: 'in' })); rf.out.forEach((f, i) => outs[i] && r.push({ p: outs[i], f, role: 'out' }));
  return r;
}
const ents = pl => pl.p.ents.map(e => Object.assign({ id: e.num }, e));

describe('pack «Megabase Vulcano»', () => {
  it('es un libro con todos los bloques y sobrevive al string del juego', async () => {
    expect(PRESETS[0].book().blueprint_book.label).toMatch(/Vulcano/);
    expect(plans.length).toBe(11);
    const obj = vulcanusBook();
    expect(await BP.decode(BP.encodeSync(obj))).toEqual(obj);
    for (const pl of plans) { expect(pl.p.ents.length).toBeGreaterThan(5); expect(pl.bp.description.length).toBeGreaterThan(40); }
  });

  it('los bloques usan la cuadrícula absoluta de 50×50 y no se salen de ella', () => {
    for (const pl of plans.filter(isBlock)) {
      expect(BP.getSnap(pl.p.meta.extraBp), pl.label).toMatchObject({ w: BLOCK, h: BLOCK, abs: true, ox: 0, oy: 0 });
      for (const e of pl.p.ents) for (const [x, y] of tilesOf(e)) { expect(x >= 0 && x < BLOCK && y >= 0 && y < BLOCK, `${pl.label}: ${e.name} en ${x},${y}`).toBe(true); }
    }
    expect(plans.filter(isBlock).length).toBe(10);
  });

  it('nada se solapa', () => {
    for (const pl of plans) { const seen = new Map(); for (const e of pl.p.ents) for (const [x, y] of tilesOf(e)) { const k = K(x, y); expect(seen.has(k), `${pl.label}: ${e.name} choca con ${seen.get(k)} en ${k}`).toBe(false); seen.set(k, e.name); } }
  });

  it('cada máquina tiene una receta que puede fabricar y módulos válidos', () => {
    for (const pl of plans) for (const e of pl.p.ents) {
      const r = e.extra && e.extra.recipe; if (r) expect(BP.canCraft(e.name, r), `${pl.label}: ${e.name} → ${r}`).toBe(true);
      if (def(e.name).recipe && e.name !== 'rocket-silo') expect(r, `${pl.label}: ${e.name} sin receta`).toBeTruthy();
      for (const it of (e.extra && e.extra.items) || []) expect(['productivity-module-3', 'speed-module-3']).toContain(it.id.name);
    }
  });

  it('todo lo eléctrico queda dentro del área de una subestación y las subestaciones enlazan con el bloque vecino', () => {
    const passive = new Set(['pipe', 'ptg', 'chest', 'pole']);
    for (const pl of plans.filter(isBlock)) {
      const subs = pl.p.ents.filter(e => e.name === 'substation');
      expect(subs.length).toBe(9);
      for (const e of pl.p.ents) {
        if (passive.has(def(e.name).kind)) continue;
        const [w, h] = sz(def(e.name), e.dir);
        const ok = subs.some(s => Math.abs(s.x - e.x) < 9 + w / 2 && Math.abs(s.y - e.y) < 9 + h / 2);
        expect(ok, `${pl.label}: ${e.name} en ${e.x},${e.y} sin corriente`).toBe(true);
      }
      const xs = [...new Set(subs.map(s => s.x))].sort((a, b) => a - b);
      expect(xs[0] + BLOCK - xs[xs.length - 1]).toBeLessThanOrEqual(18);   // alcance del cable de la subestación
    }
  });

  it('cada insertador coge de algo y deja en algo, y uno de los dos es un cofre', () => {
    for (const pl of plans) {
      const occ = occMap(pl.p.ents);
      for (const e of pl.p.ents) {
        if (def(e.name).kind !== 'ins') continue;
        const v = DV[card(e.dir)], tx = Math.floor(e.x), ty = Math.floor(e.y);
        const from = occ.get(K(tx + v[0], ty + v[1])), to = occ.get(K(tx - v[0], ty - v[1]));
        expect(from && to, `${pl.label}: insertador en ${e.x},${e.y}`).toBeTruthy();
        expect(['pipe', 'ptg', 'ins', 'pole'].includes(def(from.name).kind) || ['pipe', 'ptg', 'ins', 'pole'].includes(def(to.name).kind), `${pl.label}: insertador en ${e.x},${e.y}`).toBe(false);
        expect(def(from.name).kind === 'chest' || def(to.name).kind === 'chest', `${pl.label}: insertador en ${e.x},${e.y}`).toBe(true);
        // los cofres de solicitud solo se vacían y los de suministro solo se llenan
        expect(to.name === 'requester-chest' || from.name === 'passive-provider-chest', `${pl.label}: insertador al revés en ${e.x},${e.y}`).toBe(false);
      }
    }
  });

  it('las perforadoras dejan el mineral en un cofre', () => {
    for (const pl of plans) {
      const occ = occMap(pl.p.ents);
      for (const e of pl.p.ents.filter(e => e.name === 'big-mining-drill')) {
        const v = DV[card(e.dir)], o = occ.get(K(Math.floor(e.x + v[0] * 2.85), Math.floor(e.y + v[1] * 2.85)));
        expect(o && def(o.name).kind, `${pl.label}: perforadora en ${e.x},${e.y}`).toBe('chest');
      }
    }
  });

  it('las tuberías no mezclan fluidos y cada entrada de fluido recibe el suyo', () => {
    for (const pl of plans) {
      const E = ents(pl), net = fluidNets(E), fl = new Map(), src = new Map();
      const add = (m, k, f) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(f); };
      for (const e of E) for (const { p, f, role } of portFluids(e)) { const r = net.find(net.node(e.id + ':' + p.k)); add(fl, r, f); if (role === 'out') add(src, r, f); }
      if (isBlock(pl)) for (const e of E) {
        const k = def(e.name).kind; if (k !== 'pipe' && k !== 'ptg') continue;
        const x = Math.floor(e.x), y = Math.floor(e.y);
        if (x === 0 || x === BLOCK - 1) { const f = y === BUS.lava ? 'lava' : y === BUS.acid ? 'sulfuric-acid' : null; expect(f, `${pl.label}: tubería en el borde, fila ${y}`).toBeTruthy(); const r = net.find(net.node('p' + K(x, y))); add(fl, r, f); add(src, r, f); }
        expect(y > 0 && y < BLOCK - 1, `${pl.label}: tubería en el borde superior o inferior`).toBe(true);
      }
      for (const [r, s] of fl) expect([...s], `${pl.label}: red con varios fluidos`).toHaveLength(1);
      for (const e of E) for (const { p, f, role } of portFluids(e)) {
        const r = net.find(net.node(e.id + ':' + p.k));
        if (role === 'in') expect(src.get(r) && src.get(r).has(f), `${pl.label}: ${e.name} en ${e.x},${e.y} no recibe ${f}`).toBe(true);
        else if (e.name !== 'offshore-pump') expect(fl.get(r).size === 1 && [...fl.get(r)][0] === f && E.some(o => o !== e && portFluids(o).some(q => q.role === 'in' && q.f === f && net.find(net.node(o.id + ':' + q.p.k)) === r)), `${pl.label}: la salida de ${e.name} en ${e.x},${e.y} no va a ningún sitio`).toBe(true);
      }
    }
  });

  it('las troncales enlazan con el bloque vecino por los dos lados', () => {
    for (const pl of plans.filter(isBlock)) {
      const E = ents(pl), net = fluidNets(E);
      for (const y of [BUS.lava, BUS.acid]) {
        const a = net.find(net.node('p' + K(0, y))), b = net.find(net.node('p' + K(BLOCK - 1, y)));
        expect(a, `${pl.label}: troncal de la fila ${y}`).toBe(b);
        const L = E.find(e => Math.floor(e.x) === 0 && Math.floor(e.y) === y), R = E.find(e => Math.floor(e.x) === BLOCK - 1 && Math.floor(e.y) === y);
        expect(L && (L.name === 'pipe' || card(L.dir) === 3), `${pl.label}: el oeste de la fila ${y}`).toBeTruthy();
        expect(R && (R.name === 'pipe' || card(R.dir) === 1), `${pl.label}: el este de la fila ${y}`).toBeTruthy();
      }
    }
  });
});
