/**
 * Plantillas de serie: libros de planos generados por código, sin DOM.
 *
 * «Megabase Vulcano» es un pack de bloques de 50×50 con cuadrícula absoluta, pensado para producir y
 * exportar a lo grande en Vulcano (Space Age). Todos los bloques comparten el mismo esqueleto:
 *  - un roboport en la esquina superior izquierda: su zona logística (50×50) cubre justo un bloque,
 *    así que al teselar los bloques las redes de robots se unen sin huecos;
 *  - nueve subestaciones en las casillas 7-8, 24-25 y 41-42 de cada eje: dan corriente a todo el bloque
 *    y se cablean solas con las del bloque vecino (quedan a 16 casillas);
 *  - dos tuberías troncales que cruzan el bloque de oeste a este: lava en la fila 24 y ácido sulfúrico
 *    en la fila 41. Los bloques que no las usan las pasan por debajo con tuberías subterráneas.
 *    Ninguna otra tubería toca el borde del bloque, así que los fluidos de bloques vecinos no se mezclan.
 *
 * Las cifras de las descripciones salen de las recetas del juego (factorio-data) con los módulos y
 * balizas de cada bloque, sin contar las investigaciones de productividad.
 */
import { BP } from './blueprint.js';

const { def, sz } = BP;
export const BLOCK = 50;
export const BUS = { lava: 24, acid: 41 };
export const POLE_AT = [8, 25, 42];                 // centros de las subestaciones (2×2) en cada eje
const POLE_T = [7, 8, 24, 25, 41, 42];              // casillas que ocupan
const DIR = { N: 0, E: 4, S: 8, W: 12 };
const VEC = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

// fluidos de cada receta, en el orden de las cajas de fluido de la máquina (entradas y salidas)
export const RECIPE_FLUIDS = {
  'molten-iron-from-lava': { in: ['lava'], out: ['molten-iron'] },
  'molten-copper-from-lava': { in: ['lava'], out: ['molten-copper'] },
  'casting-iron': { in: ['molten-iron'], out: [] },
  'casting-copper': { in: ['molten-copper'], out: [] },
  'casting-steel': { in: ['molten-iron'], out: [] },
  'tungsten-plate': { in: ['molten-iron'], out: [] },
  'metallurgic-science-pack': { in: ['molten-copper'], out: [] },
  'carbon': { in: ['sulfuric-acid'], out: [] },
  'tungsten-carbide': { in: ['sulfuric-acid'], out: [] },
  'acid-neutralisation': { in: ['sulfuric-acid'], out: ['steam'] },
  'rocket-part': { in: [], out: [] },
};

// ----- módulos: velocidad y productividad de las máquinas (valores de Factorio 2.0) -----
const SPEED = { foundry: 4, 'chemical-plant': 1, 'assembling-machine-3': 1.25, 'rocket-silo': 1, 'big-mining-drill': 2.5 };
const BASE_PROD = { foundry: 0.5 };
const MOD_INV = { 'big-mining-drill': 2 };          // inventario de módulos: 2 en perforadoras, 4 en máquinas
const SLOTS = { foundry: 4, 'chemical-plant': 3, 'assembling-machine-3': 4, 'rocket-silo': 4, 'big-mining-drill': 4, beacon: 2 };
function modules(machine, mod, n) {
  n = n == null ? SLOTS[machine] : n; const inv = MOD_INV[machine] || (machine === 'beacon' ? 1 : 4);
  return [{ id: { name: mod }, items: { in_inventory: Array.from({ length: n }, (_, i) => ({ inventory: inv, stack: i })) } }];
}
// velocidad efectiva y multiplicador de productividad. beacons: número de balizas que la alcanzan (2 velocidad 3 cada una)
export function rate(machine, mods, beacons) {
  const n = SLOTS[machine] || 0, p = mods === 'prod' ? n : 0, s = mods === 'speed' ? n : 0, b = beacons || 0;
  const bea = b ? b * (1 / Math.sqrt(b)) * 1.5 * 2 * 0.5 : 0;                       // perfil 1/√n, eficacia 1,5
  const speed = SPEED[machine] * Math.max(0.2, 1 - 0.15 * p + 0.5 * s + bea);
  return { speed, prod: 1 + (BASE_PROD[machine] || 0) + 0.1 * p };
}

