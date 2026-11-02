# Blueprinter

Editor web de planos de Factorio. Pega un string exportado del juego, modélalo sobre una cuadrícula y vuelve a copiarlo para importarlo con «Importar cadena».

Funciona entero en el navegador: no hay servidor ni cuentas, y los planos que guardas se quedan en tu navegador.

## Qué puedes hacer

- Tener varios planos abiertos a la vez en páginas (pestañas encima del lienzo), cada uno con su historial de deshacer, su vista y su versión de exportación. Se guardan solas en el navegador; doble clic en una pestaña cambia el nombre y Alt+← / Alt+→ cambian de página.
- Abrir plantillas de serie para verlas y editarlas. La primera vez que entras se abre el pack **Megabase Vulcano**, un plano por página (ver más abajo).
- Descargar el plano, todas las páginas o tu biblioteca como un archivo `.txt` con el string del juego, y abrir archivos `.txt` o `.json` con «Importar → Abrir archivo» o soltándolos sobre la ventana. Un libro se puede abrir entero en páginas.
- Importar planos y libros de planos de Factorio 2.0 y 1.1 con Ctrl+V.
- Construir desde cero con todos los edificios de la Factoriopedia de Factorio 2.0 y Space Age (132 piezas en la paleta), con sus tamaños reales: también vías elevadas, rampas y soportes, el vagón de artillería, coche, tanque y spidertron, los suelos de Space Age y, en «Ocultos y modo editor», cargadores, válvulas, cofres y tuberías infinitos e interfaces de energía y calor para mapas de pruebas.
- Asignar a cada máquina solo las recetas que puede fabricar: la ensambladora ofrece las suyas, la refinería las del petróleo, la fundición las de metalurgia, etc. (326 recetas con su nombre en español). Puedes buscar por el nombre en español o el interno, asignar una receta a todas las máquinas seleccionadas a la vez y, con la pipeta (Q), seguir colocando máquinas con la misma receta. Los que mueven fluidos o calor muestran sus conexiones, y las tuberías solo se unen donde el edificio tiene una.
- Trazar vías como en el juego: pasa sobre una vía y haz clic en la flecha verde. El trazado sigue al cursor con rectas, curvas y diagonales; cada clic lo coloca y sigue desde su final, y puede empalmar con otra vía o hacer un desvío en mitad de ella. También hay curvas sueltas de 90° y 45°, señales, paradas, locomotoras y vagones.
- Guardar fragmentos de tus diseños en «Mis planos»: selecciona una parte (una columna de hornos, una fila de balizas, un cruce de trenes) y pulsa «Guardar selección» o Ctrl+B. Se organizan en carpetas, con miniatura y buscador, y «Colocar» los lleva en el cursor para reutilizarlos en cualquier plano.
- Exportar una carpeta o toda la biblioteca como libro de planos (con una subcarpeta por carpeta) e importar un libro entero a la biblioteca.
- Diseñar bloques de megabase con la cuadrícula de ajuste del juego (snap-to-grid), absoluta o relativa. El lienzo la dibuja y se exporta con el plano, así que los bloques encajan en el mundo igual que en el editor.
- Repetir la selección varias veces hacia cualquier lado, con la separación que quieras (Ctrl+D la repite una vez a la derecha), para teselar diseños.
- Copiar la selección o el plano entero como un string listo para el juego.
- Exportar para 2.0 o para 1.1, con nombres, direcciones, módulos y cables traducidos.

## Pack «Megabase Vulcano»

Un libro de planos para Vulcano (Space Age) pensado para producir y exportar a lo grande: robots dentro de cada zona y trenes 1-4 entre los puestos mineros y la fábrica. Son bloques de 50×50 con cuadrícula absoluta que encajan entre sí, con suelo de hormigón refinado, borde de hormigón de peligro y lámparas:

