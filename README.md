# Blueprinter

Editor web de planos de Factorio. Pega un string exportado del juego, modélalo sobre una cuadrícula y vuelve a copiarlo para importarlo con «Importar cadena».

Funciona entero en el navegador: no hay servidor ni cuentas, y los planos que guardas se quedan en tu navegador.

## Qué puedes hacer

- Importar planos y libros de planos de Factorio 2.0 y 1.1 con Ctrl+V.
- Construir desde cero con los 121 edificios y piezas de Factorio 2.0 y Space Age, con sus tamaños reales: también vías elevadas, rampas y soportes, el vagón de artillería, los suelos de Space Age y, en «Ocultos y modo editor», cargadores, cofres y tuberías infinitos e interfaces de energía y calor para mapas de pruebas. Los que mueven fluidos o calor muestran sus conexiones, y las tuberías solo se unen donde el edificio tiene una.
- Trazar vías como en el juego: pasa sobre una vía y haz clic en la flecha verde. El trazado sigue al cursor con rectas, curvas y diagonales; cada clic lo coloca y sigue desde su final, y puede empalmar con otra vía o hacer un desvío en mitad de ella. También hay curvas sueltas de 90° y 45°, señales, paradas, locomotoras y vagones.
- Guardar fragmentos de tus diseños en «Mis planos»: selecciona una parte (una columna de hornos, una fila de balizas, un cruce de trenes) y pulsa «Guardar selección» o Ctrl+B. Se organizan en carpetas, con miniatura y buscador, y «Colocar» los lleva en el cursor para reutilizarlos en cualquier plano.
- Exportar una carpeta o toda la biblioteca como libro de planos (con una subcarpeta por carpeta) e importar un libro entero a la biblioteca.
- Diseñar bloques de megabase con la cuadrícula de ajuste del juego (snap-to-grid), absoluta o relativa. El lienzo la dibuja y se exporta con el plano, así que los bloques encajan en el mundo igual que en el editor.
- Repetir la selección varias veces hacia cualquier lado, con la separación que quieras (Ctrl+D la repite una vez a la derecha), para teselar diseños.
- Copiar la selección o el plano entero como un string listo para el juego.
- Exportar para 2.0 o para 1.1, con nombres, direcciones, módulos y cables traducidos.

## Arranque rápido

Necesitas Node.js 22.

```bash
npm install
npm run dev      # abre http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo que recarga al guardar |
| `npm test` | Pruebas del códec de strings, de los libros de planos y de la geometría de vías |
| `npm run build` | Genera la versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para revisarla antes de publicar |

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
- Las curvas y las diagonales son de Factorio 2.0. Al exportar para 1.1, el editor avisa de que esa versión no las reconoce.
- Las vías elevadas se trazan con el planificador, pero no empalman solas con las rampas: coloca la rampa a mano en su sitio. Las medias diagonales no están en la paleta; si vienen en un plano importado, se muestran y se conservan al exportar.
- «Mis planos» se guarda en el navegador. Para tener una copia o llevarla a otro equipo, usa «Copiar todo como libro» e impórtalo allí con «Importar libro».

## Contribuir

Abre un issue o un pull request. Antes de enviarlo, comprueba que `npm test` y `npm run build` pasan.

## Marcas

Factorio es una marca de Wube Software. Este proyecto no está afiliado a Wube Software ni cuenta con su respaldo.
