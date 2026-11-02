import { describe, it, expect } from 'vitest';
import { plan, defaultRecipe, defaultMachine, producers, itemName, recipeLabel, products, recipe, RAW } from '../src/core/planner.js';

const row = (p, rn) => p.rows.find(r => r.recipe === rn);
const raw = (p, it) => (p.raw.find(r => r.item === it) || {}).rate || 0;
const close = (a, b) => expect(a).toBeCloseTo(b, 6);

describe('datos de recetas del juego', () => {
  it('tienen tiempos, ingredientes y productos de verdad', () => {
    expect(recipe('electronic-circuit')).toMatchObject({ time: 0.5, ins: [['iron-plate', 1, 0], ['copper-cable', 3, 0]], prod: true });
    expect(recipe('copper-cable').outs[0]).toEqual(['copper-cable', 2, 0, 0]);
    expect(recipe('rocket-part').ins.map(i => i[0])).toEqual(['processing-unit', 'low-density-structure', 'rocket-fuel']);   // cambiado por Space Age
    expect(recipe('speed-module-3').ins.map(i => i[0])).toContain('tungsten-carbide');                                      // añadido por Space Age
    expect(recipe('kovarex-enrichment-process').outs.find(o => o[0] === 'uranium-235')[3]).toBe(40);                        // catalizador: no cuenta para productividad
    expect(recipe('uranium-processing').outs.map(o => o[1])).toEqual([0.007, 0.993]);                                        // probabilidades
  });
  it('eligen recetas y máquinas razonables por defecto y nombran en español', () => {
    expect(defaultRecipe('iron-plate')).toBe('iron-plate');
    expect(defaultRecipe('petroleum-gas')).toBe('advanced-oil-processing');
    expect(defaultRecipe('iron-ore')).toBeNull();
    expect(RAW.has('stone')).toBe(true);
    expect(producers('iron-plate')).toEqual(expect.arrayContaining(['iron-plate', 'casting-iron']));
    expect(defaultMachine('electronic-circuit', false)).toBe('assembling-machine-3');
    expect(defaultMachine('electronic-circuit', true)).toBe('assembling-machine-3');   // la del juego base, aunque haya planta electromagnética
    expect(defaultMachine('casting-iron', true)).toBe('foundry');
    expect(defaultMachine('iron-plate')).toBe('electric-furnace');
    expect(itemName('electronic-circuit')).toMatch(/Circuito electrónico/);
    expect(itemName('iron-plate')).toBe('Placa de hierro');
    expect(recipeLabel('iron-plate')).toBe('Placa de hierro');
    expect(recipeLabel('casting-iron')).toBe('Moldeo de placa de hierro');
    expect(products(true).filter(n => itemName(n).toLowerCase() === n.replace(/-/g, ' ')).length).toBeLessThan(6);   // casi todo traducido
    expect(products(false)).toContain('electronic-circuit');
    expect(products(false)).not.toContain('tungsten-carbide');
  });
});

describe('cálculo', () => {
  it('10 circuitos verdes por segundo en el juego base: 4 ensambladoras de circuito, 6 de cable y los hornos', () => {
    const p = plan([['electronic-circuit', 10]], { spaceAge: false });
    close(row(p, 'electronic-circuit').machines, 4);          // 10/s × 0,5 s / velocidad 1,25
    close(row(p, 'copper-cable').machines, 6);                 // 30 cables/s = 15 recetas/s × 0,5 s / 1,25
    close(row(p, 'iron-plate').machines, 16);                  // 10/s × 3,2 s / velocidad 2
    close(row(p, 'copper-plate').machines, 24);                // 15/s × 3,2 / 2
    close(raw(p, 'iron-ore'), 10); close(raw(p, 'copper-ore'), 15);
    close(p.raw.find(r => r.item === 'iron-ore').extractors.count, 20);   // 0,5/s por perforadora eléctrica
    close(p.power, (4 + 6) * 0.375 + 40 * 0.18);              // MW
  });

  it('los módulos de productividad reducen lo que entra y la velocidad', () => {
    const p = plan([['electronic-circuit', 10]], { spaceAge: false, modules: 'prod3' });
    const r = row(p, 'electronic-circuit');
    close(r.prod, 0.4); close(r.speed, 1.25 * 0.4);
    close(r.crafts, 10 / 1.4); close(r.machines, (10 / 1.4) * 0.5 / 0.5);
  });

  it('las balizas aceleran (2 módulos de velocidad 3, eficacia 1,5 y perfil 1/√n)', () => {
    const p = plan([['iron-gear-wheel', 10]], { spaceAge: false, beacons: 4 });
    close(row(p, 'iron-gear-wheel').speed, 1.25 * (1 + 1.5 * 2));
  });

  it('aprovecha los subproductos: el petróleo ligero y el pesado del refinado avanzado', () => {
    const p = plan([['petroleum-gas', 55], ['light-oil', 45], ['heavy-oil', 25]], { spaceAge: false });
    close(row(p, 'advanced-oil-processing').crafts, 1);        // una receta da justo lo pedido
    expect(p.rows.length).toBe(1);
    close(raw(p, 'crude-oil'), 100); close(raw(p, 'water'), 50);
  });

  it('respeta la receta elegida y lo que se trae de fuera', () => {
    const p = plan([['iron-plate', 20]], { recipes: { 'iron-plate': 'casting-iron', 'molten-iron': 'molten-iron-from-lava' } });
    expect(row(p, 'casting-iron').machine).toBe('foundry');
    expect(row(p, 'molten-iron-from-lava')).toBeTruthy();
    expect(raw(p, 'lava')).toBeGreaterThan(0);
    expect(p.surplus.find(s => s.item === 'stone')).toBeTruthy();   // la lava deja piedra
    const q = plan([['electronic-circuit', 10]], { spaceAge: false, raw: ['copper-cable'] });
    close(raw(q, 'copper-cable'), 30); expect(row(q, 'copper-cable')).toBeUndefined();
  });

  it('no se queda colgado con ciclos (Kovarex) y calcula ciencias complejas', () => {
    const k = plan([['uranium-235', 1]], { recipes: { 'uranium-235': 'kovarex-enrichment-process' } });
    expect(k.rows.length).toBeGreaterThan(0);
    const s = plan([['utility-science-pack', 1], ['production-science-pack', 1], ['chemical-science-pack', 1]], { spaceAge: false });
    expect(s.rows.length).toBeGreaterThan(15);
    expect(s.raw.map(r => r.item)).toEqual(expect.arrayContaining(['iron-ore', 'copper-ore', 'coal', 'crude-oil', 'water']));
    for (const r of s.rows) { expect(Number.isFinite(r.machines)).toBe(true); expect(r.machines).toBeGreaterThan(0); }
  });
});
