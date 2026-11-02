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
import { railTurtle, normDir } from './rails.js';

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
  constructor() { this.ents = []; this.tiles = []; this.id = 1; }
  // entidad por su centro (vías, señales, trenes)
  raw(name, x, y, dir, extra) { const e = { id: this.id++, name, x, y, dir: dir | 0, extra: extra || {} }; this.ents.push(e); return e; }
  rails(pieces) { for (const r of pieces) this.raw(r.name, r.x, r.y, r.dir); }
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
// ----- acabado: suelo de hormigón refinado con borde de hormigón de peligro y lámparas junto a las subestaciones -----
const RAILY = new Set(['straight-rail', 'curved-rail-a', 'curved-rail-b']);
function decorate(p, W, H) {
  const busy = new Set(), K2 = (x, y) => x + ',' + y;
  for (const e of p.ents) {
    const [w, h] = RAILY.has(e.name) ? [4, 4] : sz(def(e.name), e.dir);   // las vías reservan algo más de sitio
    for (let y = Math.floor(e.y - h / 2 + 1e-6); y < Math.ceil(e.y + h / 2 - 1e-6); y++) for (let x = Math.floor(e.x - w / 2 + 1e-6); x < Math.ceil(e.x + w / 2 - 1e-6); x++) busy.add(K2(x, y));
  }
  for (const s of p.ents.filter(e => e.name === 'substation')) {
    const x0 = s.x - 1, y0 = s.y - 1;
    for (const [x, y] of [[x0 + 2, y0], [x0 - 1, y0 + 1], [x0 + 1, y0 + 2], [x0, y0 - 1], [x0 + 2, y0 + 1], [x0 - 1, y0]]) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || busy.has(K2(x, y))) continue;
      p.put('small-lamp', x, y, 0); busy.add(K2(x, y)); break;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.tiles.push({ x, y, name: x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 'refined-hazard-concrete-left' : 'refined-concrete' });
}
function bp(label, description, p, block) {
  if (block !== false) decorate(p, (block && block.w) || BLOCK, BLOCK);
  const mw = powerMW(p.ents); if (mw >= 1) description += `\nConsumo eléctrico: unos ${f1(mw)} MW a pleno rendimiento.`;
  const out = BP.buildBlueprint({ ents: p.ents, wires: [], tiles: p.tiles, meta: { label, description, extraBp: block === false ? {} : grid(), schedules: p.schedules || null }, target: 2 });
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
  return Object.assign(bp(o.label, desc, p), { stats: { out, lava: craftsA * 500, calcite: craftsA, items: (o.per || []).map(k => crafts * k) } });
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
  return Object.assign(bp('Minería: tungsteno, calcita o carbón',
    `${rows.length} perforadoras grandes con 4 módulos de velocidad 3 que dejan el mineral en cofres de suministro pasivo. ` +
    `Colócalo sobre un yacimiento de tungsteno (unos ${f1(rows.length * per)} de mineral/s), de calcita o de carbón (más rápido: tardan menos en extraerse). ` +
    'La investigación de productividad de minería suma encima. Las perforadoras grandes solo se fabrican en Vulcano y aquí no necesitan fluido.', p), { stats: { ore: rows.length * per } });
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
  return Object.assign(bp('Carbono y carburo de tungsteno',
    `32 plantas químicas hacen carbono (carbón + ácido) y 32 ensambladoras 3 lo convierten en carburo de tungsteno (mineral de tungsteno + carbono + ácido), todas con módulos de productividad 3. ` +
    `Salen unos ${f1(carbide)} de carburo/s y sobran ${f1(Math.max(0, carbon - 32 * ra.speed))} de carbono/s para otros usos. ` +
    `Pide por robots ${f1(32 * rc.speed * 2)} de carbón/s y ${f1(32 * ra.speed * 2)} de mineral de tungsteno/s, y toma ${f1(32 * rc.speed * 20 + 32 * ra.speed * 10)} de ácido/s de la troncal de la fila 41.`, p), { stats: { acid: 32 * rc.speed * 20 + 32 * ra.speed * 10, ore: 32 * ra.speed * 2, coal: 32 * rc.speed * 2 } });
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
  return Object.assign(bp('Central de vapor (neutralización de ácido)',
    `${n} turbinas de vapor alimentadas por 3 plantas químicas que neutralizan ácido sulfúrico con calcita: vapor a 500 °C, el máximo de la turbina. ` +
    `Da hasta ${f1(n * 5.82)} MW. Consume ${f1(n * 60 / 10)} de ácido/s de la troncal de la fila 41 y ${f1(n * 60 / 1000)} de calcita/s. ` +
    'En Vulcano el ácido sale de los géiseres con bombas de extracción: llévalo a la troncal.', p), { stats: { mw: n * 5.82, acid: n * 6, calcite: n * 0.06 } });
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
// Bombas en fila (la dirección 0 saca el fluido por el sur), un colector y una bajada que entra en la troncal (fila 24)
// del bloque cuyo borde está en X: por el oeste (side W) o por el este (side E). Sin bombas en línea: cada una limita a 1200/s.
function intake(p, side, n, X, Y) {
  const x0 = side === 'W' ? X - 2 * n : X, col = side === 'W' ? X - 1 : X;
  for (let i = 0; i < n; i++) p.put('offshore-pump', x0 + 2 * i, Y + BUS.lava - 9, 'N');
  p.hpipe(x0, side === 'W' ? X - 1 : x0 + 2 * n - 2, Y + BUS.lava - 8); p.vpipe(col, Y + BUS.lava - 7, Y + BUS.lava);
}
function lavaIntake() {
  const p = new Plan(); intake(p, 'W', 4, 8, -BUS.lava + 9);
  return bp('Toma de lava (4 bombas costeras)',
    'Colócala en la orilla de un lago de lava, con las bombas sobre la lava. Da hasta 4800 de lava/s: un bloque de ciencia metalúrgica o tres de fundición. ' +
    'La bajada termina justo al lado de la fila 24 de un bloque (la troncal de lava): pon el bloque a su derecha. Para más caudal, añade bombas al colector; no metas bombas en línea, que limitan a 1200/s.', p, false);
}

function baseBlock() {
  const p = new Plan(); skeleton(p); busPass(p, BUS.lava); busPass(p, BUS.acid);
  return bp('Base de bloque 50×50',
    'El esqueleto común: roboport, nueve subestaciones y las troncales de lava (fila 24) y de ácido (fila 41) pasando por debajo. ' +
    'Úsalo para rellenar huecos de la cuadrícula, para llevar la red de robots y la corriente hasta los bloques de minería o como punto de partida de tus propios bloques. Mantén libres las casillas de las troncales y no lleves ninguna otra tubería al borde.', p);
}

// ----- consumo eléctrico estimado (valores de Factorio 2.0: máquina, módulos y balizas que la alcanzan) -----
const POWER_KW = { foundry: 2500, 'chemical-plant': 210, 'assembling-machine-3': 375, 'big-mining-drill': 300, 'rocket-silo': 250, beacon: 480, roboport: 2050, 'bulk-inserter': 40 };
const MOD_E = { 'productivity-module-3': 0.8, 'speed-module-3': 0.7 };
export function powerMW(ents) {
  const beacons = ents.filter(e => e.name === 'beacon'); let kw = 0;
  for (const e of ents) {
    const base = POWER_KW[e.name]; if (!base) continue;
    if (e.name === 'beacon' || e.name === 'roboport' || e.name === 'bulk-inserter') { kw += base; continue; }   // roboport cargando robots a tope
    let c = 1; for (const it of (e.extra && e.extra.items) || []) c += (MOD_E[it.id.name] || 0) * it.items.in_inventory.length;
    const [w, h] = sz(def(e.name), e.dir), n = beacons.filter(b => Math.abs(b.x - e.x) < 4.5 + w / 2 && Math.abs(b.y - e.y) < 4.5 + h / 2).length;
    if (n) c += Math.sqrt(n) * 1.5 * 2 * 0.7;
    kw += base * Math.max(0.2, c);
  }
  return kw / 1000;
}

// ----- trenes 1-4: una locomotora y cuatro vagones de carga -----
// Doble vía con circulación por la derecha: hacia el este por la vía sur (fila 27) y hacia el oeste por la norte (fila 23).
// Las piezas miden 50 de alto y encajan con la cuadrícula de bloques; su roboport y sus subestaciones enlazan con los
// bloques de debajo. Las estaciones están en un apartadero: un tren parado no corta la línea.
export const RAIL = { wb: 23, eb: 27, siding: 35 };
export const TRAIN_LOAD = 4 * 40 * 50;                      // 4 vagones × 40 huecos × pilas de 50 (mineral, carbón o calcita)
export const UNLOAD = 'Vulcano · Descarga';
const SIG = 'rail-signal', CHAIN = 'rail-chain-signal';
// señal para trenes hacia el este (a la derecha de la vía, mirando atrás) o hacia el oeste, en el final de vía de x
const sigE = (p, x, name, y) => p.raw(name || SIG, x - 0.5, (y || RAIL.eb) + 1.5, 12);
const sigW = (p, x, name) => p.raw(name || SIG, x + 0.5, RAIL.wb - 1.5, 4);
function mains(p, x0, x1) { for (const y of [RAIL.wb, RAIL.eb]) p.rails(railTurtle(x0, y, 4).straight((x1 - x0) / 2).pieces); }
function stripSkeleton(p, W) {
  for (let x = 0; x < W; x += BLOCK) { p.put('roboport', x, 44, 0); for (const c of POLE_AT) p.put('substation', x + c - 1, 40, 0); }
}
function linePiece() {
  const p = new Plan(); mains(p, 0, 50); sigE(p, 48); sigW(p, 2); stripSkeleton(p, 50);
  return bp('Tren · Línea principal (doble vía)', 'Tramo recto de 50 casillas con doble vía: hacia el este por la vía sur y hacia el oeste por la norte, con una señal por sentido. Trae roboport y subestaciones: la red de robots y la corriente siguen junto a la vía, así que los puestos mineros reciben electricidad de la fábrica. Gíralo con R para hacer tramos verticales.', p);
}
function cornerPiece() {
  const p = new Plan();
  p.rails(railTurtle(0, RAIL.eb, 4).straight(7).turn(-1, 4).straight(7).pieces);
  p.rails(railTurtle(0, RAIL.wb, 4).straight(5).turn(-1, 4).straight(5).pieces);
  // subestaciones que siguen la curva: enlazan con las de la línea del oeste (fila 41) y con las de la línea girada (columna 41)
  for (const [x, y] of [[8, 41], [25, 41], [42, 41], [42, 25], [42, 8]]) p.put('substation', x - 1, y - 1, 0);
  return bp('Tren · Curva de doble vía', 'Curva de 90° que une la línea que llega por el oeste con la que sale por el norte, sin cruzar los dos sentidos. Lleva subestaciones para que la corriente siga junto a la vía. Gírala con R para los otros tres giros.', p);
}
// retorno al final de la línea: la vía hacia el este da la vuelta y vuelve por la vía hacia el oeste
function loopRails(p) {
  p.rails(railTurtle(0, RAIL.eb, 4).straight(18).turn(-1, 4).turn(-1, 4).turn(-1, 2).straight(7).turn(1, 2).straight(2).pieces);
  sigE(p, 34); sigW(p, 2);
}
function rot180(p, W, H) {
  for (const e of p.ents) { e.x = W - e.x; e.y = H - e.y; e.dir = RAILY.has(e.name) ? normDir(e.name, e.dir + 8) : (e.dir + 8) % 16; }
  return p;
}
function loopPiece(west) {
  const p = new Plan(); loopRails(p); if (west) rot180(p, 50, 50);
  return bp(west ? 'Tren · Retorno oeste' : 'Tren · Retorno este',
    `Fin de línea: los trenes que llegan por la vía ${west ? 'norte (hacia el oeste) dan la vuelta y salen por la sur hacia el este' : 'sur (hacia el este) dan la vuelta y salen por la norte hacia el oeste'}. Va en el extremo ${west ? 'oeste, junto a los puestos mineros' : 'este, después de las estaciones de descarga'}.`, p);
}
// estación en apartadero (100 de ancho): desvío en x 4, vía de la estación de x 22 a 70 y vuelta a la línea en x 88
const SX = 65;                                              // centro de la parada: el frente de la locomotora queda aquí
export const WAGONS = [1, 2, 3, 4].map(i => SX - 3 - 7 * i); // centros de los cuatro vagones
function stationRails(p) {
  mains(p, 0, 100);
  p.rails(railTurtle(4, RAIL.eb, 4).turn(1, 2).turn(-1, 2).straight(24).turn(-1, 2).turn(1, 2).pieces);
  sigE(p, 2, CHAIN); sigE(p, 70, SIG, RAIL.siding); sigE(p, 70); sigE(p, 94); sigW(p, 50); sigW(p, 2);
}
function stationPiece(kind, item, label) {
  const p = new Plan(); stationRails(p); stripSkeleton(p, 100);
  const name = kind === 'unload' ? UNLOAD : 'Vulcano · Carga de ' + label;
  p.raw('train-stop', SX, RAIL.siding + 2, 4, { station: name, manual_trains_limit: 1 });
  for (const c of WAGONS) for (let x = c - 3; x < c + 3; x++) {
    if (kind === 'unload') { p.chest(x, 32, null); p.ins(x, 33, 'S'); p.ins(x, 36, 'N'); p.chest(x, 37, null); }
    else { p.chest(x, 32, item, 100); p.ins(x, 33, 'N'); p.ins(x, 36, 'S'); p.chest(x, 37, item, 100); }
  }
  if (kind === 'load') {
    // un tren 1-4 aparcado con su horario: cargar hasta llenar, descargar hasta vaciar; reposta carbón aquí
    const loco = p.raw('locomotive', SX - 3, RAIL.siding, 4, { items: [{ id: { name: 'coal' }, items: { in_inventory: [{ inventory: 1, stack: 0, count: 50 }] } }] });
    for (const c of WAGONS) p.raw('cargo-wagon', c, RAIL.siding, 4);
    p.chest(SX - 4, 32, 'coal', 50); p.ins(SX - 4, 33, 'N');
    p.schedules = [{ locomotives: [loco.id], schedule: { records: [
      { station: name, wait_conditions: [{ type: 'full', compare_type: 'or' }] },
      { station: UNLOAD, wait_conditions: [{ type: 'empty', compare_type: 'or' }] },
    ] } }];
  }
  const what = kind === 'unload'
    ? `Estación de descarga para trenes 1-4 en apartadero: 48 insertadores masivos vacían los cuatro vagones en cofres de suministro pasivo y los robots llevan el mineral a la fábrica. Parada «${UNLOAD}» con límite de 1 tren; pon varias con el mismo nombre y los trenes van a la que esté libre.`
    : `Estación de carga de ${label} para trenes 1-4 en apartadero: los robots llenan 48 cofres de solicitud con lo que sacan las perforadoras y 48 insertadores masivos cargan los vagones (${TRAIN_LOAD} unidades por tren). Trae un tren aparcado con su horario: «Carga de ${label}» hasta llenar y «Descarga» hasta vaciar; reposta carbón aquí.`;
  return bp(kind === 'unload' ? 'Tren · Estación de descarga 1-4' : `Tren · Estación de carga 1-4 (${label})`, what + ' Señales: en cadena a la entrada del desvío y normales a la salida.', p, { w: 100 });
}
// puesto minero: estación de carga encima de los bloques de minería y retorno al oeste
function outpost(B, item, label, n) {
  const ents = [], tiles = []; let id = 1, sched = null;
  const add = (b, ox, oy) => {
    const q = BP.parseBlueprint(b.blueprint), map = new Map();
    for (const e of q.ents) { map.set(e.num, id); ents.push({ id: id++, name: e.name, x: e.x + ox, y: e.y + oy, dir: e.dir, extra: e.extra }); }
    for (const t of q.tiles) tiles.push({ x: t.x + ox, y: t.y + oy, name: t.name });
    if (q.meta.schedules) sched = BP.mapSched(q.meta.schedules, k => map.get(k));
  };
  add(B.loopW, -BLOCK, 0); add(B.load[item], 0, 0);
  for (let i = 0; i < 2; i++) add(i < n ? B.mine : B.base, BLOCK * i, BLOCK);
  return BP.buildBlueprint({ ents, wires: [], tiles, target: 2, meta: { label: `Puesto minero de ${label}`, schedules: sched,
    extraBp: BP.setSnap({}, { w: BLOCK, h: BLOCK, abs: true, ox: -BLOCK, oy: 0 }),
    description: `${n === 2 ? 'Dos bloques' : 'Un bloque'} de minería con perforadoras grandes, la estación de carga de ${label} encima y el retorno al oeste. Colócalo sobre un yacimiento de ${label} y lleva su vía (sale abierta por el este) hasta la de la fábrica con tramos de línea principal y curvas: sus subestaciones le llevan también la corriente. Gasta unos ${f1(powerMW(ents))} MW. ` +
      `Cada tren 1-4 lleva ${TRAIN_LOAD} de ${label}. Los robots del puesto llevan lo que sacan las perforadoras a la estación.` } });
}

// ----- la megabase montada: todas las piezas juntas, en proporción -----
// Fila de arriba (de oeste a este): ciencia metalúrgica, placas de tungsteno, 2 de carburo, 4 centrales y el puerto.
// Fila de abajo, bajo las últimas centrales y el puerto: hierro, cobre y acero para construir y exportar.
function megabase(B) {
  const ents = [], tiles = []; let id = 1;
  const add = (b, ox, oy) => { const q = BP.parseBlueprint(b.blueprint); for (const e of q.ents) ents.push({ id: id++, name: e.name, x: e.x + ox, y: e.y + oy, dir: e.dir, extra: e.extra }); for (const t of q.tiles) tiles.push({ x: t.x + ox, y: t.y + oy, name: t.name }); };
  const top = [B.sci, B.plate, B.carb, B.carb, B.power, B.power, B.power, B.power, B.exp], low = [[6, B.iron], [7, B.copper], [8, B.steel]];
  top.forEach((b, i) => add(b, BLOCK * i, 0)); low.forEach(([c, b]) => add(b, BLOCK * c, BLOCK));
  // franja de tren al norte: línea de doble vía, dos estaciones de descarga y el retorno al este
  [[B.line, 0], [B.line, 50], [B.unload, 100], [B.line, 200], [B.line, 250], [B.unload, 300], [B.line, 400], [B.loopE, 450]].forEach(([b, x]) => add(b, x, -BLOCK));
  const p = new Plan(); p.id = id;
  intake(p, 'W', 4, 0, 0); intake(p, 'E', 6, BLOCK * top.length, BLOCK);
  p.hpipe(-3, -1, BUS.acid);   // entrada del ácido de los géiseres
  ents.push(...p.ents);
  // cifras
  const S = k => B[k].stats, ore = S('plate').items[0] + 2 * S('carb').ore, coal = 2 * S('carb').coal;
  const calcite = ['sci', 'plate', 'iron', 'copper', 'steel'].reduce((a, k) => a + S(k).calcite, 0) + 4 * S('power').calcite;
  const acid = 2 * S('carb').acid + 4 * S('power').acid, gen = 4 * S('power').mw, use = powerMW(ents);
  const lavaTop = S('sci').lava + S('plate').lava, lavaLow = S('iron').lava + S('copper').lava + S('steel').lava;
  const xs = ents.map(e => Math.floor(e.x - sz(def(e.name), e.dir)[0] / 2)), ys = ents.map(e => Math.floor(e.y - sz(def(e.name), e.dir)[1] / 2));
  const out = BP.buildBlueprint({ ents, wires: [], tiles, target: 2, meta: { label: 'Megabase completa (todo montado)',
    extraBp: BP.setSnap({}, { w: BLOCK, h: BLOCK, abs: true, ox: Math.min(...xs), oy: Math.min(...ys) }),
    description: [
      `Todas las piezas juntas y en proporción: ${f1(S('sci').out)} packs de ciencia metalúrgica/s (${f1(S('sci').out * 60)}/min) listos para exportar, y además ${f1(S('iron').out)} placas de hierro/s, ${f1(S('copper').out)} de cobre/s y ${f1(S('steel').out)} de acero/s para construir o vender.`,
      'Fila de arriba, de oeste a este: ciencia metalúrgica, placas de tungsteno, dos bloques de carburo, cuatro centrales de vapor y el puerto de exportación. Fila de abajo: hierro, cobre y acero.',
      `Lava: dos tomas que ya vienen en el plano, ${f1(lavaTop)}/s por el oeste de la fila de arriba (4 bombas) y ${f1(lavaLow)}/s por el este de la de abajo (6 bombas). Pon las bombas sobre un lago de lava.`,
      `Ácido sulfúrico: ${f1(acid)}/s por la tubería que asoma al oeste de la fila de arriba. Tráelo de los géiseres con bombas de extracción.`,
      `Electricidad: las 4 centrales dan ${f1(gen)} MW y el conjunto gasta unos ${f1(use)} MW a pleno rendimiento.`,
      `Minería por tren: la fábrica necesita unos ${f1(ore)} de mineral de tungsteno/s, ${f1(coal)} de carbón/s y ${f1(calcite)} de calcita/s, unos ${f1((ore + coal + calcite) / TRAIN_LOAD * 60)} trenes 1-4 llenos por minuto. Usa los puestos mineros del libro (tungsteno con ${Math.ceil(ore / S('mine').ore)} bloques de minería, carbón y calcita con uno) y une su vía con la de la franja de tren.`,
      'Trenes 1-4: al norte hay una franja de tren con línea de doble vía (circulación por la derecha), dos estaciones de descarga en apartadero que vacían los vagones en cofres para los robots, y un retorno al este. La vía sigue abierta por el oeste para llegar a los puestos mineros; para girar, usa la curva de doble vía del libro.',
      'El puerto pide además procesadores, estructuras de baja densidad y combustible de cohete para los cohetes.',
    ].join('\n') } });
  return out;
}

export function vulcanusBook() {
  const iron = { cast: 'casting-iron', molten: 20, time: 3.2, out: 2, unit: 'placas de hierro', castLabel: 'hierro', stone: 10 };
  const copper = { cast: 'casting-copper', molten: 20, time: 3.2, out: 2, unit: 'placas de cobre', castLabel: 'cobre', stone: 15 };
  const B = {
    lava: lavaIntake(), base: baseBlock(), power: powerBlock(),
    iron: foundryBlock(Object.assign({}, iron, { label: 'Fundición de hierro', lava: 'molten-iron-from-lava', nA: [2, 2], what: 'Hierro sin minar: la lava y la calcita se funden en hierro fundido y se cuela directamente en placas.' })),
    copper: foundryBlock(Object.assign({}, copper, { label: 'Fundición de cobre', lava: 'molten-copper-from-lava', nA: [2, 2], what: 'Cobre sin minar: la lava y la calcita se funden en cobre fundido y se cuela en placas.' })),
    steel: foundryBlock({ label: 'Acero por colada', lava: 'molten-iron-from-lava', cast: 'casting-steel', molten: 30, time: 3.2, out: 1, unit: 'placas de acero', castLabel: 'acero', stone: 10, nA: [3, 3], what: 'Acero directamente del hierro fundido, sin pasar por placas de hierro.' }),
    mine: miningBlock(), carb: carbideBlock(),
    plate: foundryBlock({ label: 'Placas de tungsteno', lava: 'molten-iron-from-lava', cast: 'tungsten-plate', molten: 10, time: 10, out: 1, unit: 'placas de tungsteno', castLabel: 'placas de tungsteno', stone: 10, nA: [1, 1], items: ['tungsten-ore'], per: [4], names: ['mineral de tungsteno'], what: 'Placas de tungsteno con mineral de tungsteno y hierro fundido.' }),
    sci: foundryBlock({ label: 'Ciencia metalúrgica', lava: 'molten-copper-from-lava', cast: 'metallurgic-science-pack', molten: 200, time: 10, out: 1, unit: 'packs de ciencia metalúrgica', castLabel: 'ciencia metalúrgica', stone: 15, nA: [5, 5], items: ['tungsten-carbide', 'tungsten-plate'], per: [3, 2], names: ['carburo de tungsteno', 'placas de tungsteno'], what: 'El producto estrella para exportar: ciencia metalúrgica con cobre fundido de la lava.' }),
    exp: exportBlock(),
    line: linePiece(), corner: cornerPiece(), loopE: loopPiece(false), loopW: loopPiece(true), unload: stationPiece('unload'),
  };
  B.load = { 'tungsten-ore': stationPiece('load', 'tungsten-ore', 'tungsteno'), coal: stationPiece('load', 'coal', 'carbón'), calcite: stationPiece('load', 'calcite', 'calcita') };
  const posts = [outpost(B, 'tungsten-ore', 'tungsteno', 2), outpost(B, 'coal', 'carbón', 1), outpost(B, 'calcite', 'calcita', 1)];
  const kids = [megabase(B), ...posts, B.line, B.corner, B.loopE, B.loopW, B.unload, B.load['tungsten-ore'], B.lava, B.base, B.power, B.iron, B.copper, B.steel, B.mine, B.carb, B.plate, B.sci, B.exp];
  kids.forEach((k, i) => { k.blueprint.label = String(i).padStart(2, '0') + ' · ' + k.blueprint.label; });
  return BP.buildBook('Megabase Vulcano: superproducción y exportación', kids, 2,
    'Pack de bloques de 50×50 con cuadrícula absoluta para Vulcano (Space Age): robots dentro de cada zona y trenes 1-4 entre los puestos mineros y la fábrica. ' +
    'El primer plano es la megabase entera ya montada; después vienen los puestos mineros, las piezas de tren y los bloques sueltos, para ampliarla o construirla por partes. ' +
    'Cada bloque trae roboport y subestaciones que enlazan con los vecinos, y dos troncales que lo cruzan de oeste a este: lava en la fila 24 y ácido sulfúrico en la fila 41. ' +
    'Proporción a todo gas: cada bloque de ciencia metalúrgica pide unos dos de carburo, uno de placas de tungsteno y dos de minería sobre tungsteno.');
}

/** Plantillas de serie que ofrece el editor. */
export const PRESETS = [
  { id: 'vulcanus', label: 'Megabase Vulcano', sub: 'Superproducción y exportación · la megabase montada, sus puestos mineros, trenes 1-4 y piezas sueltas', book: vulcanusBook },
];