// ----- constructor de planos -----
class Plan {
  constructor() { this.ents = []; this.id = 1; }
  // coloca por su esquina superior izquierda (tx, ty), con la dirección dada (N, E, S, W)
  put(name, tx, ty, d, extra) {
    const dir = typeof d === 'string' ? DIR[d] : (d | 0), [w, h] = sz(def(name), dir);
    const e = { id: this.id++, name, x: tx + w / 2, y: ty + h / 2, dir: def(name).rot === false ? 0 : dir, extra: extra || {} };
    this.ents.push(e); return e;
  }
  pipe(tx, ty) { return this.put('pipe', tx, ty, 0); }
  hpipe(x0, x1, y) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.pipe(x, y); }
  vpipe(x, y0, y1) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.pipe(x, y); }
  ptg(tx, ty, face) { return this.put('pipe-to-ground', tx, ty, face); }
  // insertador en (tx, ty) que coge de su lado «from» y deja en el opuesto
  ins(tx, ty, from, name) { return this.put(name || 'bulk-inserter', tx, ty, from); }
  chest(tx, ty, item, count) {
    if (!item) return this.put('passive-provider-chest', tx, ty, 0);
    return this.put('requester-chest', tx, ty, 0, { request_filters: { sections: [{ index: 1, filters: [{ index: 1, name: item, quality: 'normal', comparator: '=', count: count || 100 }] }] } });
  }
  machine(name, tx, ty, d, recipe, mods) {
    const extra = {}; if (recipe) extra.recipe = recipe;
    if (mods) extra.items = modules(name, mods === 'prod' ? 'productivity-module-3' : 'speed-module-3');
    return this.put(name, tx, ty, d, extra);
  }
  beacon(tx, ty) { return this.put('beacon', tx, ty, 0, { items: modules('beacon', 'speed-module-3') }); }
}

// ----- esqueleto común -----
function skeleton(p) {
  p.put('roboport', 0, 0, 0);
  for (const y of POLE_AT) for (const x of POLE_AT) p.put('substation', x - 1, y - 1, 0);
}
// troncal que solo pasa: pares de tuberías subterráneas que esquivan las subestaciones
const PASS = [[0, 9], [10, 19], [20, 29], [30, 39], [40, 49]];
function busPass(p, y, last) { for (const [a, b] of last || PASS) { p.ptg(a, y, 'W'); p.ptg(b, y, 'E'); } }
// troncal a la vista para conectar máquinas: tubería entera que salta las subestaciones por debajo
function busTap(p, y) {
  let x = 0;
  for (const [a, b] of [[6, 9], [23, 26], [40, 43]]) { p.hpipe(x, a - 1, y); p.ptg(a, y, 'W'); p.ptg(b, y, 'E'); x = b + 1; }
  p.hpipe(x, BLOCK - 1, y);
}
const grid = () => BP.setSnap({}, { w: BLOCK, h: BLOCK, abs: true, ox: 0, oy: 0 });
function bp(label, description, p, block) {
  const out = BP.buildBlueprint({ ents: p.ents, wires: [], tiles: [], meta: { label, description, extraBp: block === false ? {} : grid() }, target: 2 });
  return out;
}
const f1 = v => (Math.round(v * 10) / 10).toLocaleString('es');

