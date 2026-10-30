import { deflate, inflate } from 'pako';
import { MACHINE_CATS, RECIPE_LIST, GAME_VERSION } from './gamedata.js';

const pako = { deflate, inflate };

/* ===== Núcleo: definiciones, códec y conversión de planos (sin DOM) ===== */
export const BP = (() => {
const DEFS = {};
const CATS = [['belts','Cintas'],['trains','Trenes'],['ins','Insertadores'],['store','Almacenaje'],['fluid','Fluidos'],['power','Energía'],['prod','Producción'],['logic','Robots y circuitos'],['def','Defensa'],['vehicles','Vehículos'],['space','Espacio y carga'],['editor','Ocultos y modo editor'],['tiles','Suelos']];
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
D('cargo-landing-pad','Plataforma de aterrizaje de carga','space',8,8,'machine','#5f6b75',{g:'rocket',ab:'Plataforma de aterrizaje'});
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
D('artillery-wagon','Vagón de artillería','trains',2,5,'train','#66734f',{g2:1});
D('half-diagonal-rail','Vía en media diagonal',null,2,2,'rail','#8a7660',{g2:1,rt:'H'});
D('curved-rail-a','Curva de vía (A)',null,2,2,'rail','#8a7660',{g2:1,rt:'A'});
D('curved-rail-b','Curva de vía (B)',null,2,2,'rail','#8a7660',{g2:1,rt:'B'});
for (const t of ['straight-rail', 'half-diagonal-rail', 'curved-rail-a', 'curved-rail-b']) D('elevated-' + t, DEFS[t].label + ' elevada', t === 'straight-rail' ? 'trains' : null, 2, 2, 'rail', '#9c8d7a', { g2: 1, rt: DEFS[t].rt, elev: 1, sa: 1 });
D('rail-ramp','Rampa de vía','trains',4,16,'machine','#7a7166',{g:'rocket',sa:1,g2:1});
D('rail-support','Soporte de vía','trains',3,3,'machine','#7a7166',{g:'tower',sa:1,g2:1});
D('legacy-straight-rail','Vía recta de 1.1',null,2,2,'legacyrail','#6b6b6b',{g2:1});
D('legacy-curved-rail','Curva de vía de 1.1',null,4,4,'legacyrail','#6b6b6b',{g2:1});
// ocultos en el juego normal, pero válidos en planos (modo editor, mapas de pruebas y bancos de rendimiento de megabases)
D('loader','Cargador','editor',1,2,'machine',Y,{g:'gear'});
D('fast-loader','Cargador rápido','editor',1,2,'machine',R,{g:'gear'});
D('express-loader','Cargador exprés','editor',1,2,'machine',B,{g:'gear'});
D('turbo-loader','Cargador turbo','editor',1,2,'machine',G,{g:'gear',sa:1});
D('linked-belt','Cinta enlazada','editor',1,1,'belt','#8a8a8a');
D('infinity-chest','Cofre infinito','editor',1,1,'chest','#c552b8',{rot:false});
D('linked-chest','Cofre enlazado','editor',1,1,'chest','#5aa0a0',{rot:false});
D('infinity-pipe','Tubería infinita','editor',1,1,'pipe','#c552b8',{rot:false,fluid:1});
D('heat-interface','Interfaz de calor','editor',1,1,'machine','#c95f3a',{rot:false,g:'flame',heat:1});
D('electric-energy-interface','Interfaz de energía eléctrica','editor',2,2,'machine','#6f5aa5',{rot:false,g:'bolt',ab:'Energía infinita'});
D('lane-splitter','Divisor de carriles','editor',1,1,'machine','#8a8a8a',{g:'gear'});
D('bottomless-chest','Cofre sin fondo','editor',1,1,'chest','#4a4f57',{rot:false});
D('proxy-container','Contenedor intermediario','editor',1,1,'chest','#6f8c8c',{rot:false});
D('one-way-valve','Válvula antirretorno','editor',1,1,'machine','#5f86a8',{g:'drop',fluid:1});
D('overflow-valve','Válvula de desbordamiento','editor',1,1,'machine','#5f86a8',{g:'drop',fluid:1});
D('top-up-valve','Válvula de relleno','editor',1,1,'machine','#5f86a8',{g:'drop',fluid:1});
D('burner-generator','Generador de combustión','editor',3,5,'machine','#8e7a5a',{g:'bolt',ab:'Gen. combustión'});
D('infinity-cargo-wagon','Vagón de carga infinito','editor',2,5,'train','#c552b8',{g2:1});
// vehículos: en 2.0 se guardan en los planos con su orientación, como el material rodante
D('car','Coche','vehicles',2,2,'vehicle','#c0563c');
D('tank','Tanque','vehicles',2,3,'vehicle','#6b7a45');
D('spidertron','Spidertron','vehicles',3,3,'vehicle','#5a6470',{spider:1});
// las máquinas que guardan receta en el plano salen de los datos del juego
for (const n of Object.keys(MACHINE_CATS)) if (DEFS[n]) DEFS[n].recipe = 1;

const TILES = {
  'stone-path': { label: 'Camino de piedra', color: '#8a7c63', item: 'stone-brick' },
  'concrete': { label: 'Hormigón', color: '#9b9a92', item: 'concrete' },
  'hazard-concrete-left': { label: 'Hormigón de peligro', color: '#cfa032', item: 'hazard-concrete', hz: 1 },
  'refined-concrete': { label: 'Hormigón refinado', color: '#5b6670', item: 'refined-concrete' },
  'refined-hazard-concrete-left': { label: 'Hormigón refinado de peligro', color: '#bf8a2a', item: 'refined-hazard-concrete', hz: 1 },
  'landfill': { label: 'Relleno', color: '#6f5c3c', item: 'landfill' },
  'foundation': { label: 'Cimentación', color: '#4f5458', item: 'foundation', sa: 1 },
  'space-platform-foundation': { label: 'Cimentación de plataforma espacial', color: '#5c6670', item: 'space-platform-foundation', sa: 1 },
  'ice-platform': { label: 'Plataforma de hielo', color: '#9fc7d8', item: 'ice-platform', sa: 1 },
  'artificial-yumako-soil': { label: 'Suelo artificial de yumako', color: '#8c4a5e', item: 'artificial-yumako-soil', sa: 1 },
  'overgrowth-yumako-soil': { label: 'Suelo frondoso de yumako', color: '#a3566c', item: 'overgrowth-yumako-soil', sa: 1 },
  'artificial-jellynut-soil': { label: 'Suelo artificial de gelinuez', color: '#7a5aa0', item: 'artificial-jellynut-soil', sa: 1 },
  'overgrowth-jellynut-soil': { label: 'Suelo frondoso de gelinuez', color: '#8c68b8', item: 'overgrowth-jellynut-soil', sa: 1 },
};
function tileDef(n) {
  if (TILES[n]) return TILES[n];
  if (/hazard/.test(n)) { const r = /refined/.test(n); return { label: n, color: r ? '#bf8a2a' : '#cfa032', item: r ? 'refined-hazard-concrete' : 'hazard-concrete', hz: 1 }; }
  return { label: n, color: '#787878', item: n };
}
// nombres en español de las recetas que no se llaman como un edificio o un suelo de la paleta
const RECIPE_ES = {
  rail: 'Raíl', 'casting-pipe': 'Moldeo de tubería', 'casting-pipe-to-ground': 'Moldeo de tubería subterránea', 'logistic-robot': 'Robot logístico', 'construction-robot': 'Robot de construcción',
  concrete: 'Hormigón', 'hazard-concrete': 'Hormigón de peligro', 'refined-concrete': 'Hormigón refinado', 'refined-hazard-concrete': 'Hormigón refinado de peligro', satellite: 'Satélite',
  'basic-oil-processing': 'Refinado básico de petróleo', 'advanced-oil-processing': 'Refinado avanzado de petróleo', 'coal-liquefaction': 'Licuefacción de carbón', 'simple-coal-liquefaction': 'Licuefacción simple de carbón',
  'heavy-oil-cracking': 'Craqueo de petróleo pesado a ligero', 'light-oil-cracking': 'Craqueo de petróleo ligero a gas', 'solid-fuel-from-petroleum-gas': 'Combustible sólido de gas de petróleo',
  'solid-fuel-from-light-oil': 'Combustible sólido de petróleo ligero', 'solid-fuel-from-heavy-oil': 'Combustible sólido de petróleo pesado', lubricant: 'Lubricante', 'sulfuric-acid': 'Ácido sulfúrico',
  'acid-neutralisation': 'Neutralización de ácido', 'steam-condensation': 'Condensación de vapor', 'ice-melting': 'Fusión de hielo', 'plastic-bar': 'Barra de plástico', sulfur: 'Azufre', battery: 'Batería',
  explosives: 'Explosivos', carbon: 'Carbono', 'coal-synthesis': 'Síntesis de carbón', barrel: 'Barril',
  'iron-gear-wheel': 'Engranaje de hierro', 'iron-stick': 'Barra de hierro', 'copper-cable': 'Cable de cobre', 'electronic-circuit': 'Circuito electrónico (verde)', 'advanced-circuit': 'Circuito avanzado (rojo)',
  'processing-unit': 'Unidad de procesamiento (azul)', 'engine-unit': 'Motor', 'electric-engine-unit': 'Motor eléctrico', 'flying-robot-frame': 'Estructura de robot volador', 'low-density-structure': 'Estructura de baja densidad',
  'rocket-fuel': 'Combustible para cohetes', 'rocket-part': 'Parte de cohete', 'uranium-processing': 'Procesamiento de uranio', 'uranium-fuel-cell': 'Celda de combustible de uranio',
  'nuclear-fuel-reprocessing': 'Reprocesamiento de combustible nuclear', 'kovarex-enrichment-process': 'Enriquecimiento Kovarex', 'nuclear-fuel': 'Combustible nuclear',
  'molten-iron-from-lava': 'Hierro fundido a partir de lava', 'molten-copper-from-lava': 'Cobre fundido a partir de lava', 'iron-ore-melting': 'Fundición de mineral de hierro', 'copper-ore-melting': 'Fundición de mineral de cobre',
  'casting-iron': 'Moldeo de placa de hierro', 'casting-copper': 'Moldeo de placa de cobre', 'casting-steel': 'Moldeo de placa de acero', 'casting-iron-gear-wheel': 'Moldeo de engranaje de hierro',
  'casting-iron-stick': 'Moldeo de barra de hierro', 'casting-low-density-structure': 'Moldeo de estructura de baja densidad', 'concrete-from-molten-iron': 'Hormigón a partir de hierro fundido', 'casting-copper-cable': 'Moldeo de cable de cobre',
  'tungsten-carbide': 'Carburo de wolframio', 'tungsten-plate': 'Placa de wolframio', 'holmium-solution': 'Solución de holmio', 'holmium-plate': 'Placa de holmio', superconductor: 'Superconductor', electrolyte: 'Electrolito', supercapacitor: 'Supercondensador',
  'yumako-processing': 'Procesamiento de yumako', 'jellynut-processing': 'Procesamiento de gelinuez', 'iron-bacteria': 'Bacterias de hierro', 'iron-bacteria-cultivation': 'Cultivo de bacterias de hierro',
  'copper-bacteria': 'Bacterias de cobre', 'copper-bacteria-cultivation': 'Cultivo de bacterias de cobre', 'nutrients-from-spoilage': 'Nutrientes a partir de descomposición', 'nutrients-from-yumako-mash': 'Nutrientes a partir de puré de yumako',
  'nutrients-from-bioflux': 'Nutrientes a partir de bioflujo', 'pentapod-egg': 'Huevo de pentápodo', 'rocket-fuel-from-jelly': 'Combustible para cohetes a partir de gelatina', biolubricant: 'Biolubricante', bioplastic: 'Bioplástico',
  biosulfur: 'Bioazufre', bioflux: 'Bioflujo', 'burnt-spoilage': 'Descomposición quemada', 'carbon-fiber': 'Fibra de carbono', 'biter-egg': 'Huevo de mordedor', 'tree-seed': 'Semilla de árbol', 'fish-breeding': 'Cría de peces',
  'nutrients-from-fish': 'Nutrientes a partir de pescado', 'nutrients-from-biter-egg': 'Nutrientes a partir de huevo de mordedor', 'ammoniacal-solution-separation': 'Separación de solución amoniacal',
  'solid-fuel-from-ammonia': 'Combustible sólido a partir de amoníaco', 'ammonia-rocket-fuel': 'Combustible para cohetes de amoníaco', fluoroketone: 'Fluorocetona', 'fluoroketone-cooling': 'Enfriamiento de fluorocetona',
  lithium: 'Litio', 'quantum-processor': 'Procesador cuántico', 'fusion-power-cell': 'Celda de energía de fusión',
  'automation-science-pack': 'Ciencia de automatización (roja)', 'logistic-science-pack': 'Ciencia logística (verde)', 'military-science-pack': 'Ciencia militar (gris)', 'chemical-science-pack': 'Ciencia química (azul)',
  'production-science-pack': 'Ciencia de producción (morada)', 'utility-science-pack': 'Ciencia de utilidad (amarilla)', 'space-science-pack': 'Ciencia espacial (blanca)', 'metallurgic-science-pack': 'Ciencia metalúrgica',
  'agricultural-science-pack': 'Ciencia agrícola', 'electromagnetic-science-pack': 'Ciencia electromagnética', 'cryogenic-science-pack': 'Ciencia criogénica', 'promethium-science-pack': 'Ciencia de prometio',
  'space-platform-starter-pack': 'Paquete inicial de plataforma espacial', 'metallic-asteroid-crushing': 'Trituración de asteroide metálico', 'carbonic-asteroid-crushing': 'Trituración de asteroide carbónico',
  'oxide-asteroid-crushing': 'Trituración de asteroide de óxido', 'metallic-asteroid-reprocessing': 'Reprocesado de asteroide metálico', 'carbonic-asteroid-reprocessing': 'Reprocesado de asteroide carbónico',
  'oxide-asteroid-reprocessing': 'Reprocesado de asteroide de óxido', 'advanced-metallic-asteroid-crushing': 'Trituración avanzada de asteroide metálico', 'advanced-carbonic-asteroid-crushing': 'Trituración avanzada de asteroide carbónico',
  'advanced-oxide-asteroid-crushing': 'Trituración avanzada de asteroide de óxido', 'thruster-fuel': 'Combustible de propulsor', 'advanced-thruster-fuel': 'Combustible de propulsor avanzado',
  'thruster-oxidizer': 'Oxidante de propulsor', 'advanced-thruster-oxidizer': 'Oxidante de propulsor avanzado',
  'solar-panel-equipment': 'Panel solar portátil', 'fission-reactor-equipment': 'Reactor de fisión portátil', 'fusion-reactor-equipment': 'Reactor de fusión portátil', 'battery-equipment': 'Batería personal',
  'battery-mk2-equipment': 'Batería personal MK2', 'battery-mk3-equipment': 'Batería personal MK3', 'belt-immunity-equipment': 'Inmunidad a cintas', 'exoskeleton-equipment': 'Exoesqueleto',
  'personal-roboport-equipment': 'Roboport personal', 'personal-roboport-mk2-equipment': 'Roboport personal MK2', 'night-vision-equipment': 'Visión nocturna', 'toolbelt-equipment': 'Cinturón de herramientas',
  'energy-shield-equipment': 'Escudo de energía', 'energy-shield-mk2-equipment': 'Escudo de energía MK2', 'personal-laser-defense-equipment': 'Defensa láser personal', 'discharge-defense-equipment': 'Defensa de descarga',
  'artillery-shell': 'Proyectil de artillería', 'atomic-bomb': 'Bomba atómica', 'cannon-shell': 'Proyectil de cañón', 'capture-robot-rocket': 'Cohete con robot de captura', 'cliff-explosives': 'Explosivos para acantilados',
  'cluster-grenade': 'Granada de racimo', 'combat-shotgun': 'Escopeta de combate', 'defender-capsule': 'Cápsula de defensor', 'destroyer-capsule': 'Cápsula de destructor', 'distractor-capsule': 'Cápsula de distractor',
  'explosive-cannon-shell': 'Proyectil de cañón explosivo', 'explosive-rocket': 'Cohete explosivo', 'explosive-uranium-cannon-shell': 'Proyectil de cañón de uranio explosivo', 'firearm-magazine': 'Cargador de munición',
  flamethrower: 'Lanzallamas', 'flamethrower-ammo': 'Munición de lanzallamas', grenade: 'Granada', 'heavy-armor': 'Armadura pesada', 'light-armor': 'Armadura ligera', 'mech-armor': 'Armadura mecánica',
  'modular-armor': 'Armadura modular', 'piercing-rounds-magazine': 'Cargador de munición perforante', 'piercing-shotgun-shell': 'Cartucho de escopeta perforante', 'poison-capsule': 'Cápsula de veneno',
  'power-armor': 'Armadura de energía', 'power-armor-mk2': 'Armadura de energía MK2', railgun: 'Cañón de riel', 'railgun-ammo': 'Munición de cañón de riel', 'repair-pack': 'Kit de reparación', rocket: 'Cohete',
  'rocket-launcher': 'Lanzacohetes', shotgun: 'Escopeta', 'shotgun-shell': 'Cartucho de escopeta', 'slowdown-capsule': 'Cápsula ralentizadora', 'submachine-gun': 'Subfusil', 'tesla-ammo': 'Munición Tesla',
  teslagun: 'Pistola Tesla', 'uranium-cannon-shell': 'Proyectil de cañón de uranio', 'uranium-rounds-magazine': 'Cargador de munición de uranio',
  'speed-module': 'Módulo de velocidad', 'productivity-module': 'Módulo de productividad', 'efficiency-module': 'Módulo de eficiencia', 'quality-module': 'Módulo de calidad',
};
const FLUID_ES = { water: 'agua', 'crude-oil': 'petróleo crudo', 'heavy-oil': 'petróleo pesado', 'light-oil': 'petróleo ligero', 'petroleum-gas': 'gas de petróleo', lubricant: 'lubricante', 'sulfuric-acid': 'ácido sulfúrico', 'fluoroketone-hot': 'fluorocetona caliente', 'fluoroketone-cold': 'fluorocetona fría' };
function recipeName(r) {
  r = String(r); if (RECIPE_ES[r]) return RECIPE_ES[r];
  const tier = /^(.*-module)-(\d)$/.exec(r); if (tier && RECIPE_ES[tier[1]]) return RECIPE_ES[tier[1]] + ' ' + tier[2];
  const bar = /^(empty-)?(.+)-barrel$/.exec(r); if (bar && FLUID_ES[bar[2]]) return (bar[1] ? 'Vaciar barril de ' : 'Llenar barril de ') + FLUID_ES[bar[2]];
  if (DEFS[r] && DEFS[r].cat) return DEFS[r].label; if (TILES[r]) return TILES[r].label;
  return r.replace(/-/g, ' ');
}
const RECIPE_INFO = new Map(RECIPE_LIST.map(([n, cats, sa], i) => [n, { cats, sa: !!sa, i }]));
/** Todas las recetas que alguna máquina puede fabricar, en el orden de la Factoriopedia: [nombre, nombre en español]. */
const RECIPES = RECIPE_LIST.map(([n]) => [n, recipeName(n)]);
const RFOR = new Map();
/** Recetas que puede fabricar una máquina (null si no guarda receta): [{ name, label, sa }]. */
function recipesFor(machine) {
  const cats = MACHINE_CATS[machine]; if (!cats) return null;
  let l = RFOR.get(machine);
  if (!l) { l = RECIPE_LIST.filter(r => r[1].some(c => cats.includes(c))).map(([name, , sa]) => ({ name, label: recipeName(name), sa: !!sa })); RFOR.set(machine, l); }
  return l;
}
/** true si la máquina puede fabricar la receta, false si no, null si no se sabe (máquina o receta de un mod). */
function canCraft(machine, recipe) {
  const cats = MACHINE_CATS[machine], r = RECIPE_INFO.get(recipe);
  if (!cats || !r) return null;
  return r.cats.some(c => cats.includes(c));
}

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
// plano decodificado ({ blueprint }) llevado al esquema T (1 = 1.1, 2 = 2.0); si ya lo es, se devuelve tal cual
function convertBlueprint(obj, T) {
  T = T === 1 ? 1 : 2;
  if (!obj || !obj.blueprint) return obj;
  const p = parseBlueprint(obj.blueprint);
  if (p.meta.scheme === T) return obj;
  return buildBlueprint({ ents: p.ents.map(e => Object.assign({ id: e.num }, e)), wires: p.wires, tiles: p.tiles, meta: p.meta, target: T });
}
// libro de planos con hijos { blueprint } o { blueprint_book }; los planos de otro esquema se convierten a T
function buildBook(label, children, target, description) {
  const T = target === 1 ? 1 : 2, book = { item: 'blueprint-book' };
  if (label) book.label = label;
  if (description) book.description = description;
  book.blueprints = (children || []).filter(c => c && (c.blueprint || c.blueprint_book))
    .map((c, i) => Object.assign({ index: i }, c.blueprint ? convertBlueprint({ blueprint: c.blueprint }, T) : { blueprint_book: c.blueprint_book }));
  book.active_index = 0;
  book.version = VDEF[T];
  return { blueprint_book: book };
}
// cuadrícula de ajuste del plano (snap-to-grid): { w, h, abs, ox, oy } o null
function getSnap(extraBp) {
  const g = extraBp && extraBp['snap-to-grid'];
  if (!g || !(g.x > 0) || !(g.y > 0)) return null;
  const r = extraBp['position-relative-to-grid'] || {};
  return { w: g.x | 0, h: g.y | 0, abs: !!extraBp['absolute-snapping'], ox: r.x | 0, oy: r.y | 0 };
}
function setSnap(extraBp, snap) {
  const x = Object.assign({}, extraBp || {});
  delete x['snap-to-grid']; delete x['absolute-snapping']; delete x['position-relative-to-grid'];
  if (snap && snap.w > 0 && snap.h > 0) {
    x['snap-to-grid'] = { x: Math.min(10000, snap.w | 0), y: Math.min(10000, snap.h | 0) };
    if (snap.abs) {
      x['absolute-snapping'] = true;
      const ox = ((snap.ox | 0) % snap.w + snap.w) % snap.w, oy = ((snap.oy | 0) % snap.h + snap.h) % snap.h;
      if (ox || oy) x['position-relative-to-grid'] = { x: ox, y: oy };
    }
  }
  return x;
}
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
    if (DEFS[e.name] && (DEFS[e.name].kind === 'train' || DEFS[e.name].kind === 'vehicle')) { const keep = typeof x.orientation === 'number' && Math.round(x.orientation * 16) % 16 === (e.dir | 0); x.orientation = keep ? x.orientation : (e.dir | 0) / 16; return Object.assign(r, x); }
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

return { PORTS, PORTCOND, DEFS, CATS, TILES, RECIPES, N1TO2, N2TO1, def, sz, tileDef, encVer, decVer, verStr, VDEF, hasPako, encode, encodeSync, decode, looksLikeString,
  parseBlueprint, buildBlueprint, flattenBook, convertBlueprint, buildBook, getSnap, setSnap, mapSched, mapStock, recipeName, recipesFor, canCraft, MACHINE_CATS, GAME_VERSION };
})();

export default BP;
