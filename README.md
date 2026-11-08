# Mi bus · Unicórdoba

App móvil para que los estudiantes de la Universidad de Córdoba (Montería) encuentren la mejor ruta de buseta para llegar a tiempo a clase, vean a qué hora llega su bus y ayuden a otros compartiendo su recorrido y el cupo del bus. Más adelante se abrirá a otros destinos de la ciudad y a más personas.

Este repositorio es la **base inicial**: el flujo de 5 pantallas del prototipo de Figma ya funciona con datos de muestra. Todo lo demás (GPS real, backend, predicción, anuncios reales) se construye por etapas con los prompts de [`PROMPTS.md`](./PROMPTS.md).

## Qué incluye hoy

| Paso | Pantalla (Figma)                                   | Ruta Expo Router             |
| ---- | -------------------------------------------------- | ---------------------------- |
| —    | ¿A dónde vas? (ubicación, destino, hora de clase)  | `src/app/index.tsx`          |
| 1    | Elegir ruta                                        | `src/app/elegir-ruta.tsx`    |
| 2    | Bus en el mapa                                     | `src/app/bus-en-el-mapa.tsx` |
| 3    | Compartir recorrido (QR opcional)                  | `src/app/compartir.tsx`      |
| 4    | En viaje + reporte de cupo (lleno / medio / vacío) | `src/app/en-viaje.tsx`       |
| 5    | Alerta de llegada                                  | `src/app/alerta-llegada.tsx` |

- Pantalla inicial "¿A dónde vas?": pide permiso de ubicación con `expo-location` (solo en primer plano, después de explicar para qué se usa; se puede continuar sin ella), destino y hora de entrada a clase. Por ahora el único destino es la Universidad de Córdoba, sede Montería (campus principal). Los destinos viven en un solo lugar, `src/data/destinations.ts`: para agregar otros basta con añadirlos ahí.
- Anuncios de muestra con marcas ficticias en `src/data/ads.ts`, mostrados con `AdBanner` (franja en el paso 1, tarjeta en el paso 5).
- Mapa real de Montería con `react-native-maps` (`RouteMap.native.tsx`: Apple Maps en iOS, Google Maps en Android) con la ruta punteada, la parada del usuario y el bus. El recorrido y las coordenadas son de muestra (`src/data/geo.ts`).
- Sin conexión, y en web, se muestra el mapa ilustrativo del Figma (`StaticRouteMap`) con el aviso "Sin conexión".
- Para builds de Android hace falta una clave de Google Maps: copia `.env.example` a `.env.local` y completa `GOOGLE_MAPS_ANDROID_API_KEY` (la lee `app.config.js`). Expo Go no la necesita.
- Estado del viaje en memoria (`src/state/trip.tsx`); rutas y ETA son datos fijos (`src/data/routes.ts`).
- Los botones "Escanear el QR" y "Compartir" aún no piden permisos ni envían nada: hay comentarios `TODO` en esos puntos.

## Cómo correrlo

```bash
npm install
npx expo start        # escanea el QR con Expo Go, o pulsa "a" (Android) / "w" (web)
```

## Calidad de código

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint (eslint-config-expo) + Prettier como regla
npm run format        # aplica Prettier a todo el proyecto
npm test              # Jest + jest-expo + Testing Library (src/**/__tests__)
```

El workflow `.github/workflows/ci.yml` corre typecheck, lint, formato y tests en cada pull request.

Si `expo start` avisa de versiones incompatibles, ejecuta `npx expo install --fix` (ajusta `react-native-screens` y `react-native-safe-area-context` al SDK).

## Compilar para Android (EAS Build)

La app se compila en la nube con EAS; no hace falta Android Studio. Paquete de Android: `com.erinberht.mibus`.

Perfiles en `eas.json`:

- `preview`: APK para instalar directo en el celular (distribución interna, piloto).
- `production`: AAB para Google Play.

Primera vez:

```bash
npx eas-cli@latest login     # cuenta de Expo (gratis en expo.dev)
npx eas-cli@latest init      # vincula el proyecto con tu cuenta
```

La clave de Google Maps no viaja en `.env.local` (no se sube a EAS). Créala como variable de entorno de EAS en los entornos que use cada perfil:

```bash
npx eas-cli@latest env:set --name GOOGLE_MAPS_ANDROID_API_KEY --value <clave> --environment preview --environment production --visibility sensitive
```

Compilar el APK de prueba:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Al terminar, EAS da un enlace y un QR para descargar el APK. Después, en Google Cloud, restringe la clave a **Apps para Android** con el paquete `com.erinberht.mibus` y la huella SHA-1 que muestra `npx eas-cli@latest credentials --platform android`.

R8 (minificación) está desactivado en los builds de Android con `expo-build-properties` (`app.json`): con R8 activo la app se cerraba al abrir porque WorkManager no encontraba su base de datos interna. El proyecto de Google Cloud debe tener la facturación activa y **Maps SDK for Android** habilitado; si no, el mapa se ve negro (`Authorization failure` en `adb logcat`).

## Stack

Expo SDK 58 · React Native · TypeScript · Expo Router. Los colores y medidas salen del Figma y están en `src/theme.ts`.

## Subirlo a Git

```bash
git remote add origin https://github.com/<tu-usuario>/mi-bus-unicordoba.git
git push -u origin main
```

## Siguientes pasos

Abre el proyecto con Claude Code (`claude` dentro de la carpeta) y sigue [`PROMPTS.md`](./PROMPTS.md) en orden. Contexto del proyecto para Claude: [`CLAUDE.md`](./CLAUDE.md).