// ----- bloques de fundición: lava → metal fundido (fila A) → colada (fila B) -----
// Fila A: fundiciones con lava de la troncal (fila 24) y calcita; sacan piedra. Fila B: coladas con módulos
// de productividad y una fila de balizas con módulos de velocidad. Huecos de 3 casillas entre máquinas
// con insertador, cofre e insertador.
const FX = [2, 10, 18, 26, 34, 42];
function foundryBlock(o) {
  const p = new Plan(); skeleton(p);
  const RA = rate('foundry', 'speed'), RB = rate('foundry', 'prod', 4);
  const bands = [
    { a: 19, ad: 'N', m: 18, b: 13, bd: 'N', bea: 10 },      // A mira al norte: entra la lava por el sur (fila 24)
    { a: 25, ad: 'S', m: 30, b: 31, bd: 'S', bea: 36 },      // banda inferior, en espejo
  ];
  for (const [k, B] of bands.entries()) {
    const aPos = FX.slice(0, o.nA[k]);
    for (const x of aPos) p.machine('foundry', x, B.a, B.ad, o.lava, 'speed');
    for (const x of FX) p.machine('foundry', x, B.b, B.bd, o.cast, 'prod');
    p.hpipe(3, 45, B.m);
    for (let x = 0; x < 48; x += 3) p.beacon(x, B.bea);
    // huecos entre fundiciones: fila A (calcita y piedra) y fila B (entradas y salida)
    for (const x of FX.slice(0, 5)) {
      const g = x + 5, L = aPos.includes(x), R = aPos.includes(x + 8);
      if (L || R) {
        p.chest(g + 1, B.a + 1, 'calcite', 50); p.chest(g + 1, B.a + 3, null);
        if (L) { p.ins(g, B.a + 1, 'E'); p.ins(g, B.a + 3, 'W'); }
        if (R) { p.ins(g + 2, B.a + 1, 'W'); p.ins(g + 2, B.a + 3, 'E'); }
      }
      const rows = [[B.b + 2, null]].concat((o.items || []).map((it, i) => [B.b + (i ? 4 : 0), it]));
      for (const [y, it] of rows) {
        p.chest(g + 1, y, it, 200);
        p.ins(g, y, it ? 'E' : 'W'); p.ins(g + 2, y, it ? 'W' : 'E');
      }
    }
  }
  busTap(p, BUS.lava); busPass(p, BUS.acid);
  // cifras
  const lavaIn = RA.speed / 16 * 500, moltenOut = RA.speed / 16 * 250 * RA.prod;
  const castT = o.time / RB.speed, need = o.molten / castT;
  const nT = o.nA[0] + o.nA[1], supply = Math.min(1, nT * moltenOut / (12 * need)), useA = Math.min(1, 12 * need / (nT * moltenOut));
  const crafts = 12 / castT * supply, out = crafts * o.out * RB.prod, craftsA = nT * RA.speed / 16 * useA;
  const desc = [o.what,
    `Produce unos ${f1(out)} ${o.unit}/s (${f1(out * 60)}/min) con 12 coladas de ${o.castLabel} (4 módulos de productividad 3 y 4 balizas con velocidad 3 cada una) y ${nT} fundiciones de lava con 4 módulos de velocidad 3.`,
    `Consume ${f1(craftsA * 500)} de lava/s de la troncal de la fila 24 (una bomba costera da 1200/s) y ${f1(craftsA)} de calcita/s; saca ${f1(craftsA * o.stone * RA.prod)} de piedra/s, que puedes convertir en ladrillos o relleno.`,
    o.items ? `Pide por robots ${o.items.map((it, i) => `${f1(crafts * o.per[i])} de ${o.names[i]}/s`).join(' y ')}.` : 'Las placas salen a cofres de suministro pasivo para los robots.',
  ].join('\n');
  return bp(o.label, desc, p);
}