- Cada bloque trae un roboport (su zona logística cubre justo el bloque, así que las redes se unen al teselar) y nueve subestaciones que se cablean con las del bloque vecino.
- Dos troncales cruzan todos los bloques de oeste a este: lava en la fila 24 y ácido sulfúrico en la fila 41. Los bloques que no las usan las pasan por debajo con tuberías subterráneas, y ninguna otra tubería llega al borde, así que los fluidos de bloques vecinos no se mezclan.
- **Megabase completa (todo montado)**: el primer plano del libro junta todas las piezas en proporción, en dos filas de bloques con sus dos tomas de lava. Da ~27 packs de ciencia metalúrgica/s (~1600/min) para exportar, más ~194 placas de hierro/s, ~194 de cobre/s y ~97 de acero/s. Sus 4 centrales dan ~2300 MW para un consumo de ~1800 MW. Solo hay que traerle ácido sulfúrico de los géiseres y unir por vía los puestos mineros, que van sobre los yacimientos; la descripción del plano dice cuánto de cada cosa.
- **Trenes 1-4** (una locomotora y cuatro vagones): línea de doble vía con circulación por la derecha y señales, curva de doble vía, retornos para los extremos y estaciones en apartadero (48 insertadores masivos por estación, para que un tren parado no corte la línea). La megabase montada trae al norte una franja de tren con dos estaciones de descarga y un retorno; los **puestos mineros** de tungsteno, carbón y calcita traen su estación de carga, un tren aparcado con su horario (cargar hasta llenar, descargar hasta vaciar) y su retorno. Las piezas de vía llevan subestaciones, así que la corriente llega a las minas junto a la vía.
- Bloques: toma de lava, base vacía, central de vapor (99 turbinas, ~576 MW con neutralización de ácido), fundición de hierro y de cobre (~194 placas/s cada una), acero por colada (~97/s), minería con perforadoras grandes, carbono y carburo de tungsteno, placas de tungsteno, ciencia metalúrgica (~27 packs/s) y un puerto de exportación con 4 silos de cohetes.
- Las coladas llevan módulos de productividad 3 y una fila de balizas con velocidad 3; las fundiciones de lava, las perforadoras y los silos llevan velocidad 3. Cada plano explica en su descripción qué consume y qué produce, con cifras sacadas de las recetas del juego.

Los procesadores y el combustible de cohete del puerto de exportación no se fabrican en el pack: suelen llegar de otro planeta.

El pack se genera en `src/core/presets.js`. `tests/presets.test.js` comprueba cada plano: que nada se solape, que cada máquina pueda fabricar su receta, que todo tenga corriente, que cada insertador coja de un sitio y deje en otro en el sentido correcto, que las perforadoras echen en un cofre, que ninguna red de tuberías mezcle fluidos y que cada entrada de fluido reciba el suyo. En los trenes comprueba que las vías empalmen y solo queden sueltos los extremos por donde sigue la línea, que señales y paradas estén en sitios válidos, que cada vagón tenga 12 insertadores enfrente y que los horarios apunten a las paradas correctas.

## Arranque rápido

Necesitas Node.js 22.

```bash
npm install
npm run dev      # abre http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo que recarga al guardar |
| `npm test` | Pruebas del códec de strings, de los libros de planos, de la geometría de vías y del pack de Vulcano |
| `npm run build` | Genera la versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para revisarla antes de publicar |

### Datos del juego

`src/core/gamedata.js` (edificios con su tamaño, categorías de fabricación de cada máquina y recetas) se genera a partir de los datos oficiales de Factorio. Para actualizarlo cuando salga una versión nueva:

```bash
git clone --depth 1 https://github.com/wube/factorio-data /tmp/factorio-data
python3 -I scripts/extract-factorio-data.py /tmp/factorio-data > src/core/gamedata.js
npm test
```

`tests/gamedata.test.js` avisa si falta algún edificio en la paleta o si algún tamaño no coincide con el del juego.

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Primera versión de Blueprinter"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/blueprinter.git
git push -u origin main
```

Con la CLI de GitHub basta con `gh repo create blueprinter --public --source=. --push`.

Cada push y cada pull request ejecutan las pruebas y la compilación en GitHub Actions (`.github/workflows/ci.yml`).

## Desplegar en Vercel

