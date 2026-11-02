/**
 * Planificador de producción: a partir de lo que se quiere fabricar (p. ej. 10 circuitos electrónicos por segundo)
 * calcula qué recetas hacen falta, cuántas máquinas de cada una, qué materias primas entran, qué sobra y cuánta
 * electricidad se gasta. Sin DOM. Los datos de recetas y máquinas salen de factorio-data (gamedata.js).
 *
 * Cada producto usa una sola receta (la elegida o la de por defecto). Los subproductos de una receta se aprovechan
 * para lo que aún no se había calculado; lo que sobra se informa aparte.
 */
import { RECIPE_DATA, PLANNER_MACHINES, RESOURCES, DRILLS } from './gamedata.js';
import { BP } from './blueprint.js';

// ---------- nombres en español de lo que no tiene receta propia (o cuyo nombre de receta no sirve para el objeto) ----------
const ITEM_ES = {
  'iron-ore': 'Mineral de hierro', 'copper-ore': 'Mineral de cobre', coal: 'Carbón', stone: 'Piedra', 'uranium-ore': 'Mineral de uranio', 'tungsten-ore': 'Mineral de wolframio',
  calcite: 'Calcita', scrap: 'Chatarra', 'holmium-ore': 'Mineral de holmio', 'iron-plate': 'Placa de hierro', 'copper-plate': 'Placa de cobre', 'steel-plate': 'Placa de acero',
  'stone-brick': 'Ladrillo de piedra', water: 'Agua', 'crude-oil': 'Petróleo crudo', 'heavy-oil': 'Petróleo pesado', 'light-oil': 'Petróleo ligero', 'petroleum-gas': 'Gas de petróleo',
  steam: 'Vapor', lava: 'Lava', 'molten-iron': 'Hierro fundido', 'molten-copper': 'Cobre fundido', 'uranium-235': 'Uranio 235', 'uranium-238': 'Uranio 238', 'solid-fuel': 'Combustible sólido',
  wood: 'Madera', 'raw-fish': 'Pescado', ice: 'Hielo', ammonia: 'Amoníaco', 'ammoniacal-solution': 'Solución amoniacal', 'lithium-brine': 'Salmuera de litio', fluorine: 'Flúor',
  'lithium-plate': 'Placa de litio', 'fluoroketone-hot': 'Fluorocetona caliente', 'fluoroketone-cold': 'Fluorocetona fría', spoilage: 'Descomposición', yumako: 'Yumako', jellynut: 'Gelinuez',
  'yumako-mash': 'Puré de yumako', jelly: 'Gelatina', nutrients: 'Nutrientes', 'yumako-seed': 'Semilla de yumako', 'jellynut-seed': 'Semilla de gelinuez', 'metallic-asteroid-chunk': 'Trozo de asteroide metálico',
  'carbonic-asteroid-chunk': 'Trozo de asteroide carbónico', 'oxide-asteroid-chunk': 'Trozo de asteroide de óxido', 'promethium-asteroid-chunk': 'Trozo de asteroide de prometio', 'thruster-fuel': 'Combustible de propulsor',
  'thruster-oxidizer': 'Oxidante de propulsor', 'holmium-solution': 'Solución de holmio', 'empty-barrel': 'Barril vacío', 'plastic-bar': 'Plástico', 'tungsten-carbide': 'Carburo de wolframio',
  'tungsten-plate': 'Placa de wolframio', 'rocket-part': 'Parte de cohete', 'electrolyte': 'Electrolito', 'fusion-plasma': 'Plasma de fusión', 'pentapod-egg': 'Huevo de pentápodo', 'biter-egg': 'Huevo de mordedor',
};
const FLUIDS = new Set(Object.values(RECIPE_DATA).flatMap(r => [...r[1], ...r[2]].filter(x => x[2]).map(x => x[0])));
export function itemName(n) { return ITEM_ES[n] || BP.recipeName(n).replace(/^./, c => c.toUpperCase()); }
export const isFluid = n => FLUIDS.has(n);
/** Nombre de una receta; si no tiene uno propio, el de lo que fabrica. */
export function recipeLabel(n) {
  const l = BP.recipeName(n), r = RECIPE_DATA[n];
  if (l.toLowerCase() === n.replace(/-/g, ' ') && r && r[2].length === 1) return itemName(r[2][0][0]);
  return l.replace(/^./, c => c.toUpperCase());
}