// ----- minería con perforadoras grandes -----
function miningBlock() {
  const p = new Plan(); skeleton(p);
  const rows = [];
  for (let x = 5; x < BLOCK; x += 5) rows.push([x, 1, 'S']);                                // arriba, junto al roboport
  for (const [ya, yb] of [[9, 15], [26, 32]]) for (let x = 0; x < BLOCK; x += 5) { rows.push([x, ya, 'S']); rows.push([x, yb, 'N']); }
  for (let x = 0; x < BLOCK; x += 5) if (!POLE_T.includes(x + 2)) rows.push([x, 43, 'N']);   // abajo, sin echar sobre una subestación
  const chests = new Set();
  for (const [x, y, d] of rows) {
    p.machine('big-mining-drill', x, y, d, null, 'speed');
    const cy = d === 'S' ? y + 5 : y - 1, k = (x + 2) + ',' + cy;
    if (!chests.has(k)) { chests.add(k); p.chest(x + 2, cy, null); }
  }
  busPass(p, BUS.lava); busPass(p, BUS.acid);
  const r = rate('big-mining-drill', 'speed'), per = r.speed / 5;
  return bp('Minería: tungsteno, calcita o carbón',
    `${rows.length} perforadoras grandes con 4 módulos de velocidad 3 que dejan el mineral en cofres de suministro pasivo. ` +
    `Colócalo sobre un yacimiento de tungsteno (unos ${f1(rows.length * per)} de mineral/s), de calcita o de carbón (más rápido: tardan menos en extraerse). ` +
    'La investigación de productividad de minería suma encima. Las perforadoras grandes solo se fabrican en Vulcano y aquí no necesitan fluido.', p);
}

// ----- química y ensamblaje alrededor de cabeceras de ácido -----
// Dos filas de máquinas de 3×3 enfrentadas a una tubería de ácido (la de arriba mira al sur, la de abajo al norte).
// Las cabeceras toman el ácido de la troncal (fila 41) por una tubería vertical en la columna 48.
const MX = [1, 7, 13, 19, 25, 31, 37, 43];
const HEADERS = [12, 20, 29, 37];
function acidRows(p, h, spec) {
  for (const [y, d] of [[h - 3, 'S'], [h + 1, 'N']]) {
    for (const x of MX) p.machine(spec.m, x, y, d, spec.recipe, 'prod');
    for (const x of MX) {
      const g = x + 3, last = x === MX[MX.length - 1];
      const io = [[y + 1, null]].concat(spec.items.map((it, i) => [y + (i ? 2 : 0), it]));
      for (const [yy, it] of io) { p.chest(g + 1, yy, it, 100); p.ins(g, yy, it ? 'E' : 'W'); if (!last) p.ins(g + 2, yy, it ? 'W' : 'E'); }
    }
  }
  p.hpipe(1, 48, h);
}
function carbideBlock() {
  const p = new Plan(); skeleton(p);
  const C = { m: 'chemical-plant', recipe: 'carbon', items: ['coal'] }, A = { m: 'assembling-machine-3', recipe: 'tungsten-carbide', items: ['tungsten-ore', 'carbon'] };
  acidRows(p, 12, C); acidRows(p, 20, C); acidRows(p, 29, A); acidRows(p, 37, A);
  p.vpipe(48, 13, 19); p.vpipe(48, 21, 28); p.vpipe(48, 30, 36); p.vpipe(48, 38, 40);
  busPass(p, BUS.lava); busPass(p, BUS.acid, PASS.slice(0, 4).concat([[40, 47]])); p.pipe(48, BUS.acid); p.pipe(49, BUS.acid);
  const rc = rate('chemical-plant', 'prod'), ra = rate('assembling-machine-3', 'prod');
  const carbon = 32 * rc.speed * rc.prod, carbide = Math.min(32 * ra.speed * ra.prod, carbon / 1 * ra.prod);
  return bp('Carbono y carburo de tungsteno',
    `32 plantas químicas hacen carbono (carbón + ácido) y 32 ensambladoras 3 lo convierten en carburo de tungsteno (mineral de tungsteno + carbono + ácido), todas con módulos de productividad 3. ` +
    `Salen unos ${f1(carbide)} de carburo/s y sobran ${f1(Math.max(0, carbon - 32 * ra.speed))} de carbono/s para otros usos. ` +
    `Pide por robots ${f1(32 * rc.speed * 2)} de carbón/s y ${f1(32 * ra.speed * 2)} de mineral de tungsteno/s, y toma ${f1(32 * rc.speed * 20 + 32 * ra.speed * 10)} de ácido/s de la troncal de la fila 41.`, p);
}

