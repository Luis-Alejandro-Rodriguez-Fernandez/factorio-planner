/**
 * Geometría de las vías de Factorio 2.0.
 *
 * Deducida de los planos que el propio juego trae en la Factoriopedia y en «Consejos y trucos»:
 * con este modelo, todos los extremos de curvas A, curvas B y medias diagonales de esos planos
 * empalman con otra pieza. tests/rails.test.js comprueba las relaciones observadas.
 *
 * Convenciones: x crece hacia el este e y hacia el sur. Los rumbos van de 0 a 15
 * (0 = norte, 4 = este, 8 = sur, 12 = oeste), igual que las direcciones de entidad de Factorio 2.0.
 */
import { BP } from './blueprint.js';

const { def } = BP;
const DV4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Extremos locales [x, y, rumbo hacia fuera] de cada pieza base. Una pieza con dirección d usa la base
// d % 4 girada floor(d / 4) cuartos de vuelta en sentido horario. S = recta, H = media diagonal, A y B = curvas.
export const RB = {
  S0: [[0, -1, 0], [0, 1, 8]], S2: [[1, -1, 2], [-1, 1, 10]],
  H0: [[-1, -2, 15], [1, 2, 7]], H2: [[1, -2, 1], [-1, 2, 9]],
  A0: [[0, 2, 8], [-1, -3, 15]], A2: [[0, 2, 8], [1, -3, 1]],
  B0: [[1, 2, 7], [-2, -2, 14]], B2: [[-1, 2, 9], [2, -2, 2]],
};

/** Vector unitario de cada rumbo. */
export const HV = Array.from({ length: 16 }, (_, i) => [Math.sin(i * Math.PI / 8), -Math.cos(i * Math.PI / 8)]);

/** Gira (x, y) q cuartos de vuelta en sentido horario. */
export const rotQ = (x, y, q) => { for (let i = 0; i < ((q % 4) + 4) % 4; i++) [x, y] = [-y, x]; return [x, y]; };

/** Las rectas y las medias diagonales son simétricas: solo usan las direcciones 0, 2, 4 y 6. */
export const normDir = (name, d) => { const t = def(name).rt; d = (((d | 0) % 16) + 16) % 16; return t === 'S' || t === 'H' ? d % 8 : d; };

export const railKey = (name, x, y, d) => name + '|' + x + '|' + y + '|' + normDir(name, d);

/** Extremos absolutos [x, y, rumbo] de una pieza de vía de 2.0, o null si no lo es. */
export function railEndsOf(name, x, y, dir) {
  const t = def(name).rt; if (!t) return null;
  const d = normDir(name, dir), base = RB[t + (d % 4 === 0 ? 0 : 2)], q = d >> 2; if (!base) return null;
  return base.map(([bx, by, h]) => { const [rx, ry] = rotQ(bx, by, q); return [x + rx, y + ry, (h + 4 * q) % 16]; });
}

// Plantillas de curva tomadas de combinaciones que aparecen en los planos del juego:
// piezas [nombre, x, y, dir] relativas a la entrada (un extremo de vía vertical, en (impar, par))
// y sus dos extremos libres [x, y, rumbo].
export const TMPL = {
  c90: {
    v: [[['curved-rail-a', 0, -2, 0], ['curved-rail-b', -2, -7, 0], ['curved-rail-b', -6, -11, 6], ['curved-rail-a', -11, -13, 6]]],
    e: [[[0, 0, 8], [-13, -13, 12]]],
  },
  c45: {
    v: [[['curved-rail-a', 0, -2, 0], ['curved-rail-b', -2, -7, 0]], [['curved-rail-a', 0, -2, 2], ['curved-rail-b', 2, -7, 2]]],
    e: [[[0, 0, 8], [-4, -9, 14]], [[0, 0, 8], [4, -9, 2]]],
  },
};

/** Número de variantes de una plantilla: 4 giros por cada versión (normal y reflejada). */
export const tmplVariants = k => TMPL[k].v.length * 4;

/** Variante v → [versión, cuartos de vuelta]. */
export function tmplMQ(k, v) { const nm = TMPL[k].v.length; return [((v % nm) + nm) % nm, Math.floor(v / nm) % 4]; }

/** Piezas de la variante v con la entrada en (ex, ey). */
export function tmplPieces(k, v, ex, ey) {
  const [m, q] = tmplMQ(k, v);
  return TMPL[k].v[m].map(([name, x, y, d]) => { const [rx, ry] = rotQ(x, y, q); return { name, x: ex + rx, y: ey + ry, dir: normDir(name, d + 4 * q), extra: {} }; });
}

/** Extremos libres de la variante v, relativos a la entrada. */
export function tmplEnds(k, v) {
  const [m, q] = tmplMQ(k, v);
  return TMPL[k].e[m].map(([x, y, h]) => { const [rx, ry] = rotQ(x, y, q); return [rx, ry, (h + 4 * q) % 16]; });
}

