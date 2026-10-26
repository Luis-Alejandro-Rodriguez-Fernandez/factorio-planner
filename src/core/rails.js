/**
 * Geometría de las vías de Factorio 2.0.
 *
 * Deducida de los planos que el propio juego trae en la Factoriopedia y en «Consejos y trucos»:
 * con este modelo, todos los extremos de curvas A, curvas B y medias diagonales de esos planos
 * empalman con otra pieza. tests/rails.test.js comprueba las relaciones observadas.
 *
 * Convenciones: x crece hacia el este e y hacia el sur. Los rumbos van de 0 a 15
 * (0 = norte, 4 = este, 8 = sur, 12 = oeste), igual que las direcciones de entidad de Factorio 2.0.
 */
import { BP } from './blueprint.js';

const { def } = BP;
const DV4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Extremos locales [x, y, rumbo hacia fuera] de cada pieza base. Una pieza con dirección d usa la base
// d % 4 girada floor(d / 4) cuartos de vuelta en sentido horario. S = recta, H = media diagonal, A y B = curvas.
export const RB = {
  S0: [[0, -1, 0], [0, 1, 8]], S2: [[1, -1, 2], [-1, 1, 10]],
  H0: [[-1, -2, 15], [1, 2, 7]], H2: [[1, -2, 1], [-1, 2, 9]],
  A0: [[0, 2, 8], [-1, -3, 15]], A2: [[0, 2, 8], [1, -3, 1]],
  B0: [[1, 2, 7], [-2, -2, 14]], B2: [[-1, 2, 9], [2, -2, 2]],
};

/** Vector unitario de cada rumbo. */
export const HV = Array.from({ length: 16 }, (_, i) => [Math.sin(i * Math.PI / 8), -Math.cos(i * Math.PI / 8)]);

/** Gira (x, y) q cuartos de vuelta en sentido horario. */
export const rotQ = (x, y, q) => { for (let i = 0; i < ((q % 4) + 4) % 4; i++) [x, y] = [-y, x]; return [x, y]; };

/** Las rectas y las medias diagonales son simétricas: solo usan las direcciones 0, 2, 4 y 6. */
export const normDir = (name, d) => { const t = def(name).rt; d = (((d | 0) % 16) + 16) % 16; return t === 'S' || t === 'H' ? d % 8 : d; };

export const railKey = (name, x, y, d) => name + '|' + x + '|' + y + '|' + normDir(name, d);

/** Extremos absolutos [x, y, rumbo] de una pieza de vía de 2.0, o null si no lo es. */
export function railEndsOf(name, x, y, dir) {
  const t = def(name).rt; if (!t) return null;
  const d = normDir(name, dir), base = RB[t + (d % 4 === 0 ? 0 : 2)], q = d >> 2; if (!base) return null;
  return base.map(([bx, by, h]) => { const [rx, ry] = rotQ(bx, by, q); return [x + rx, y + ry, (h + 4 * q) % 16]; });
}

// Plantillas de curva tomadas de combinaciones que aparecen en los planos del juego:
// piezas [nombre, x, y, dir] relativas a la entrada (un extremo de vía vertical, en (impar, par))
// y sus dos extremos libres [x, y, rumbo].
export const TMPL = {
  c90: {
    v: [[['curved-rail-a', 0, -2, 0], ['curved-rail-b', -2, -7, 0], ['curved-rail-b', -6, -11, 6], ['curved-rail-a', -11, -13, 6]]],
    e: [[[0, 0, 8], [-13, -13, 12]]],
  },
  c45: {
    v: [[['curved-rail-a', 0, -2, 0], ['curved-rail-b', -2, -7, 0]], [['curved-rail-a', 0, -2, 2], ['curved-rail-b', 2, -7, 2]]],
    e: [[[0, 0, 8], [-4, -9, 14]], [[0, 0, 8], [4, -9, 2]]],
  },
};

/** Número de variantes de una plantilla: 4 giros por cada versión (normal y reflejada). */
export const tmplVariants = k => TMPL[k].v.length * 4;

/** Variante v → [versión, cuartos de vuelta]. */
export function tmplMQ(k, v) { const nm = TMPL[k].v.length; return [((v % nm) + nm) % nm, Math.floor(v / nm) % 4]; }

/** Piezas de la variante v con la entrada en (ex, ey). */
export function tmplPieces(k, v, ex, ey) {
  const [m, q] = tmplMQ(k, v);
  return TMPL[k].v[m].map(([name, x, y, d]) => { const [rx, ry] = rotQ(x, y, q); return { name, x: ex + rx, y: ey + ry, dir: normDir(name, d + 4 * q), extra: {} }; });
}

/** Extremos libres de la variante v, relativos a la entrada. */
export function tmplEnds(k, v) {
  const [m, q] = tmplMQ(k, v);
  return TMPL[k].e[m].map(([x, y, h]) => { const [rx, ry] = rotQ(x, y, q); return [rx, ry, (h + 4 * q) % 16]; });
}

/**
 * Huecos válidos para señales junto a un extremo de vía con rumbo h (regla observada en los planos del juego):
 * a 1,5 casillas del eje y a ±0,5 del extremo. A la derecha del rumbo la señal mira hacia atrás (h + 8)
 * y a la izquierda mira hacia delante (h); en diagonal, las casillas equivalentes.
 * Devuelve [x, y, dirección]. No cubre los extremos de media diagonal.
 */
export function slotsAtEnd(x, y, h) {
  const out = [];
  if (h % 4 === 0) {
    const [ux, uy] = DV4[h / 4], rx = -uy, ry = ux;
    for (const a of [-0.5, 0.5]) {
      out.push([x + a * ux + 1.5 * rx, y + a * uy + 1.5 * ry, (h + 8) % 16]);
      out.push([x + a * ux - 1.5 * rx, y + a * uy - 1.5 * ry, h]);
    }
  } else if (h % 4 === 2) {
    const q = (h - 2) / 4;
    for (const [ox, oy, right] of [[0.5, 1.5, 1], [1.5, 0.5, 1], [-0.5, -1.5, 0], [-1.5, -0.5, 0]]) {
      const [px, py] = rotQ(ox, oy, q);
      out.push([x + px, y + py, right ? (h + 8) % 16 : h]);
    }
  }
  return out;
}