// ---------- recetas, productores y materias primas ----------
const R = new Map(Object.entries(RECIPE_DATA).map(([n, [time, ins, outs, prod, cats, sa]]) => [n, { name: n, time, ins, outs, prod: !!prod, cats, sa: !!sa }]));
export const recipe = n => R.get(n);
const PRODUCERS = new Map();
for (const r of R.values()) {
  if (/-barrel$/.test(r.name) && r.name !== 'barrel') continue;   // llenar y vaciar barriles no cuenta como forma de producir
  for (const [it] of r.outs) { if (!PRODUCERS.has(it)) PRODUCERS.set(it, []); PRODUCERS.get(it).push(r.name); }
}
/** Recetas que producen un objeto. */
export const producers = it => PRODUCERS.get(it) || [];
/** Materias primas: se extraen o se bombean, aunque alguna receta también las dé (piedra de la lava, hierro de asteroides…). */
export const RAW = new Set(['water', 'lava', 'steam', 'ice', 'spoilage', 'wood', 'raw-fish', 'stone', 'calcite', 'scrap', 'holmium-ore', 'yumako', 'jellynut', 'biter-egg', 'pentapod-egg',
  ...Object.values(RESOURCES).flatMap(r => r[2]).filter(n => n !== 'sulfuric-acid'), 'metallic-asteroid-chunk', 'carbonic-asteroid-chunk', 'oxide-asteroid-chunk', 'promethium-asteroid-chunk']);
const DEFAULT_RECIPE = {
  'heavy-oil': 'advanced-oil-processing', 'light-oil': 'advanced-oil-processing', 'petroleum-gas': 'advanced-oil-processing', 'solid-fuel': 'solid-fuel-from-light-oil',
  'uranium-235': 'uranium-processing', 'uranium-238': 'uranium-processing', 'molten-iron': 'iron-ore-melting', 'molten-copper': 'copper-ore-melting', nutrients: 'nutrients-from-spoilage',
  'fluoroketone-hot': 'fluoroketone', 'fluoroketone-cold': 'fluoroketone-cooling',
};
/** Receta que se usa por defecto para un objeto (null si es materia prima). */
export function defaultRecipe(it, spaceAge = true) {
  if (RAW.has(it)) return null;
  const list = producers(it).filter(n => spaceAge || !R.get(n).sa); if (!list.length) return null;
  if (list.includes(it)) return it;
  if (DEFAULT_RECIPE[it] && list.includes(DEFAULT_RECIPE[it])) return DEFAULT_RECIPE[it];
  return [...list].sort((a, b) => R.get(a).outs.length - R.get(b).outs.length || a.localeCompare(b))[0];
}
/** Objetos que se pueden pedir: todo lo que fabrica alguna receta. */
export function products(spaceAge = true) {
  const s = new Set(); for (const r of R.values()) if (spaceAge || !r.sa) for (const [it] of r.outs) s.add(it);
  return [...s].sort((a, b) => itemName(a).localeCompare(itemName(b), 'es'));
}

// ---------- máquinas y módulos ----------
export const MACHINES = PLANNER_MACHINES;
export const MODULES = {
  none: { label: 'Sin módulos', speed: 0, prod: 0, energy: 0 },
  prod1: { label: 'Productividad 1', speed: -0.05, prod: 0.04, energy: 0.4 }, prod2: { label: 'Productividad 2', speed: -0.1, prod: 0.06, energy: 0.6 }, prod3: { label: 'Productividad 3', speed: -0.15, prod: 0.1, energy: 0.8 },
  speed1: { label: 'Velocidad 1', speed: 0.2, prod: 0, energy: 0.5 }, speed2: { label: 'Velocidad 2', speed: 0.3, prod: 0, energy: 0.6 }, speed3: { label: 'Velocidad 3', speed: 0.5, prod: 0, energy: 0.7 },
};
export const BELTS = { 15: 'Cinta amarilla', 30: 'Cinta roja', 45: 'Cinta azul', 60: 'Cinta turbo' };
/** Máquinas que pueden hacer una receta. */
export function machinesFor(rn, spaceAge = true) { const r = R.get(rn); return Object.keys(MACHINES).filter(m => (spaceAge || !MACHINES[m][5]) && MACHINES[m][4].some(c => r.cats.includes(c))); }
/** Máquina por defecto: la mejor del juego base que pueda hacerla (lo que se tiene en Nauvis); si solo la hace una de Space Age, esa. */
export function defaultMachine(rn, spaceAge = true) {
  const best = m => MACHINES[m][0] * (1 + (R.get(rn).prod ? MACHINES[m][2] : 0)), all = machinesFor(rn, spaceAge), base = all.filter(m => !MACHINES[m][5]);
  return (base.length ? base : all).sort((a, b) => best(b) - best(a))[0] || null;
}

// ---------- cálculo ----------
/**
 * targets: [[objeto, unidades/s]]. opt: { spaceAge, recipes: {objeto: receta}, raw: [objetos que se traen de fuera], machines: {receta: máquina},
 * modules: clave de MODULES, beacons: balizas con 2 módulos de velocidad 3 que alcanzan cada máquina, drill: perforadora }.
 */
