import { describe, it, expect } from 'vitest';
import { railEndsOf, tmplPieces, tmplEnds, tmplVariants, slotsAtEnd, planRails } from '../src/core/rails.js';

const plain = a => a.map(v => v + 0); // convierte -0 en 0 para comparar
/** Extremos que no empalman con otra pieza (misma posición y rumbo opuesto), ordenados. */
function freeEnds(pieces) {
  const at = new Map();
  for (const p of pieces) {
    for (const [x, y, h] of railEndsOf(p.name, p.x, p.y, p.dir)) {
      const k = `${x},${y}`;
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(h);
    }
  }
  const free = [];
  for (const [k, hs] of at) for (const h of hs) if (!hs.includes((h + 8) % 16)) free.push(plain([...k.split(',').map(Number), h]));
  return free.sort();
}
const touches = (a, b) => a.some(([x, y, h]) => b.some(([x2, y2, h2]) => x === x2 && y === y2 && (h - h2 + 16) % 16 === 8));

describe('empalmes observados en los planos del juego', () => {
  it.each([
    ['curved-rail-a', 0, 'straight-rail', 0, 3, 0],
    ['curved-rail-a', 0, 'curved-rail-b', -2, -5, 0],
    ['curved-rail-a', 0, 'half-diagonal-rail', -2, -5, 0],
    ['curved-rail-a', 4, 'curved-rail-b', 5, -2, 4],
    ['curved-rail-b', 0, 'curved-rail-b', -4, -4, 6],
    ['curved-rail-b', 0, 'straight-rail', -3, -3, 6],
    ['curved-rail-b', 2, 'straight-rail', 3, -3, 2],
    ['half-diagonal-rail', 0, 'half-diagonal-rail', 2, 4, 0],
  ])('%s (dir %i) empalma con %s en (%i, %i), dir %i', (a, da, b, x, y, db) => {
    expect(touches(railEndsOf(a, 0, 0, da), railEndsOf(b, x, y, db))).toBe(true);
  });
});

describe('plantillas de curva', () => {
  for (const k of ['c90', 'c45']) {
    for (let v = 0; v < tmplVariants(k); v++) {
      it(`${k}, variante ${v + 1}: las piezas empalman entre sí y solo quedan libres los dos extremos declarados`, () => {
        expect(freeEnds(tmplPieces(k, v, 0, 0))).toEqual(tmplEnds(k, v).map(plain).sort());
      });
    }
  }

  it('una recta horizontal más una curva de 90° deja libres solo los dos finales', () => {
    const track = [];
    for (let x = -13; x <= -1; x += 2) track.push({ name: 'straight-rail', x, y: -15, dir: 4 });
    expect(freeEnds([...track, ...tmplPieces('c90', 0, 13, -2)])).toEqual([[-14, -15, 12], [13, -2, 8]].sort());
  });
});

describe('señales', () => {
  it('junto a una vía vertical: a la derecha del rumbo miran hacia atrás y a la izquierda hacia delante', () => {
    const slots = slotsAtEnd(1, 2, 8).map(s => plain(s).join(',')).sort();
    expect(slots).toEqual(['-0.5,1.5,0', '-0.5,2.5,0', '2.5,1.5,8', '2.5,2.5,8'].sort());
  });

  it('en diagonal caen en centros de casilla', () => {
    for (const [x, y] of slotsAtEnd(1, 1, 2)) {
      expect(Math.abs(x % 1)).toBe(0.5);
      expect(Math.abs(y % 1)).toBe(0.5);
    }
  });
});

describe('planificador de vías', () => {
  const recta = (xs, y, dir) => xs.map(x => (dir === 4 ? { name: 'straight-rail', x, y, dir } : { name: 'straight-rail', x: y, y: x, dir }));
  it('une el final de una vía con el de otra y solo quedan libres los extremos exteriores', () => {
    const a = recta([-19, -17, -15, -13, -11, -9, -7, -5], -15, 4), b = recta([5, 7, 9, 11], 13, 0);
    const plan = planRails([[-4, -15, 4]], { x: 13, y: 4, h: 8 });
    expect(plan).not.toBeNull();
    expect(freeEnds([...a, ...b, ...plan])).toEqual([[-20, -15, 12], [13, 12, 8]].sort());
  });
  it('si el destino está en línea recta, solo usa rectas', () => {
    const plan = planRails([[0, 1, 4]], { x: 12, y: 1, r: 1.5 });
    expect(plan.length).toBe(6);
    expect(plan.every(p => p.name === 'straight-rail')).toBe(true);
  });
});

describe('planificador: desvíos y empalmes', () => {
  const recta = xs => xs.map(x => ({ name: 'straight-rail', x, y: -15, dir: 4 }));
  it('llega a mitad de otra vía y empalma, aceptando los dos sentidos del punto', () => {
    const plan = planRails([[-17, 6, 0]], { x: -4, y: -15, hs: [12, 4] });
    expect(plan).not.toBeNull();
    expect(plan.end.slice(0, 2)).toEqual([-4, -15]);
    const piezas = [...recta([-7, -5, -3, -1, 1, 3, 5, 7, 9]), { name: 'straight-rail', x: -17, y: 7, dir: 0 }, ...plan];
    expect(freeEnds(piezas)).toEqual([[-8, -15, 12], [10, -15, 4], [-17, 8, 8]].sort());
  });
  it('sale de mitad de una vía (desvío) sin dejar extremos sueltos en el arranque', () => {
    const plan = planRails([[4, -15, 4]], { x: 16, y: -27, r: 1.5 });
    expect(plan).not.toBeNull();
    expect(freeEnds([...recta([-7, -5, -3, -1, 1, 3, 5, 7, 9]), ...plan])).toHaveLength(3);
  });
});