// ----- central de vapor a 500 °C: neutralización de ácido y turbinas -----
const TROWS = [4, 9, 12, 15, 18, 21, 26, 29, 32, 35, 38];
function powerBlock() {
  const p = new Plan(); skeleton(p);
  for (const y of TROWS) for (let i = 0; i < 9; i++) p.put('steam-turbine', 3 + 5 * i, y, 'E');
  p.vpipe(2, 5, 39); p.ptg(2, 40, 'N'); p.ptg(2, 42, 'S'); p.vpipe(2, 43, 46);   // colector de vapor: pasa bajo la troncal de ácido
  const PX = [3, 11, 17];
  for (const x of PX) { p.machine('chemical-plant', x, 43, 'N', 'acid-neutralisation'); p.pipe(x, 42); p.pipe(x + 2, 42); }
  p.hpipe(3, 19, 46);
  p.chest(7, 44, 'calcite', 50); p.ins(6, 44, 'E'); p.chest(9, 44, 'calcite', 50); p.ins(10, 44, 'W');
  p.chest(15, 44, 'calcite', 50); p.ins(14, 44, 'E'); p.ins(16, 44, 'W');
  busPass(p, BUS.lava); busTap(p, BUS.acid);
  const n = TROWS.length * 9;
  return bp('Central de vapor (neutralización de ácido)',
    `${n} turbinas de vapor alimentadas por 3 plantas químicas que neutralizan ácido sulfúrico con calcita: vapor a 500 °C, el máximo de la turbina. ` +
    `Da hasta ${f1(n * 5.82)} MW. Consume ${f1(n * 60 / 10)} de ácido/s de la troncal de la fila 41 y ${f1(n * 60 / 1000)} de calcita/s. ` +
    'En Vulcano el ácido sale de los géiseres con bombas de extracción: llévalo a la troncal.', p);
}

// ----- puerto de exportación: silos de cohetes -----
function exportBlock() {
  const p = new Plan(); skeleton(p);
  const parts = ['processing-unit', 'low-density-structure', 'rocket-fuel'];
  for (const [x, y] of [[11, 11], [28, 11], [11, 28], [28, 28]]) {
    p.machine('rocket-silo', x, y, 0, 'rocket-part', 'speed');
    parts.forEach((it, i) => { const yy = y + 2 + 2 * i; p.chest(x - 2, yy, it, 100); p.ins(x - 1, yy, 'W'); p.chest(x + 10, yy, it, 100); p.ins(x + 9, yy, 'E'); });
  }
  busPass(p, BUS.lava); busPass(p, BUS.acid);
  const r = rate('rocket-silo', 'speed'), t = 50 * 3 / r.speed;
  return bp('Puerto de exportación (4 silos)',
    `4 silos de cohetes con 4 módulos de velocidad 3: cada uno monta un cohete cada ${Math.round(t)} s más el despegue, unos ${f1(4 * 60 / (t + 40))} cohetes por minuto en total. ` +
    'Los robots les llevan procesadores, estructuras de baja densidad y combustible de cohete, y los silos cargan solos lo que pidan tus plataformas espaciales: ciencia metalúrgica, placas y carburo de tungsteno, perforadoras grandes, fundiciones o cintas turbo. ' +
    'Los procesadores y el combustible de cohete suelen llegar de otro planeta; las estructuras de baja densidad se pueden colar aquí.', p);
}

// ----- toma de lava: bombas costeras que llenan la troncal -----
function lavaIntake() {
  const p = new Plan();
  for (let i = 0; i < 4; i++) p.put('offshore-pump', 2 * i, 0, 'N');   // con la dirección 0 la salida queda al sur
  p.hpipe(0, 9, 1); p.vpipe(9, 2, 4); p.put('pump', 9, 5, 'S'); p.vpipe(9, 7, 9);
  return bp('Toma de lava (4 bombas costeras)',
    'Colócala en la orilla de un lago de lava, con las bombas sobre la lava. Da hasta 4800 de lava/s, suficiente para unos tres bloques de fundición. ' +
    'Lleva la tubería hasta la fila 24 de un bloque (la troncal de lava) por su borde oeste.', p, false);
}