1. En [vercel.com](https://vercel.com), entra en **Add New → Project** e importa el repositorio.
2. Vercel lee `vercel.json`: instala con `npm install --legacy-peer-deps`, compila con `npm run build` y publica `dist`. No hay que cambiar nada.
3. Pulsa **Deploy**.

A partir de ahí, cada push a `main` se publica en producción y cada pull request recibe su propia URL de vista previa.

También puedes desplegar desde la terminal: `npx vercel` crea una vista previa y `npx vercel --prod` publica en producción.

`vercel.json` añade cabeceras de seguridad, incluida una política de contenido que solo permite recursos del propio dominio, y caché de un año para los archivos con hash de `assets/`.

### Antes de pasar a producción

- [ ] Las pruebas pasan en GitHub Actions.
- [ ] En la URL de vista previa: pega un string del juego, cambia algo, cópialo y vuelve a importarlo en Factorio.
- [ ] Si algo falla después de publicar, ve a Vercel → **Deployments**, elige el despliegue anterior y pulsa **Instant Rollback**.

### Si la instalación falla

El npm 10 que traen Node 22 y Vercel falla al instalar este proyecto con `Cannot read properties of null (reading 'edgesOut')` si no se usa `--legacy-peer-deps`. Por eso `vercel.json` y el flujo de GitHub Actions instalan con esa opción, y `.npmrc` la activa al ejecutar `npm install` en local.

Sube también `package-lock.json` al repositorio: fija las versiones exactas con las que se probó el proyecto.

## Estructura

```
index.html              Marcado de la página
src/main.js             Punto de entrada: fuentes, estilos y editor
src/styles.css          Estilos, con tema claro y oscuro
src/editor.js           Lienzo, herramientas, paneles y portapapeles
src/core/blueprint.js   Códec de strings y conversión entre 1.1 y 2.0
src/core/rails.js       Geometría de las vías de 2.0
src/core/gamedata.js    Edificios, máquinas y recetas sacados del juego (generado)
src/core/presets.js     Plantillas de serie: el pack Megabase Vulcano
scripts/                Generador de gamedata.js
tests/                  Pruebas con Vitest
public/favicon.svg      Icono
vercel.json             Cabeceras para Vercel
```

`src/core/` no usa el DOM, así que sus pruebas corren en Node sin navegador.

## Cómo se sabe que las vías encajan

La geometría de las vías de Factorio 2.0 (rectas, diagonales, medias diagonales y curvas A y B) se dedujo de los planos que trae el propio juego en la Factoriopedia y en «Consejos y trucos». Con ese modelo, todos los extremos de las curvas de esos planos empalman con otra pieza. Las reglas para colocar señales y paradas salen de los mismos planos.

`tests/rails.test.js` comprueba esas relaciones, que cada variante de curva empalma y que el planificador une vías, hace desvíos y empalma en mitad de otra vía.

Los tamaños de los edificios y la posición de sus conexiones de tubería y calor también salen de los datos del juego.

## Límites conocidos

- Las entidades se dibujan con formas propias, no con los gráficos del juego.
- Los nombres de las recetas en español son propios: los datos públicos del juego no traen las traducciones oficiales, así que alguno puede no coincidir con el del juego. El nombre interno, que es el que va en el plano, siempre es el correcto.
- Los hornos (de piedra, acero, eléctrico) y la recicladora no tienen receta en el plano: en el juego la eligen solos.
- Las curvas y las diagonales son de Factorio 2.0. Al exportar para 1.1, el editor avisa de que esa versión no las reconoce.
- Las vías elevadas se trazan con el planificador, pero no empalman solas con las rampas: coloca la rampa a mano en su sitio. Las medias diagonales no están en la paleta; si vienen en un plano importado, se muestran y se conservan al exportar.
- «Mis planos» y las páginas se guardan en el navegador. Para tener una copia o llevarla a otro equipo, descárgalas (botón «Descargar» de Mis planos o el de la barra de páginas) y ábrelas allí con «Importar → Abrir archivo».
- El pack de Vulcano se ha comprobado con las reglas del juego que conoce el editor (tamaños, recetas, conexiones de fluidos, alcance de subestaciones y balizas), no dentro de Factorio. Si algo no encaja en tu partida, ajústalo aquí y vuelve a exportarlo.

## Contribuir

Abre un issue o un pull request. Antes de enviarlo, comprueba que `npm test` y `npm run build` pasan.

## Marcas

Factorio es una marca de Wube Software. Este proyecto no está afiliado a Wube Software ni cuenta con su respaldo.
