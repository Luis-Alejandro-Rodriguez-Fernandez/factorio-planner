# Blueprinter

Editor web de planos de Factorio. Pega un string exportado del juego, modélalo sobre una cuadrícula y vuelve a copiarlo para importarlo con «Importar cadena».

Funciona entero en el navegador: no hay servidor ni cuentas, y los planos que guardas se quedan en tu navegador.

## Qué puedes hacer

- Importar planos y libros de planos de Factorio 2.0 y 1.1 con Ctrl+V.
- Construir desde cero con cintas, insertadores, máquinas, energía, fluidos, defensa, suelos y trenes. En trenes hay vías rectas y diagonales, curvas de 90° y 45° que se empalman solas, señales, paradas, locomotoras y vagones.
- Copiar la selección o el plano entero como un string listo para el juego.
- Exportar para 2.0 o para 1.1, con nombres, direcciones, módulos y cables traducidos.

## Arranque rápido

Necesitas Node.js 20.19 o superior.

```bash
npm install
npm run dev      # abre http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo que recarga al guardar |
| `npm test` | Pruebas del códec de strings y de la geometría de vías |
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
2. Vercel detecta Vite: usa `npm run build` y publica la carpeta `dist`. No hay que cambiar nada.
3. Pulsa **Deploy**.

A partir de ahí, cada push a `main` se publica en producción y cada pull request recibe su propia URL de vista previa.

También puedes desplegar desde la terminal: `npx vercel` crea una vista previa y `npx vercel --prod` publica en producción.

`vercel.json` añade cabeceras de seguridad, incluida una política de contenido que solo permite recursos del propio dominio, y caché de un año para los archivos con hash de `assets/`.

### Antes de pasar a producción

- [ ] Las pruebas pasan en GitHub Actions.
- [ ] En la URL de vista previa: pega un string del juego, cambia algo, cópialo y vuelve a importarlo en Factorio.
- [ ] Si algo falla después de publicar, ve a Vercel → **Deployments**, elige el despliegue anterior y pulsa **Instant Rollback**.

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

`tests/rails.test.js` comprueba esas relaciones y que cada variante de curva empalma.

## Límites conocidos

- Las entidades se dibujan con formas propias, no con los gráficos del juego.
- Las curvas y las diagonales son de Factorio 2.0. Al exportar para 1.1, el editor avisa de que esa versión no las reconoce.
- Las vías elevadas de Space Age y las medias diagonales no están en la paleta. Si vienen en un plano importado, se muestran y se conservan al exportar.

## Contribuir

Abre un issue o un pull request. Antes de enviarlo, comprueba que `npm test` y `npm run build` pasan.

## Marcas

Factorio es una marca de Wube Software. Este proyecto no está afiliado a Wube Software ni cuenta con su respaldo.