function baseBlock() {
  const p = new Plan(); skeleton(p); busPass(p, BUS.lava); busPass(p, BUS.acid);
  return bp('Base de bloque 50×50',
    'El esqueleto común: roboport, nueve subestaciones y las troncales de lava (fila 24) y de ácido (fila 41) pasando por debajo. ' +
    'Úsalo para rellenar huecos de la cuadrícula o como punto de partida de tus propios bloques. Mantén libres las casillas de las troncales y no lleves ninguna otra tubería al borde.', p);
}

export function vulcanusBook() {
  const iron = { cast: 'casting-iron', molten: 20, time: 3.2, out: 2, unit: 'placas de hierro', castLabel: 'hierro', stone: 10 };
  const copper = { cast: 'casting-copper', molten: 20, time: 3.2, out: 2, unit: 'placas de cobre', castLabel: 'cobre', stone: 15 };
  const kids = [
    lavaIntake(),
    baseBlock(),
    powerBlock(),
    foundryBlock(Object.assign({}, iron, { label: 'Fundición de hierro', lava: 'molten-iron-from-lava', nA: [2, 2], what: 'Hierro sin minar: la lava y la calcita se funden en hierro fundido y se cuela directamente en placas.' })),
    foundryBlock(Object.assign({}, copper, { label: 'Fundición de cobre', lava: 'molten-copper-from-lava', nA: [2, 2], what: 'Cobre sin minar: la lava y la calcita se funden en cobre fundido y se cuela en placas.' })),
    foundryBlock({ label: 'Acero por colada', lava: 'molten-iron-from-lava', cast: 'casting-steel', molten: 30, time: 3.2, out: 1, unit: 'placas de acero', castLabel: 'acero', stone: 10, nA: [3, 3], what: 'Acero directamente del hierro fundido, sin pasar por placas de hierro.' }),
    miningBlock(),
    carbideBlock(),
    foundryBlock({ label: 'Placas de tungsteno', lava: 'molten-iron-from-lava', cast: 'tungsten-plate', molten: 10, time: 10, out: 1, unit: 'placas de tungsteno', castLabel: 'placas de tungsteno', stone: 10, nA: [1, 1], items: ['tungsten-ore'], per: [4], names: ['mineral de tungsteno'], what: 'Placas de tungsteno con mineral de tungsteno y hierro fundido.' }),
    foundryBlock({ label: 'Ciencia metalúrgica', lava: 'molten-copper-from-lava', cast: 'metallurgic-science-pack', molten: 200, time: 10, out: 1, unit: 'packs de ciencia metalúrgica', castLabel: 'ciencia metalúrgica', stone: 15, nA: [5, 5], items: ['tungsten-carbide', 'tungsten-plate'], per: [3, 2], names: ['carburo de tungsteno', 'placas de tungsteno'], what: 'El producto estrella para exportar: ciencia metalúrgica con cobre fundido de la lava.' }),
    exportBlock(),
  ];
  kids.forEach((k, i) => { k.blueprint.label = String(i).padStart(2, '0') + ' · ' + k.blueprint.label; });
  return BP.buildBook('Megabase Vulcano: superproducción y exportación', kids, 2,
    'Pack de bloques de 50×50 con cuadrícula absoluta para Vulcano (Space Age), con robots y sin trenes. ' +
    'Cada bloque trae roboport y subestaciones que enlazan con los vecinos, y dos troncales que lo cruzan de oeste a este: lava en la fila 24 y ácido sulfúrico en la fila 41. ' +
    'Empieza por la toma de lava y la central de vapor, mina tungsteno, calcita y carbón, y encadena fundición, carburo, placas de tungsteno y ciencia metalúrgica hasta el puerto de exportación. ' +
    'Proporción a todo gas: cada bloque de ciencia metalúrgica pide unos dos de carburo, uno de placas de tungsteno y dos de minería sobre tungsteno.');
}

/** Plantillas de serie que ofrece el editor. */
export const PRESETS = [
  { id: 'vulcanus', label: 'Megabase Vulcano', sub: 'Superproducción y exportación · 11 planos', book: vulcanusBook },
];
