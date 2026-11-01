import { describe, it, expect } from 'vitest';
import { BP } from '../src/core/blueprint.js';
import { BUILDINGS, MACHINE_CATS, RECIPE_LIST } from '../src/core/gamedata.js';

// Colocables del juego que no son edificios de un plano: robots, plantas, entidades de guion y el centro
// de la plataforma espacial (no se puede poner en un plano).
const NOT_BUILDINGS = new Set(['logistic-robot', 'construction-robot', 'tree-plant', 'yumako-tree', 'jellystem', 'simple-entity-with-force', 'simple-entity-with-owner', 'space-platform-hub']);

describe('catálogo frente a los datos del juego', () => {
  it('están todos los edificios de la Factoriopedia, y también los ocultos del modo editor', () => {
    const missing = Object.keys(BUILDINGS).filter(n => !NOT_BUILDINGS.has(n) && !(BP.DEFS[n] && (BP.DEFS[n].cat || BP.DEFS[n].kind === 'rail')));
    expect(missing).toEqual([]);
  });

  it('cada edificio tiene el tamaño del juego', () => {
    const wrong = Object.entries(BUILDINGS).filter(([n, [size]]) => size && BP.DEFS[n] && BP.DEFS[n].kind !== 'rail' && (BP.DEFS[n].w !== size[0] || BP.DEFS[n].h !== size[1]))
      .map(([n, [size]]) => `${n}: ${BP.DEFS[n].w}×${BP.DEFS[n].h}, en el juego ${size.join('×')}`);
    expect(wrong).toEqual([]);
  });

  it('marca como Space Age lo que es de Space Age', () => {
    const wrong = Object.entries(BUILDINGS).filter(([n, [, , sa]]) => BP.DEFS[n] && BP.DEFS[n].cat && !!BP.DEFS[n].sa !== !!sa).map(([n]) => n);
    expect(wrong).toEqual([]);
  });
});

describe('recetas por máquina', () => {
  it('todas las máquinas con receta del juego aceptan receta en el editor', () => {
    for (const n of Object.keys(MACHINE_CATS)) expect(BP.DEFS[n].recipe).toBe(1);
  });

  it('cada máquina ofrece solo lo que puede fabricar', () => {
    const names = m => BP.recipesFor(m).map(r => r.name);
    expect(names('assembling-machine-1')).toContain('iron-gear-wheel');
    expect(names('assembling-machine-1')).not.toContain('sulfuric-acid');
    expect(names('assembling-machine-2')).toContain('water-barrel');
    expect(names('chemical-plant')).toContain('sulfuric-acid');
    expect(names('oil-refinery')).toEqual(expect.arrayContaining(['basic-oil-processing', 'advanced-oil-processing', 'coal-liquefaction']));
    expect(names('centrifuge')).toContain('kovarex-enrichment-process');
    expect(names('rocket-silo')).toEqual(['rocket-part']);
    expect(names('foundry')).toEqual(expect.arrayContaining(['casting-iron', 'transport-belt']));
    expect(names('electromagnetic-plant')).toContain('electronic-circuit');
    expect(BP.recipesFor('stone-furnace')).toBeNull();   // los hornos eligen la receta solos
  });

  it('valida recetas y deja pasar las desconocidas (mods)', () => {
    expect(BP.canCraft('assembling-machine-3', 'processing-unit')).toBe(true);
    expect(BP.canCraft('assembling-machine-3', 'casting-iron')).toBe(false);
    expect(BP.canCraft('assembling-machine-3', 'receta-de-un-mod')).toBeNull();
  });

  it('todas las recetas tienen nombre en español', () => {
    const raw = RECIPE_LIST.filter(([n]) => BP.recipeName(n) === n.replace(/-/g, ' ')).map(r => r[0]);
    expect(raw).toEqual([]);
    expect(BP.recipeName('empty-crude-oil-barrel')).toBe('Vaciar barril de petróleo crudo');
    expect(BP.recipeName('speed-module-3')).toBe('Módulo de velocidad 3');
  });

  it('los vehículos se exportan con orientación', () => {
    const out = BP.buildBlueprint({ ents: [{ id: 1, name: 'tank', x: 1, y: 1.5, dir: 4, extra: {} }], wires: [], tiles: [], meta: {}, target: 2 }).blueprint;
    expect(out.entities[0]).toMatchObject({ name: 'tank', orientation: 0.25 });
    expect(out.entities[0].direction).toBeUndefined();
  });
});
