# Mi bus · Unicórdoba

App móvil para que los estudiantes de la Universidad de Córdoba (Montería) encuentren la mejor ruta de buseta para llegar a tiempo a clase, vean a qué hora llega su bus y ayuden a otros compartiendo su recorrido y el cupo del bus. Más adelante se abrirá a otros destinos de la ciudad y a más personas.

El flujo parte del prototipo de Figma, reordenado para que tenga sentido en un viaje real. Se construye por etapas con los prompts de [`PROMPTS.md`](./PROMPTS.md).

## Flujo

| Pantalla                                                               | Ruta Expo Router             |
| ---------------------------------------------------------------------- | ---------------------------- |
| ¿A dónde vas? (ubicación, destino, hora de clase)                      | `src/app/index.tsx`          |
| Elegir ruta (ordenadas por margen para llegar a clase)                 | `src/app/elegir-ruta.tsx`    |
| Esperando tu bus (cuándo pasa, si llegas a tiempo, "Buscar otra ruta") | `src/app/bus-en-el-mapa.tsx` |
| ¿Subiste? · Compartir tu recorrido                                     | `src/app/compartir.tsx`      |
| Escanear el QR del bus (opcional, desde Compartir)                     | `src/app/escanear-qr.tsx`    |
| En viaje + reporte de cupo                                             | `src/app/en-viaje.tsx`       |
| Fin del viaje (resumen, sin anuncios)                                  | `src/app/fin-del-viaje.tsx`  |

La pantalla "Alerta de llegada" del prototipo se unió a "Esperando tu bus" (servía para decidir si esperar o buscar otra ruta, antes de subir), y se quitó la paginación "N de 5", que solo era una guía del prototipo.

Detalles de cada parte: `docs/RECOMENDACION.md`, `docs/COMPARTIR.md`, `docs/QR_FORMAT.md`, `docs/BACKEND.md`, `docs/DATA_MODEL.md`. El contexto para trabajar en el proyecto está en `CLAUDE.md`.

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
