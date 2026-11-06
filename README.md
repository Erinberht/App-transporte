# Mi bus · Unicórdoba

App móvil para que los estudiantes de la Universidad de Córdoba (Montería) encuentren la mejor ruta de buseta para llegar a tiempo a clase, vean a qué hora llega su bus y ayuden a otros compartiendo su recorrido y el cupo del bus. Más adelante se abrirá a otros destinos de la ciudad y a más personas.

Este repositorio es la **base inicial**: el flujo de 5 pantallas del prototipo de Figma ya funciona con datos de muestra. Todo lo demás (GPS real, backend, predicción, anuncios reales) se construye por etapas con los prompts de [`PROMPTS.md`](./PROMPTS.md).

## Qué incluye hoy

| Paso | Pantalla (Figma) | Ruta Expo Router |
|---|---|---|
| 1 | Elegir ruta | `src/app/index.tsx` |
| 2 | Bus en el mapa | `src/app/bus-en-el-mapa.tsx` |
| 3 | Compartir recorrido (QR opcional) | `src/app/compartir.tsx` |
| 4 | En viaje + reporte de cupo (lleno / medio / vacío) | `src/app/en-viaje.tsx` |
| 5 | Alerta de llegada | `src/app/alerta-llegada.tsx` |

- Anuncios de muestra con marcas ficticias en `src/data/ads.ts`, mostrados con `AdBanner` (franja en el paso 1, tarjeta en el paso 5).
- El mapa es una ilustración hecha con Views (`RouteMap`), no un mapa real.
- Estado del viaje en memoria (`src/state/trip.tsx`); rutas y ETA son datos fijos (`src/data/routes.ts`).
- Los botones "Escanear el QR" y "Compartir" aún no piden permisos ni envían nada: hay comentarios `TODO` en esos puntos.

## Cómo correrlo

```bash
npm install
npx expo start        # escanea el QR con Expo Go, o pulsa "a" (Android) / "w" (web)
npm run typecheck
```

Si `expo start` avisa de versiones incompatibles, ejecuta `npx expo install --fix` (ajusta `react-native-screens` y `react-native-safe-area-context` al SDK).

## Stack

Expo SDK 58 · React Native · TypeScript · Expo Router. Los colores y medidas salen del Figma y están en `src/theme.ts`.

## Subirlo a Git

```bash
git remote add origin https://github.com/<tu-usuario>/mi-bus-unicordoba.git
git push -u origin main
```

## Siguientes pasos

Abre el proyecto con Claude Code (`claude` dentro de la carpeta) y sigue [`PROMPTS.md`](./PROMPTS.md) en orden. Contexto del proyecto para Claude: [`CLAUDE.md`](./CLAUDE.md).