/**
 * Huecos válidos para señales junto a un extremo de vía con rumbo h (regla observada en los planos del juego):
 * a 1,5 casillas del eje y a ±0,5 del extremo. A la derecha del rumbo la señal mira hacia atrás (h + 8)
 * y a la izquierda mira hacia delante (h); en diagonal, las casillas equivalentes.
 * Devuelve [x, y, dirección]. No cubre los extremos de media diagonal.
 */
export function slotsAtEnd(x, y, h) {
  const out = [];
  if (h % 4 === 0) {
    const [ux, uy] = DV4[h / 4], rx = -uy, ry = ux;
    for (const a of [-0.5, 0.5]) {
      out.push([x + a * ux + 1.5 * rx, y + a * uy + 1.5 * ry, (h + 8) % 16]);
      out.push([x + a * ux - 1.5 * rx, y + a * uy - 1.5 * ry, h]);
    }
  } else if (h % 4 === 2) {
    const q = (h - 2) / 4;
    for (const [ox, oy, right] of [[0.5, 1.5, 1], [1.5, 0.5, 1], [-0.5, -1.5, 0], [-1.5, -0.5, 0]]) {
      const [px, py] = rotQ(ox, oy, q);
      out.push([x + px, y + py, right ? (h + 8) % 16 : h]);
    }
  }
  return out;
}

// ---------- planificador de vías (A*), como el del juego ----------
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v) { const a = this.a; a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}
let RMOVES = null;
/** Movimientos posibles según el rumbo de marcha: qué pieza se pone, dónde queda su centro y en qué punto y rumbo se sale. */
export function railMoves() {
  if (RMOVES) return RMOVES;
  RMOVES = Array.from({ length: 16 }, () => []);
  for (const [name, dirs] of [['straight-rail', [0, 2, 4, 6]], ['half-diagonal-rail', [0, 2, 4, 6]], ['curved-rail-a', [0, 2, 4, 6, 8, 10, 12, 14]], ['curved-rail-b', [0, 2, 4, 6, 8, 10, 12, 14]]]) {
    for (const d of dirs) {
      const E = railEndsOf(name, 0, 0, d);
      for (const [a, b] of [[E[0], E[1]], [E[1], E[0]]]) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        RMOVES[(a[2] + 8) % 16].push({ name, d, cx: -a[0], cy: -a[1], ex: b[0] - a[0], ey: b[1] - a[1], h: b[2], cost: len + (name[0] === 'c' ? 1.5 : name[0] === 'h' ? 0.8 : 0) });
      }
    }
  }
  return RMOVES;
}
/** A*: starts = [[x, y, rumbo]]; goal = { x, y, h } o { x, y, hs: [rumbos] } exacto, o { x, y, r } (rumbo recto o diagonal a menos de r). Devuelve las piezas (con .end = [x, y, rumbo]) o null. */
export function planRails(starts, goal) {
  const M = railMoves(), key = (x, y, h) => x + ',' + y + ',' + h, gs = new Map(), prev = new Map(), open = new Heap(), hs = goal.hs || (goal.h != null ? [goal.h] : null);
  let x0 = goal.x, x1 = goal.x, y0 = goal.y, y1 = goal.y;
  for (const [x, y] of starts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 -= 20; x1 += 20; y0 -= 20; y1 += 20;
  const H = (x, y) => Math.hypot(x - goal.x, y - goal.y);
  for (const [x, y, h] of starts) { const k = key(x, y, h); gs.set(k, 0); prev.set(k, null); open.push([H(x, y), 0, x, y, h]); }
  const t0 = performance.now(); let n = 0;
  while (open.size) {
    const [, g, x, y, h] = open.pop(), k = key(x, y, h);
    if (g > gs.get(k)) continue;
    if (g > 0 && (hs ? x === goal.x && y === goal.y && hs.includes(h) : h % 2 === 0 && H(x, y) <= goal.r)) {
      const out = []; for (let c = k; prev.get(c); c = prev.get(c)[0]) out.push(prev.get(c)[1]); out.reverse(); out.end = [x, y, h]; return out;
    }
    if (++n > 40000 || (n % 1024 === 0 && performance.now() - t0 > 40)) return null;
    for (const m of M[h]) {
      const nx = x + m.ex, ny = y + m.ey; if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const nk = key(nx, ny, m.h), ng = g + m.cost;
      if (ng < (gs.has(nk) ? gs.get(nk) : Infinity)) { gs.set(nk, ng); prev.set(nk, [k, { name: m.name, x: x + m.cx, y: y + m.cy, dir: m.d, extra: {} }]); open.push([ng + H(nx, ny), ng, nx, ny, m.h]); }
    }
  }
  return null;
}