export function plan(targets, opt = {}) {
  const sa = opt.spaceAge !== false, raw = new Set(opt.raw || []), chosen = opt.recipes || {}, mod = MODULES[opt.modules] || MODULES.none, beacons = Math.max(0, opt.beacons | 0);
  const recipeOf = it => (raw.has(it) ? null : chosen[it] && R.get(chosen[it]) && producers(it).includes(chosen[it]) ? chosen[it] : defaultRecipe(it, sa));
  // orden: los consumidores antes que sus proveedores (orden topológico), cortando los ciclos
  const order = [], state = new Map(), cyc = new Set();
  const visit = it => {
    const st = state.get(it); if (st === 2) return; if (st === 1) { cyc.add(it); return; }
    state.set(it, 1); const rn = recipeOf(it);
    if (rn) for (const [ing] of R.get(rn).ins) visit(ing);
    state.set(it, 2); order.push(it);
  };
  for (const [it] of targets) visit(it);
  order.reverse();
  const demand = new Map(), surplus = new Map(), rows = new Map(), rawUse = new Map(), add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const [it, rate] of targets) add(demand, it, rate);
  for (const it of order) {
    let need = demand.get(it) || 0; if (need <= 1e-12) continue;
    const s = surplus.get(it) || 0; if (s > 0) { const u = Math.min(s, need); need -= u; surplus.set(it, s - u); }
    if (need <= 1e-12) continue;
    const rn = cyc.has(it) && !targets.some(t => t[0] === it) ? null : recipeOf(it);
    if (!rn) { add(rawUse, it, need); continue; }
    const r = R.get(rn), m = (opt.machines && opt.machines[rn] && machinesFor(rn, sa).includes(opt.machines[rn])) ? opt.machines[rn] : defaultMachine(rn, sa);
    if (!m) { add(rawUse, it, need); continue; }
    const [mSpeed, slots, baseProd, kw] = MACHINES[m];
    const useMod = slots > 0 && (mod.prod <= 0 || r.prod) ? mod : MODULES.none;   // la productividad solo entra en recetas que la admiten
    const bea = beacons ? Math.sqrt(beacons) * 1.5 * 2 : 0;   // eficacia 1,5, perfil 1/√n, 2 módulos de velocidad 3 por baliza
    const speed = mSpeed * Math.max(0.2, 1 + slots * useMod.speed + bea * 0.5);
    const prod = (r.prod ? baseProd : 0) + slots * useMod.prod;
    const outOf = ([, a, , ig]) => Math.min(a, ig) + Math.max(0, a - ig) * (1 + prod);
    const main = r.outs.find(o => o[0] === it), perCraft = outOf(main), crafts = need / perCraft;
    let row = rows.get(rn);
    if (!row) rows.set(rn, row = { recipe: rn, item: it, machine: m, crafts: 0, modules: useMod === MODULES.none ? 'none' : opt.modules, speed, prod, kw: kw * Math.max(0.2, 1 + slots * useMod.energy + bea * 0.7) });
    row.crafts += crafts;
    for (const o of r.outs) if (o[0] !== it) add(surplus, o[0], crafts * outOf(o));
    for (const [ing, a] of r.ins) add(demand, ing, crafts * a);
  }
  const list = [...rows.values()].map(row => {
    const r = R.get(row.recipe), outOf = ([, a, , ig]) => Math.min(a, ig) + Math.max(0, a - ig) * (1 + row.prod);
    return Object.assign(row, {
      machines: row.crafts * r.time / row.speed,
      outputs: r.outs.map(o => [o[0], row.crafts * outOf(o)]), inputs: r.ins.map(([n, a]) => [n, row.crafts * a]),
      power: row.kw * row.crafts * r.time / row.speed / 1000,
    });
  });
  const drill = DRILLS[opt.drill] ? opt.drill : 'electric-mining-drill';
  const rawList = [...rawUse].filter(([, v]) => v > 1e-9).map(([it, rate]) => {
    const res = Object.entries(RESOURCES).find(([, v]) => v[2].includes(it)), out = { item: it, rate };
    if (it === 'water' || it === 'lava') out.extractors = { name: 'offshore-pump', count: rate / 1200 };
    else if (res && res[1][1] !== 'basic-fluid') { const d = DRILLS[drill][1].includes(res[1][1]) ? drill : Object.keys(DRILLS).find(k => DRILLS[k][1].includes(res[1][1])); if (d) out.extractors = { name: d, count: rate / (DRILLS[d][0] / res[1][0]) }; }
    return out;
  }).sort((a, b) => b.rate - a.rate);
  return {
    targets, rows: list, raw: rawList, cycles: [...cyc],
    surplus: [...surplus].filter(([, v]) => v > 1e-6).map(([item, rate]) => ({ item, rate })),
    power: list.reduce((a, r) => a + r.power, 0),
  };
}
