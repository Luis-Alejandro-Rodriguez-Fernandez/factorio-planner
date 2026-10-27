import { deflate, inflate } from 'pako';

const pako = { deflate, inflate };

/* ===== Núcleo: definiciones, códec y conversión de planos (sin DOM) ===== */
export const BP = (() => {
const DEFS = {};
const CATS = [['belts','Cintas'],['trains','Trenes'],['ins','Insertadores'],['store','Almacenaje'],['fluid','Fluidos'],['power','Energía'],['prod','Producción'],['logic','Robots y circuitos'],['def','Defensa'],['space','Espacio y carga'],['tiles','Suelos']];
function D(name, label, cat, w, h, kind, color, o) { DEFS[name] = Object.assign({ name, label, cat, w, h, kind, color, rot: true }, o || {}); }
const Y = '#e3ad1a', R = '#dd4636', B = '#3a9be2', G = '#79c142';
D('transport-belt','Cinta transportadora','belts',1,1,'belt',Y);
D('fast-transport-belt','Cinta transportadora rápida','belts',1,1,'belt',R);
D('express-transport-belt','Cinta transportadora exprés','belts',1,1,'belt',B);
D('turbo-transport-belt','Cinta transportadora turbo','belts',1,1,'belt',G,{sa:1});
D('underground-belt','Cinta subterránea','belts',1,1,'ug',Y,{max:5});
D('fast-underground-belt','Cinta subterránea rápida','belts',1,1,'ug',R,{max:7});
D('express-underground-belt','Cinta subterránea exprés','belts',1,1,'ug',B,{max:9});
D('turbo-underground-belt','Cinta subterránea turbo','belts',1,1,'ug',G,{max:11,sa:1});
D('splitter','Divisor','belts',2,1,'split',Y);
D('fast-splitter','Divisor rápido','belts',2,1,'split',R);
D('express-splitter','Divisor exprés','belts',2,1,'split',B);
D('turbo-splitter','Divisor turbo','belts',2,1,'split',G,{sa:1});
D('burner-inserter','Insertador de combustión','ins',1,1,'ins','#a07c52');
D('inserter','Insertador','ins',1,1,'ins',Y);
D('long-handed-inserter','Insertador de brazo largo','ins',1,1,'ins',R,{long:1});
D('fast-inserter','Insertador rápido','ins',1,1,'ins',B);
D('bulk-inserter','Insertador masivo','ins',1,1,'ins','#4fb566');
D('stack-inserter','Insertador de pilas','ins',1,1,'ins','#cfd6c4',{sa:1});
D('wooden-chest','Cofre de madera','store',1,1,'chest','#a06d3d',{rot:false});
D('iron-chest','Cofre de hierro','store',1,1,'chest','#8b939b',{rot:false});
D('steel-chest','Cofre de acero','store',1,1,'chest','#b5bec6',{rot:false});
D('passive-provider-chest','Cofre de suministro pasivo','store',1,1,'chest','#d4524a',{rot:false});
D('active-provider-chest','Cofre de suministro activo','store',1,1,'chest','#a35ac7',{rot:false});
D('storage-chest','Cofre de almacenamiento','store',1,1,'chest','#d8b03a',{rot:false});
D('buffer-chest','Cofre de búfer','store',1,1,'chest','#4cae68',{rot:false});
D('requester-chest','Cofre de solicitud','store',1,1,'chest','#3f8fe0',{rot:false});
D('pipe','Tubería','fluid',1,1,'pipe','#7d8a97',{rot:false,fluid:1});
D('pipe-to-ground','Tubería subterránea','fluid',1,1,'ptg','#7d8a97',{max:10,fluid:1});
D('pump','Bomba','fluid',1,2,'machine','#5f86a8',{g:'drop',fluid:1});
D('storage-tank','Tanque de almacenamiento','fluid',3,3,'machine','#878c74',{g:'tank',fluid:1,ab:'Tanque'});
D('offshore-pump','Bomba de agua costera','fluid',1,1,'machine','#4f8db8',{g:'drop',fluid:1});
D('small-electric-pole','Poste eléctrico pequeño','power',1,1,'pole','#9c7550',{rot:false,area:5});
D('medium-electric-pole','Poste eléctrico mediano','power',1,1,'pole','#b5523b',{rot:false,area:7});
D('big-electric-pole','Poste eléctrico grande','power',2,2,'pole','#8b939b',{rot:false,area:4});
D('substation','Subestación','power',2,2,'pole','#6f8aa5',{rot:false,area:18});
D('solar-panel','Panel solar','power',3,3,'machine','#2c4a74',{rot:false,g:'sun'});
D('accumulator','Acumulador','power',2,2,'machine','#77838f',{rot:false,g:'battery'});
D('boiler','Caldera','power',3,2,'machine','#9e6646',{g:'flame',fluid:1});
D('steam-engine','Máquina de vapor','power',3,5,'machine','#8e99a3',{g:'bolt',fluid:1,ab:'Máq. de vapor'});
D('steam-turbine','Turbina de vapor','power',3,5,'machine','#a7b4bf',{g:'bolt',fluid:1,ab:'Turbina'});
D('nuclear-reactor','Reactor nuclear','power',5,5,'machine','#5e8b3a',{rot:false,g:'atom',heat:1,ab:'Reactor'});
D('heat-exchanger','Intercambiador de calor','power',3,2,'machine','#b05e3d',{g:'flame',fluid:1,heat:1});
D('heat-pipe','Tubería de calor','power',1,1,'pipe','#c95f3a',{rot:false,heat:1});
D('burner-mining-drill','Perforadora de combustión','prod',2,2,'drill','#9c7a52');
D('electric-mining-drill','Perforadora eléctrica','prod',3,3,'drill','#5a7c9c',{ab:'Perforadora'});
D('big-mining-drill','Perforadora grande','prod',5,5,'drill','#496a8a',{sa:1,ab:'Perforadora grande'});
D('pumpjack','Bomba de extracción','prod',3,3,'drill','#70744f',{g:'drop',fluid:1,ab:'Extracción'});
D('stone-furnace','Horno de piedra','prod',2,2,'machine','#a28c6a',{rot:false,g:'flame',fam:'furn'});
D('steel-furnace','Horno de acero','prod',2,2,'machine','#7d858d',{rot:false,g:'flame',fam:'furn'});
D('electric-furnace','Horno eléctrico','prod',3,3,'machine','#69717a',{rot:false,g:'flame',ab:'Horno eléctrico'});
D('assembling-machine-1','Máquina de ensamblaje 1','prod',3,3,'machine','#8e959b',{g:'gear',recipe:1,fam:'asm',ab:'Ensambladora 1'});
D('assembling-machine-2','Máquina de ensamblaje 2','prod',3,3,'machine','#4b7fb3',{g:'gear',recipe:1,fam:'asm',fluid:1,ab:'Ensambladora 2'});
D('assembling-machine-3','Máquina de ensamblaje 3','prod',3,3,'machine','#c99f36',{g:'gear',recipe:1,fam:'asm',fluid:1,ab:'Ensambladora 3'});
D('chemical-plant','Planta química','prod',3,3,'machine','#4b8f69',{g:'flask',recipe:1,fluid:1,ab:'Química'});
D('oil-refinery','Refinería de petróleo','prod',5,5,'machine','#8b6856',{g:'tower',recipe:1,fluid:1,ab:'Refinería'});
D('centrifuge','Centrifugadora','prod',3,3,'machine','#5c8b38',{rot:false,g:'atom',recipe:1,ab:'Centrifugadora'});
D('lab','Laboratorio','prod',3,3,'machine','#4b86ba',{rot:false,g:'flask',ab:'Laboratorio'});
D('beacon','Baliza','prod',3,3,'machine','#8a6db3',{rot:false,g:'beacon',area:9});
D('rocket-silo','Silo de cohetes','prod',9,9,'machine','#7a8086',{g:'rocket',recipe:1,ab:'Silo de cohetes'});
D('foundry','Fundición','prod',5,5,'machine','#b35a38',{g:'flame',recipe:1,fluid:1,sa:1});
D('electromagnetic-plant','Planta electromagnética','prod',4,4,'machine','#6e56b1',{g:'bolt',recipe:1,fluid:1,sa:1,ab:'Electromagnética'});
D('biochamber','Biocámara','prod',3,3,'machine','#57a268',{g:'flask',recipe:1,fluid:1,sa:1});
D('cryogenic-plant','Planta criogénica','prod',5,5,'machine','#54abc0',{g:'flask',recipe:1,fluid:1,sa:1,ab:'Criogénica'});
D('recycler','Recicladora','prod',2,4,'machine','#8d8c63',{g:'gear',sa:1});
D('roboport','Roboport','logic',4,4,'machine','#788a97',{rot:false,g:'robot',area:50});
D('radar','Radar','logic',3,3,'machine','#7e8869',{rot:false,g:'radar'});
D('small-lamp','Lámpara','logic',1,1,'lamp','#e4cf74',{rot:false});
D('constant-combinator','Combinador constante','logic',1,1,'comb','#8b7a57',{sym:'C'});
D('arithmetic-combinator','Combinador aritmético','logic',1,2,'comb','#5a7b9c',{sym:'×',two:1});
D('decider-combinator','Combinador decisor','logic',1,2,'comb','#9c6a5a',{sym:'>',two:1});
D('selector-combinator','Combinador selector','logic',1,2,'comb','#6a9b7a',{sym:'S',two:1});
D('power-switch','Interruptor de corriente','logic',2,2,'machine','#7a7a7a',{rot:false,g:'bolt'});
D('programmable-speaker','Altavoz programable','logic',1,1,'machine','#7a6a8b',{rot:false,g:'dot'});
D('stone-wall','Muro de piedra','def',1,1,'wall','#9a9383',{rot:false});
D('gate','Puerta','def',1,1,'wall','#8b9199',{gate:1});
D('gun-turret','Torreta de ametralladora','def',2,2,'turret','#b39338',{rot:false});
D('laser-turret','Torreta láser','def',2,2,'turret','#9b3c3c',{rot:false});
D('flamethrower-turret','Torreta lanzallamas','def',2,3,'turret','#b55f2b',{fluid:1});
D('artillery-turret','Torreta de artillería','def',3,3,'turret','#5e6d4b',{rot:false});
D('land-mine','Mina terrestre','def',1,1,'machine','#7b5b3b',{rot:false,g:'dot'});
// edificios de Space Age y de 2.0 que faltaban (tamaños tomados de los datos del juego)
D('agricultural-tower','Torre agrícola','prod',3,3,'machine','#6b9b3f',{g:'leaf',sa:1});
D('biolab','Biolaboratorio','prod',5,5,'machine','#4f9a8a',{g:'flask',sa:1});
D('captive-biter-spawner','Nido de mordedores cautivo','prod',5,5,'machine','#7a4b6b',{g:'dot',sa:1,ab:'Nido cautivo'});
D('crusher','Trituradora','prod',2,3,'machine','#7d7466',{g:'gear',sa:1});
D('fusion-reactor','Reactor de fusión','power',6,6,'machine','#3f6fb0',{g:'atom',sa:1,fluid:1});
D('fusion-generator','Generador de fusión','power',3,5,'machine','#5d79b8',{g:'bolt',sa:1,fluid:1,ab:'Generador fusión'});
D('heating-tower','Torre de calefacción','power',3,3,'machine','#b0603a',{g:'flame',sa:1,heat:1,ab:'Torre de calor'});
D('lightning-rod','Pararrayos','power',1,1,'machine','#9a92b5',{g:'bolt',sa:1,rot:false});
D('lightning-collector','Colector de rayos','power',2,2,'machine','#8a7fb0',{g:'bolt',sa:1,rot:false});
D('display-panel','Panel de visualización','logic',1,1,'machine','#3a4a5a',{g:'dot'});
D('rocket-turret','Torreta de cohetes','def',3,3,'turret','#8f6a3a',{sa:1});
D('tesla-turret','Torreta Tesla','def',4,4,'turret','#4f7fbf',{sa:1});
D('railgun-turret','Torreta de cañón de riel','def',3,4,'turret','#5a6f8f',{sa:1});
D('asteroid-collector','Recolector de asteroides','space',3,3,'machine','#5d6f80',{g:'robot',sa:1,ab:'Recolector'});
D('thruster','Propulsor','space',4,5,'machine','#8b6b4b',{g:'rocket',sa:1,rot:false,fluid:1});
D('cargo-bay','Bahía de carga','space',4,4,'machine','#7a8590',{g:'tank',sa:1});
D('landing-pad-unloading-bay','Bahía de descarga','space',4,4,'machine','#6f7c88',{g:'tank',sa:1});
D('cargo-landing-pad','Plataforma de aterrizaje de carga','space',8,8,'machine','#5f6b75',{g:'rocket',sa:1,ab:'Plataforma de aterrizaje'});
D('rail-ramp','Rampa de vía',null,4,16,'machine','#7a7166',{g:'dot',sa:1});
D('rail-support','Soporte de vía',null,3,3,'machine','#7a7166',{g:'dot',sa:1});
// trenes: vías de Factorio 2.0 (rejilla de 2×2, curvas A y B, media diagonal)
D('straight-rail','Vía recta','trains',2,2,'rail','#8a7660',{g2:1,rt:'S'});
D('rail-curve-90','Curva de 90°','trains',13,13,'tmpl','#8a7660',{tmpl:'c90'});
D('rail-curve-45','Curva de 45°','trains',4,9,'tmpl','#8a7660',{tmpl:'c45'});
D('rail-signal','Señal de tren','trains',1,1,'railsig','#3f9d4a',{g2:1});
D('rail-chain-signal','Señal en cadena','trains',1,1,'railsig','#3f86c4',{g2:1,chain:1});
D('train-stop','Parada de tren','trains',2,2,'trainstop','#b8463c',{g2:1});
D('locomotive','Locomotora','trains',2,6,'train','#b5453a',{g2:1,loco:1});
D('cargo-wagon','Vagón de carga','trains',2,5,'train','#9a7a4c',{g2:1});
D('fluid-wagon','Vagón cisterna','trains',2,5,'train','#5b7fa3',{g2:1,tank:1});
D('artillery-wagon','Vagón de artillería',null,2,5,'train','#66734f',{g2:1});
D('half-diagonal-rail','Vía en media diagonal',null,2,2,'rail','#8a7660',{g2:1,rt:'H'});
D('curved-rail-a','Curva de vía (A)',null,2,2,'rail','#8a7660',{g2:1,rt:'A'});
D('curved-rail-b','Curva de vía (B)',null,2,2,'rail','#8a7660',{g2:1,rt:'B'});
for (const t of ['straight-rail', 'half-diagonal-rail', 'curved-rail-a', 'curved-rail-b']) D('elevated-' + t, DEFS[t].label + ' elevada', null, 2, 2, 'rail', '#9c8d7a', { g2: 1, rt: DEFS[t].rt, elev: 1 });
D('legacy-straight-rail','Vía recta de 1.1',null,2,2,'legacyrail','#6b6b6b',{g2:1});
D('legacy-curved-rail','Curva de vía de 1.1',null,4,4,'legacyrail','#6b6b6b',{g2:1});
D('loader','Cargador',null,1,2,'machine',Y);
D('linked-belt','Cinta enlazada',null,1,1,'belt','#8a8a8a');

const TILES = {
  'stone-path': { label: 'Camino de piedra', color: '#8a7c63', item: 'stone-brick' },
  'concrete': { label: 'Hormigón', color: '#9b9a92', item: 'concrete' },
  'hazard-concrete-left': { label: 'Hormigón de peligro', color: '#cfa032', item: 'hazard-concrete', hz: 1 },
  'refined-concrete': { label: 'Hormigón refinado', color: '#5b6670', item: 'refined-concrete' },
  'refined-hazard-concrete-left': { label: 'Hormigón refinado de peligro', color: '#bf8a2a', item: 'refined-hazard-concrete', hz: 1 },
  'landfill': { label: 'Relleno', color: '#6f5c3c', item: 'landfill' },
};
function tileDef(n) {
  if (TILES[n]) return TILES[n];
  if (/hazard/.test(n)) { const r = /refined/.test(n); return { label: n, color: r ? '#bf8a2a' : '#cfa032', item: r ? 'refined-hazard-concrete' : 'hazard-concrete', hz: 1 }; }
  return { label: n, color: '#787878', item: n };
}
const RECIPES = [['iron-gear-wheel','Engranaje'],['copper-cable','Cable de cobre'],['electronic-circuit','Circuito verde'],['advanced-circuit','Circuito rojo'],['processing-unit','Circuito azul'],
['automation-science-pack','Ciencia roja'],['logistic-science-pack','Ciencia verde'],['military-science-pack','Ciencia militar'],['chemical-science-pack','Ciencia azul'],['production-science-pack','Ciencia morada'],['utility-science-pack','Ciencia amarilla'],
['transport-belt','Cinta transportadora'],['inserter','Insertador'],['fast-inserter','Insertador rápido'],['pipe','Tubería'],['iron-stick','Barra de hierro'],['steel-plate','Placa de acero'],['stone-brick','Ladrillo de piedra'],['rail','Raíl'],
['engine-unit','Motor'],['electric-engine-unit','Motor eléctrico'],['flying-robot-frame','Marco de robot'],['low-density-structure','Estructura ligera'],['rocket-fuel','Combustible de cohete'],['solar-panel','Panel solar'],['accumulator','Acumulador'],
['plastic-bar','Plástico'],['sulfur','Azufre'],['sulfuric-acid','Ácido sulfúrico'],['battery','Batería'],['lubricant','Lubricante'],['explosives','Explosivos'],['solid-fuel-from-light-oil','Combustible sólido'],
['basic-oil-processing','Refinado básico'],['advanced-oil-processing','Refinado avanzado'],['coal-liquefaction','Licuefacción de carbón'],['heavy-oil-cracking','Craqueo de pesado'],['light-oil-cracking','Craqueo de ligero'],
['speed-module','Módulo de velocidad'],['productivity-module','Módulo de productividad'],['efficiency-module','Módulo de eficiencia'],['concrete','Hormigón'],['refined-concrete','Hormigón refinado'],['landfill','Relleno'],
['uranium-processing','Procesado de uranio'],['kovarex-enrichment-process','Enriquecimiento Kovarex'],['uranium-fuel-cell','Celda de uranio'],['nuclear-fuel','Combustible nuclear'],['rocket-part','Parte de cohete'],
['firearm-magazine','Cargador de munición'],['piercing-rounds-magazine','Munición perforante'],['grenade','Granada'],['stone-wall','Muro de piedra'],['medium-electric-pole','Poste mediano']];
const RECIPE_ES = Object.fromEntries(RECIPES);

const N1TO2 = { 'stack-inserter': 'bulk-inserter', 'stack-filter-inserter': 'bulk-inserter', 'filter-inserter': 'fast-inserter',
  'logistic-chest-passive-provider': 'passive-provider-chest', 'logistic-chest-active-provider': 'active-provider-chest',
  'logistic-chest-storage': 'storage-chest', 'logistic-chest-buffer': 'buffer-chest', 'logistic-chest-requester': 'requester-chest' };
const N2TO1 = { 'bulk-inserter': 'stack-inserter', 'passive-provider-chest': 'logistic-chest-passive-provider', 'active-provider-chest': 'logistic-chest-active-provider',
  'storage-chest': 'logistic-chest-storage', 'buffer-chest': 'logistic-chest-buffer', 'requester-chest': 'logistic-chest-requester' };
const ITEM_OF = { 'straight-rail': 'rail', 'legacy-straight-rail': 'rail', 'curved-rail': 'rail', 'legacy-curved-rail': 'rail', 'curved-rail-a': 'rail', 'curved-rail-b': 'rail', 'half-diagonal-rail': 'rail', 'elevated-straight-rail': 'rail', 'elevated-half-diagonal-rail': 'rail', 'elevated-curved-rail-a': 'rail', 'elevated-curved-rail-b': 'rail' };

const UNK = new Map();
function def(name) {
  const d = DEFS[name]; if (d) return d;
  let u = UNK.get(name);
  if (!u) {
    const rail = /rail/.test(name) && !/signal/.test(name);
    u = { name, label: name, cat: null, w: rail ? 2 : 1, h: rail ? 2 : 1, kind: rail ? 'legacyrail' : 'machine', color: '#6f747a', rot: true, unknown: 1 };
    UNK.set(name, u);
  }
  return u;
}
function sz(d, dir) { return ((dir | 0) % 8) === 4 ? [d.h, d.w] : [d.w, d.h]; }

// ----- versiones -----
const P48 = 2 ** 48, P32 = 2 ** 32, P16 = 2 ** 16;
const encVer = (a, b, c, d) => a * P48 + b * P32 + c * P16 + (d || 0);
function decVer(v) { if (typeof v !== 'number' || !isFinite(v) || v <= 0) return null; return [Math.floor(v / P48), Math.floor(v / P32) % 65536, Math.floor(v / P16) % 65536, v % 65536]; }
const verStr = v => { const p = decVer(v); return p ? p.slice(0, 3).join('.') : '¿?'; };
const VDEF = { 1: encVer(1, 1, 110), 2: encVer(2, 0, 28) };

// ----- códec -----
const TE = new TextEncoder(), TD = new TextDecoder();
const hasPako = () => typeof pako !== 'undefined' && !!pako.deflate && !!pako.inflate;
function b64enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function b64dec(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function viaStream(u8, Ctor) { const st = new Blob([u8]).stream().pipeThrough(new Ctor('deflate')); return new Uint8Array(await new Response(st).arrayBuffer()); }
// zlib con bloques sin comprimir: válido para Factorio y siempre síncrono (respaldo si pako no está)
function zlibStored(u8) {
  const n = u8.length, nb = Math.max(1, Math.ceil(n / 65535)), out = new Uint8Array(2 + n + nb * 5 + 4);
  let o = 0; out[o++] = 0x78; out[o++] = 0x01;
  for (let i = 0; i < nb; i++) {
    const st = i * 65535, len = Math.min(65535, n - st);
    out[o++] = i === nb - 1 ? 1 : 0; out[o++] = len & 255; out[o++] = len >>> 8; out[o++] = ~len & 255; out[o++] = (~len >>> 8) & 255;
    out.set(u8.subarray(st, st + len), o); o += len;
  }
  let a = 1, b = 0;
  for (let i = 0; i < n; i += 3800) { const e = Math.min(n, i + 3800); for (let j = i; j < e; j++) { a += u8[j]; b += a; } a %= 65521; b %= 65521; }
  out[o++] = b >>> 8; out[o++] = b & 255; out[o++] = a >>> 8; out[o++] = a & 255;
  return out;
}
function encodeSync(obj) { const u8 = TE.encode(JSON.stringify(obj)); return '0' + b64enc(hasPako() ? pako.deflate(u8, { level: 9 }) : zlibStored(u8)); }
async function encode(obj) {
  if (hasPako() || typeof CompressionStream === 'undefined') return encodeSync(obj);
  try { return '0' + b64enc(await viaStream(TE.encode(JSON.stringify(obj)), CompressionStream)); } catch (e) { return encodeSync(obj); }
}
function looksLikeString(t) { t = String(t || '').trim(); return /^0[A-Za-z0-9+/=\s]{20,}$/.test(t) || /^\{[\s\S]*"(blueprint|blueprint_book)"/.test(t); }
async function decode(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('No hay nada que importar.');
  if (t[0] === '{') { try { return JSON.parse(t); } catch (e) { throw new Error('El JSON no es válido: ' + e.message); } }
  t = t.replace(/\s+/g, '');
  if (t[0] !== '0') throw new Error('No parece un string de Factorio: debería empezar por «0».');
  let u8; try { u8 = b64dec(t.slice(1)); } catch (e) { throw new Error('El string está incompleto o tiene caracteres que no son Base64.'); }
  let json;
  try { json = hasPako() ? TD.decode(pako.inflate(u8)) : TD.decode(await viaStream(u8, DecompressionStream)); }
  catch (e) { throw new Error('No se pudo descomprimir. Comprueba que has copiado el string completo.'); }
  try { return JSON.parse(json); } catch (e) { throw new Error('El contenido descomprimido no es JSON válido.'); }
}

// ----- importar -----
function guessScheme(bp) {
  if (Array.isArray(bp.wires)) return 2;
  for (const e of bp.entities || []) { if (N1TO2[e.name]) return 1; if ((e.direction | 0) > 7) return 2; if (e.connections || e.neighbours) return 1; }
  return 2;
}
function conn1(num, conn, nb, add) {
  if (conn && typeof conn === 'object') for (const pt of Object.keys(conn)) {
    const val = conn[pt];
    if (pt === 'Cu0' || pt === 'Cu1') { for (const t of val || []) if (t && t.entity_id != null) add(num, pt === 'Cu1' ? 6 : 5, t.entity_id, 5); continue; }
    const out = pt === '2';
    for (const col of ['red', 'green']) for (const t of (val && val[col]) || []) {
      if (!t || t.entity_id == null) continue;
      const r = col === 'red';
      add(num, out ? (r ? 3 : 4) : (r ? 1 : 2), t.entity_id, t.circuit_id === 2 ? (r ? 3 : 4) : (r ? 1 : 2));
    }
  }
  if (Array.isArray(nb)) for (const n of nb) add(num, 5, n, 5);
}
const META_KEYS = ['item', 'label', 'description', 'icons', 'entities', 'tiles', 'version', 'wires', 'schedules', 'stock_connections'];
function parseBlueprint(bp) {
  const v = typeof bp.version === 'number' ? bp.version : null;
  const pv = decVer(v);
  const scheme = pv ? (pv[0] >= 2 ? 2 : 1) : guessScheme(bp);
  const ents = [], wires = [], seen = new Set();
  const add = (a, ca, b, cb) => { const k1 = a + ':' + ca, k2 = b + ':' + cb, k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (!seen.has(k)) { seen.add(k); wires.push([a, ca, b, cb]); } };
  let auto = 1e9;
  for (const raw of bp.entities || []) {
    if (!raw || typeof raw !== 'object' || !raw.name || !raw.position) continue;
    const { entity_number, name, position, direction, connections, neighbours, ...rest } = raw;
    const num = entity_number != null ? entity_number : auto++;
    let nm = name, n1 = null;
    if (scheme === 1 && N1TO2[name]) { nm = N1TO2[name]; n1 = name; }
    let dir = typeof direction === 'number' ? direction : 0;
    if (scheme === 1) dir = (dir * 2) % 16;
    if (scheme === 1 && (name === 'curved-rail' || (name === 'straight-rail' && (direction | 0) % 2 === 1))) { nm = 'legacy-' + name; n1 = name; }
    if (typeof rest.orientation === 'number') dir = Math.round(rest.orientation * 16) % 16;
    { const rtp = DEFS[nm] && DEFS[nm].rt; if (rtp === 'S' || rtp === 'H') dir %= 8; }
    ents.push({ num, name: nm, n1, x: +position.x || 0, y: +position.y || 0, dir, xs: scheme, extra: rest });
    if (scheme === 1) conn1(num, connections, neighbours, add);
  }
  if (Array.isArray(bp.wires)) for (const w of bp.wires) if (Array.isArray(w) && w.length >= 4) add(w[0], w[1], w[2], w[3]);
  const tiles = [];
  for (const t of bp.tiles || []) if (t && t.name && t.position) tiles.push({ x: Math.round(t.position.x), y: Math.round(t.position.y), name: t.name });
  const extraBp = {};
  for (const k of Object.keys(bp)) if (!META_KEYS.includes(k)) extraBp[k] = bp[k];
  return { ents, wires, tiles, meta: { label: bp.label || '', description: bp.description || '', icons: Array.isArray(bp.icons) && bp.icons.length ? bp.icons : null,
    version: v, scheme, extraBp, schedules: Array.isArray(bp.schedules) ? bp.schedules : null, stock: Array.isArray(bp.stock_connections) ? bp.stock_connections : null } };
}
function flattenBook(book, prefix, out) {
  out = out || []; prefix = prefix || '';
  const list = (book.blueprints || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const en of list) {
    if (en.blueprint) out.push({ label: prefix + (en.blueprint.label || 'Plano sin nombre'), bp: en.blueprint, n: (en.blueprint.entities || []).length });
    else if (en.blueprint_book) flattenBook(en.blueprint_book, prefix + (en.blueprint_book.label || 'Libro') + ' / ', out);
  }
  return out;
}

// ----- exportar -----
function modInv(name) { const d = DEFS[name]; if (d && d.kind === 'drill') return 2; if (name === 'lab' || name === 'biolab') return 3; if (name === 'beacon') return 1; return 4; }
function items1to2(items, ename) {
  if (!items || Array.isArray(items) || typeof items !== 'object') return items;
  const out = [], next = {};
  for (const [it, cnt] of Object.entries(items)) {
    const inv = /module/.test(it) ? modInv(ename) : 1;
    const st = [];
    if (inv !== 1) for (let i = 0; i < cnt; i++) { next[inv] = (next[inv] ?? -1) + 1; st.push({ inventory: inv, stack: next[inv] }); }
    else { next[inv] = (next[inv] ?? -1) + 1; st.push({ inventory: inv, stack: next[inv], count: cnt }); }
    out.push({ id: { name: it }, items: { in_inventory: st } });
  }
  return out;
}
function items2to1(items) {
  if (!Array.isArray(items)) return items;
  const out = {};
  for (const it of items) { const nm = it && it.id && it.id.name; if (!nm) continue; let c = 0; for (const s of (it.items && it.items.in_inventory) || []) c += s.count || 1; out[nm] = (out[nm] || 0) + (c || 1); }
  return out;
}
function convExtra(e, T) {
  const x = e.extra ? JSON.parse(JSON.stringify(e.extra)) : {};
  const F = e.xs || 2; if (F === T) return x;
  const d = DEFS[e.name] || {};
  if (x.items != null) x.items = F === 1 ? items1to2(x.items, e.name) : items2to1(x.items);
  if (d.kind === 'split' && x.filter != null) { if (F === 1 && typeof x.filter === 'string') x.filter = { name: x.filter }; else if (F === 2 && typeof x.filter === 'object') x.filter = x.filter.name; }
  if (Array.isArray(x.filters)) {
    if (F === 1) { if (e.n1 === 'filter-inserter' || e.n1 === 'stack-filter-inserter') x.use_filters = true; }
    else x.filters = x.filters.filter(f => f && f.name).map(f => ({ index: f.index, name: f.name }));
  }
  return x;
}
function wires1(out, W) {
  const isSw = e => /power-switch/.test(e.name), isComb = e => /(arithmetic|decider|selector)-combinator/.test(e.name);
  const cu = (E, c, t) => { E.connections = E.connections || {}; const k = c === 6 ? 'Cu1' : 'Cu0'; (E.connections[k] = E.connections[k] || []).push({ entity_id: t, wire_id: 0 }); };
  const nb = (E, t) => { E.neighbours = E.neighbours || []; if (!E.neighbours.includes(t)) E.neighbours.push(t); };
  const ci = (E, c, Tg, tn, tc) => {
    const pt = c >= 3 ? '2' : '1', col = (c === 1 || c === 3) ? 'red' : 'green';
    E.connections = E.connections || {}; const P = E.connections[pt] = E.connections[pt] || {}; const L = P[col] = P[col] || [];
    const o = { entity_id: tn }; if (isComb(Tg)) o.circuit_id = tc >= 3 ? 2 : 1; L.push(o);
  };
  for (const [a, ca, b, cb] of W) {
    const A = out[a - 1], Bn = out[b - 1]; if (!A || !Bn) continue;
    if (ca >= 5 || cb >= 5) { if (isSw(A)) cu(A, ca, b); else if (isSw(Bn)) cu(Bn, cb, a); else { nb(A, b); nb(Bn, a); } }
    else { ci(A, ca, Bn, b, cb); ci(Bn, cb, A, a, ca); }
  }
}
function iconsFor(ents, tiles, keep, T) {
  if (Array.isArray(keep) && keep.length) return keep.map(ic => { const o = JSON.parse(JSON.stringify(ic)); if (T === 1 && o.signal && !o.signal.type) o.signal.type = 'item'; return o; });
  const cnt = new Map();
  for (const e of ents) { let it = ITEM_OF[e.name] || e.name; if (T === 1) it = e.n1 || N2TO1[it] || it; cnt.set(it, (cnt.get(it) || 0) + 1); }
  if (!cnt.size) for (const t of tiles || []) { const it = tileDef(t.name).item; cnt.set(it, (cnt.get(it) || 0) + 1); }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name], i) => ({ signal: { type: 'item', name }, index: i + 1 }));
}
function mapSched(arr, fn) {
  if (!Array.isArray(arr)) return null; const out = [];
  for (const s of arr) { const l = (s.locomotives || []).map(fn).filter(x => x != null); if (l.length) out.push(Object.assign({}, s, { locomotives: l })); }
  return out.length ? out : null;
}
function mapStock(arr, fn) {
  if (!Array.isArray(arr)) return null; const out = [];
  for (const s of arr) { const st = fn(s.stock); if (st == null) continue; const o = Object.assign({}, s, { stock: st });
    for (const k of ['front', 'back']) if (s[k] != null) { const v = fn(s[k]); if (v == null) delete o[k]; else o[k] = v; }
    out.push(o); }
  return out.length ? out : null;
}
// o = { ents:[{id,name,n1,x,y,dir,xs,extra}], wires:[[idA,cA,idB,cB]], tiles:[{x,y,name}], meta, target }
function buildBlueprint(o) {
  const T = o.target === 1 ? 1 : 2, meta = o.meta || {}, ents = o.ents || [], tiles = o.tiles || [];
  const bp = { item: 'blueprint' };
  if (meta.label) bp.label = meta.label;
  if (meta.description) bp.description = meta.description;
  const icons = iconsFor(ents, tiles, meta.icons, T); if (icons.length) bp.icons = icons;
  const numOf = new Map(); ents.forEach((e, i) => numOf.set(e.id, i + 1));
  const out = ents.map((e, i) => {
    const x = convExtra(e, T);
    let name = e.name;
    if (T === 1) {
      name = e.n1 || N2TO1[e.name] || e.name;
      if (!e.n1 && x.use_filters && (e.name === 'fast-inserter' || e.name === 'bulk-inserter')) name = e.name === 'fast-inserter' ? 'filter-inserter' : 'stack-filter-inserter';
      delete x.use_filters;
    }
    const r = { entity_number: i + 1, name, position: { x: e.x, y: e.y } };
    if (DEFS[e.name] && DEFS[e.name].kind === 'train') { const keep = typeof x.orientation === 'number' && Math.round(x.orientation * 16) % 16 === (e.dir | 0); x.orientation = keep ? x.orientation : (e.dir | 0) / 16; return Object.assign(r, x); }
    let dir = e.dir | 0; if (T === 1) dir = Math.round(dir / 2) % 8;
    if (dir) r.direction = dir;
    return Object.assign(r, x);
  });
  const W = [];
  for (const w of o.wires || []) { const a = numOf.get(w[0]), b = numOf.get(w[2]); if (a && b) W.push([a, w[1], b, w[3]]); }
  if (T === 2) { if (W.length) bp.wires = W; } else wires1(out, W);
  if (out.length) bp.entities = out;
  if (tiles.length) bp.tiles = tiles.map(t => ({ position: { x: t.x, y: t.y }, name: t.name }));
  const fn = id => numOf.has(id) ? numOf.get(id) : null;
  const sc = mapSched(meta.schedules, fn); if (sc) bp.schedules = sc;
  const sk = mapStock(meta.stock, fn); if (sk) bp.stock_connections = sk;
  Object.assign(bp, meta.extraBp || {});
  bp.version = (meta.version && meta.scheme === T) ? meta.version : VDEF[T];
  return { blueprint: bp };
}
// conexiones de fluido y calor sacadas de los datos del juego; las de PORTCOND solo se usan con recetas de fluidos
const PORTS = {"storage-tank":[[-1,-1,0,2,0],[1,1,4,2,0],[1,1,8,2,0],[-1,-1,12,2,0]],"pump":[[0,-0.5,0,1,0],[0,0.5,8,0,0]],"boiler":[[-1,0.5,12,2,0],[1,0.5,4,2,0],[0,-0.5,0,1,0]],"steam-engine":[[0,2,8,2,0],[0,-2,0,2,0]],"nuclear-reactor":[[-2,-2,0,2,1],[0,-2,0,2,1],[2,-2,0,2,1],[2,-2,4,2,1],[2,0,4,2,1],[2,2,4,2,1],[2,2,8,2,1],[0,2,8,2,1],[-2,2,8,2,1],[-2,2,12,2,1],[-2,0,12,2,1],[-2,-2,12,2,1]],"heat-exchanger":[[-1,0.5,12,2,0],[1,0.5,4,2,0],[0,-0.5,0,1,0],[0,0.5,8,2,1]],"steam-turbine":[[0,2,8,2,0],[0,-2,0,2,0]],"fusion-reactor":[[-2.5,-1.5,12,2,0],[-2.5,1.5,12,2,0],[2.5,-1.5,4,2,0],[2.5,1.5,4,2,0],[-1.5,2.5,8,2,0],[1.5,2.5,8,2,0],[-1.5,-2.5,0,2,0],[1.5,-2.5,0,2,0]],"fusion-generator":[[-1,2,8,0,0],[1,2,8,0,0],[0,-2,0,1,0],[-1,0,12,1,0],[1,0,4,1,0],[-1,-1,12,1,0],[1,-1,4,1,0],[-1,-2,0,1,0],[1,-2,0,1,0]],"electric-mining-drill":[[-1,0,12,2,0],[1,0,4,2,0],[0,1,8,2,0]],"big-mining-drill":[[-2,-1,12,2,0],[2,-1,4,2,0],[1,2,8,2,0],[-1,2,8,2,0]],"offshore-pump":[[0,0,8,1,0]],"foundry":[[-1,2,8,0,0],[1,2,8,0,0],[-1,-2,0,1,0],[1,-2,0,1,0]],"biochamber":[[-1,-1,0,0,0],[1,-1,0,0,0],[1,1,8,1,0],[-1,1,8,1,0]],"assembling-machine-2":[[0,-1,0,0,0],[0,1,8,1,0]],"assembling-machine-3":[[0,-1,0,0,0],[0,1,8,1,0]],"oil-refinery":[[-1,2,8,0,0],[1,2,8,0,0],[-2,-2,0,1,0],[0,-2,0,1,0],[2,-2,0,1,0]],"chemical-plant":[[-1,-1,0,0,0],[1,-1,0,0,0],[-1,1,8,1,0],[1,1,8,1,0]],"electromagnetic-plant":[[-1.5,0.5,12,2,0],[1.5,-0.5,4,2,0],[0.5,1.5,8,2,0],[-0.5,-1.5,0,2,0]],"cryogenic-plant":[[-2,2,8,0,0],[0,2,8,0,0],[2,2,8,0,0],[-2,-2,0,1,0],[0,-2,0,1,0],[2,-2,0,1,0]],"heating-tower":[[0,-1,0,2,1],[1,0,4,2,1],[0,1,8,2,1],[-1,0,12,2,1]],"thruster":[[-1.5,-2,12,2,0],[1.5,0,4,2,0],[1.5,-2,4,2,0],[-1.5,0,12,2,0]],"flamethrower-turret":[[-0.5,1,12,2,0],[0.5,1,4,2,0]],"pumpjack":[[0,0,0,1,0,[[1,-1],[1,1],[-1,1],[-1,-1]]]]};
const PORTCOND = new Set(["assembling-machine-2", "assembling-machine-3", "big-mining-drill", "biochamber", "cryogenic-plant", "electric-mining-drill", "electromagnetic-plant", "foundry"]);
function recipeName(r) { return RECIPE_ES[r] || String(r).replace(/-/g, ' '); }

return { PORTS, PORTCOND, DEFS, CATS, TILES, RECIPES, N1TO2, N2TO1, def, sz, tileDef, encVer, decVer, verStr, VDEF, hasPako, encode, encodeSync, decode, looksLikeString,
  parseBlueprint, buildBlueprint, flattenBook, mapSched, mapStock, recipeName };
})();

export default BP;
