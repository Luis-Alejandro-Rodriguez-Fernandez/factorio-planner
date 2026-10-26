import { describe, it, expect } from 'vitest';
import { BP } from '../src/core/blueprint.js';

// Plano de Factorio 1.1 con lo que más cambia entre versiones: combinadores con cables, postes,
// insertador con filtro, máquina con módulos, divisor con filtro y cofre logístico.
const bp11 = {
  blueprint: {
    item: 'blueprint', label: 'Prueba', version: 281479278886912,
    icons: [{ signal: { type: 'item', name: 'inserter' }, index: 1 }],
    entities: [
      { entity_number: 1, name: 'arithmetic-combinator', position: { x: 0.5, y: 1 }, direction: 2, connections: { 1: { red: [{ entity_id: 2 }] }, 2: { green: [{ entity_id: 2, circuit_id: 1 }] } } },
      { entity_number: 2, name: 'constant-combinator', position: { x: 2.5, y: 0.5 }, connections: { 1: { red: [{ entity_id: 1, circuit_id: 1 }], green: [{ entity_id: 1, circuit_id: 2 }] } } },
      { entity_number: 3, name: 'medium-electric-pole', position: { x: 4.5, y: 0.5 }, neighbours: [4] },
      { entity_number: 4, name: 'medium-electric-pole', position: { x: 10.5, y: 0.5 }, neighbours: [3] },
      { entity_number: 5, name: 'filter-inserter', position: { x: 5.5, y: 3.5 }, direction: 4, filters: [{ index: 1, name: 'iron-plate' }] },
      { entity_number: 6, name: 'assembling-machine-2', position: { x: 7.5, y: 5.5 }, recipe: 'iron-gear-wheel', items: { 'speed-module': 2 } },
      { entity_number: 7, name: 'splitter', position: { x: 1, y: 6.5 }, filter: 'copper-plate', output_priority: 'left' },
      { entity_number: 8, name: 'logistic-chest-requester', position: { x: 3.5, y: 8.5 } },
    ],
    tiles: [{ position: { x: 0, y: 0 }, name: 'concrete' }],
  },
};

const asEditor = parsed => parsed.ents.map(e => ({ id: e.num, ...e }));
const build = (parsed, target) => BP.buildBlueprint({ ents: asEditor(parsed), wires: parsed.wires, tiles: parsed.tiles, meta: parsed.meta, target }).blueprint;

describe('códec de strings', () => {
  it('codifica y decodifica sin perder nada', async () => {
    const s = BP.encodeSync(bp11);
    expect(s.startsWith('0eN')).toBe(true);
    expect(await BP.decode(s)).toEqual(bp11);
    expect(await BP.decode(await BP.encode(bp11))).toEqual(bp11);
  });

  it('acepta también el JSON sin comprimir', async () => {
    expect(await BP.decode(JSON.stringify(bp11))).toEqual(bp11);
  });

  it('explica los errores en lugar de fallar en silencio', async () => {
    await expect(BP.decode('')).rejects.toThrow('No hay nada que importar');
    await expect(BP.decode('hola')).rejects.toThrow('debería empezar por «0»');
    await expect(BP.decode('0eNqAAAA')).rejects.toThrow('descomprimir');
  });
});

describe('conversión entre 1.1 y 2.0', () => {
  const parsed = BP.parseBlueprint(bp11.blueprint);

  it('reconoce un plano de 1.1 y lee sus cables', () => {
    expect(parsed.meta.scheme).toBe(1);
    expect(parsed.wires).toEqual([[1, 1, 2, 1], [1, 4, 2, 2], [3, 5, 4, 5]]);
  });

  it('de 1.1 a 1.1 conserva nombres, direcciones, versión y conexiones de postes', () => {
    const out = build(parsed, 1);
    expect(out.version).toBe(bp11.blueprint.version);
    expect(out.entities.map(e => [e.name, e.direction || 0])).toEqual(bp11.blueprint.entities.map(e => [e.name, e.direction || 0]));
    expect(out.entities[2].neighbours).toEqual([4]);
  });

  it('de 1.1 a 2.0 traduce nombres, direcciones, módulos, filtros y cables', () => {
    const out = build(parsed, 2);
    const byN = n => out.entities.find(e => e.entity_number === n);
    expect(BP.verStr(out.version)).toBe('2.0.28');
    expect(byN(1).direction).toBe(4);
    expect(byN(5)).toMatchObject({ name: 'fast-inserter', use_filters: true, direction: 8 });
    expect(byN(8).name).toBe('requester-chest');
    expect(byN(6).items).toEqual([{ id: { name: 'speed-module' }, items: { in_inventory: [{ inventory: 4, stack: 0 }, { inventory: 4, stack: 1 }] } }]);
    expect(byN(7).filter).toEqual({ name: 'copper-plate' });
    expect(out.wires).toEqual([[1, 1, 2, 1], [1, 4, 2, 2], [3, 5, 4, 5]]);
  });

  it('de 2.0 a 1.1 vuelve a los nombres y formatos originales', () => {
    const back = build(BP.parseBlueprint(build(parsed, 2)), 1);
    expect(back.entities.map(e => e.name)).toEqual(bp11.blueprint.entities.map(e => e.name));
    expect(back.entities[5].items).toEqual({ 'speed-module': 2 });
    expect(back.entities[6].filter).toBe('copper-plate');
  });
});

describe('trenes', () => {
  it('el material rodante se exporta con orientation, no con direction', () => {
    const out = BP.buildBlueprint({ ents: [{ id: 1, name: 'locomotive', x: -8, y: -15, dir: 4, extra: {} }], wires: [], tiles: [], meta: {}, target: 2 }).blueprint;
    expect(out.entities[0]).toMatchObject({ name: 'locomotive', orientation: 0.25 });
    expect(out.entities[0].direction).toBeUndefined();
    expect(BP.parseBlueprint(out).ents[0].dir).toBe(4);
  });

  it('las rectas de 1.1 se leen como rectas de 2.0; sus diagonales y curvas pasan a vías de 1.1', () => {
    const p = BP.parseBlueprint({
      version: 281479278886912,
      entities: [
        { entity_number: 1, name: 'straight-rail', position: { x: 1, y: 1 }, direction: 2 },
        { entity_number: 2, name: 'straight-rail', position: { x: 3, y: 3 }, direction: 1 },
        { entity_number: 3, name: 'curved-rail', position: { x: 8, y: 8 }, direction: 0 },
      ],
    });
    expect(p.ents.map(e => [e.name, e.dir])).toEqual([['straight-rail', 4], ['legacy-straight-rail', 2], ['legacy-curved-rail', 0]]);
  });
});
