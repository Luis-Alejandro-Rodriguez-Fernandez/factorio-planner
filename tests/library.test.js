import { describe, it, expect } from 'vitest';
import { BP } from '../src/core/blueprint.js';

const plan = (label, ents, extra) => BP.buildBlueprint({ ents, wires: [], tiles: [], meta: Object.assign({ label }, extra ? { extraBp: extra } : {}), target: 2 });

describe('libros de planos', () => {
  const a = plan('Hornos', [{ id: 1, name: 'steel-furnace', x: 1, y: 1, dir: 0, extra: {} }]);
  const b = plan('Balizas', [{ id: 1, name: 'beacon', x: 1.5, y: 1.5, dir: 0, extra: {} }]);

  it('reúne planos y subcarpetas con índices consecutivos', () => {
    const sub = BP.buildBook('Fundición', [a], 2);
    const book = BP.buildBook('Mis planos', [sub, b], 2).blueprint_book;
    expect(book).toMatchObject({ item: 'blueprint-book', label: 'Mis planos', active_index: 0 });
    expect(BP.verStr(book.version)).toBe('2.0.28');
    expect(book.blueprints.map(c => c.index)).toEqual([0, 1]);
    expect(book.blueprints[0].blueprint_book.blueprints[0].blueprint.label).toBe('Hornos');
    expect(BP.flattenBook(book).map(x => x.label)).toEqual(['Fundición / Hornos', 'Balizas']);
  });

  it('el libro sobrevive al string del juego', async () => {
    const obj = BP.buildBook('Mis planos', [a, b], 2);
    expect(await BP.decode(BP.encodeSync(obj))).toEqual(obj);
  });

  it('convierte a 1.1 los planos guardados para 2.0 al exportar el libro para 1.1', () => {
    const c = plan('Pilas', [{ id: 1, name: 'bulk-inserter', x: .5, y: .5, dir: 4, extra: {} }]);
    const book = BP.buildBook('Viejo', [c], 1).blueprint_book;
    expect(BP.verStr(book.version)).toBe('1.1.110');
    expect(book.blueprints[0].blueprint.entities[0]).toMatchObject({ name: 'stack-inserter', direction: 2 });
    expect(BP.convertBlueprint(c, 2)).toBe(c);
  });
});

describe('cuadrícula de ajuste', () => {
  it('escribe y lee snap-to-grid, la cuadrícula absoluta y el desfase', () => {
    const x = BP.setSnap({ foo: 1 }, { w: 32, h: 32, abs: true, ox: -5, oy: 64 });
    expect(x).toEqual({ foo: 1, 'snap-to-grid': { x: 32, y: 32 }, 'absolute-snapping': true, 'position-relative-to-grid': { x: 27, y: 0 } });
    expect(BP.getSnap(x)).toEqual({ w: 32, h: 32, abs: true, ox: 27, oy: 0 });
    expect(BP.setSnap(x, null)).toEqual({ foo: 1 });
    expect(BP.getSnap({})).toBeNull();
  });

  it('se conserva al importar y exportar un plano', () => {
    const out = plan('Bloque', [{ id: 1, name: 'roboport', x: 2, y: 2, dir: 0, extra: {} }], BP.setSnap({}, { w: 50, h: 50, abs: true })).blueprint;
    expect(out['snap-to-grid']).toEqual({ x: 50, y: 50 });
    expect(out['absolute-snapping']).toBe(true);
    expect(BP.getSnap(BP.parseBlueprint(out).meta.extraBp)).toMatchObject({ w: 50, h: 50, abs: true });
  });
});

describe('catálogo', () => {
  it('todos los edificios de la paleta tienen categoría válida y tamaño', () => {
    const cats = new Set(BP.CATS.map(c => c[0]));
    const pal = Object.values(BP.DEFS).filter(d => d.cat);
    expect(pal.length).toBeGreaterThan(115);
    for (const d of pal) { expect(cats.has(d.cat)).toBe(true); expect(d.w * d.h).toBeGreaterThan(0); }
    for (const n of ['elevated-straight-rail', 'rail-ramp', 'rail-support', 'artillery-wagon', 'turbo-loader', 'infinity-chest']) expect(BP.DEFS[n].cat).toBeTruthy();
  });
});
