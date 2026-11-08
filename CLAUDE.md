# Mi bus · Unicórdoba — contexto del proyecto

Lee también `AGENTS.md` (reglas de Expo: usar Expo Router, `npx expo install`, no confiar en memoria sobre APIs de Expo).

## Producto

App para estudiantes de la Universidad de Córdoba (Montería, Colombia) que ayuda a llegar a clase en buseta:

- Elegir ruta/buseta según la ubicación del usuario, priorizando llegar a tiempo a clase.
- Ver la hora de llegada de la buseta, retrasos, tráfico y alternativas si una buseta falla.
- Compartir ubicación en vivo al subir (opcional: escanear QR del bus) y reportar cupo (lleno/medio/vacío).
- Rutas sugeridas según el perfil (lugares frecuentes, horario de clases).
- Modelo predictivo de tiempos con datos compartidos voluntariamente (festivos, horas pico, desvíos).
- Alcance actual: SOLO la sede Montería de la Universidad de Córdoba como destino. No agregar otras sedes (Berástegui, etc.) ni otros destinos por ahora.
- Más adelante: otros destinos de la ciudad, más usuarios y anuncios.

## Reglas

- Idioma de la interfaz y los textos: español (Colombia). Código e identificadores técnicos pueden estar en inglés, pero los nombres de rutas y pantallas actuales están en español.
- Diseño fuente: Figma `VjOT24SKfGNoZXmTJTFO4M` (nodo del flujo: `7:2161` a `7:2472`). Tokens en `src/theme.ts`.
- Privacidad primero: la ubicación compartida es anónima, solo durante el viaje, y se detiene al bajar. Cumplir la Ley 1581 de 2012 (habeas data, Colombia).
- Los anuncios siempre llevan la etiqueta "Anuncio" y nunca aparecen en la pantalla "En viaje".
- Antes de dar una tarea por terminada: `npm run typecheck`, `npx expo lint` y `npm test`.
- Los tests van en carpetas `__tests__` fuera de `src/app/` (todo archivo en `src/app/` es una ruta).

## Estado actual

Pantalla inicial "¿A dónde vas?" (`src/app/index.tsx`) + flujo de 5 pantallas con datos de muestra (`src/data`). La ubicación del usuario (`src/location/useUserLocation.ts`, solo primer plano) se guarda en memoria como origen del viaje y no se envía a ningún lado. Destinos en `src/data/destinations.ts` (hoy solo Unicórdoba sede Montería; no agregar otras sedes hasta que se pida). Mapa real con `react-native-maps` que dibuja el recorrido de la ruta elegida; el mapa ilustrativo (`StaticRouteMap`) queda como respaldo sin conexión y en web.

Build de Android con EAS (`eas.json`: perfiles `preview` = APK interno y `production` = AAB). Paquete `com.erinberht.mibus`. La clave `GOOGLE_MAPS_ANDROID_API_KEY` va en `.env.local` (local, ignorado por git) y como variable de entorno de EAS (`sensitive`, entornos preview y production) para los builds en la nube. R8 desactivado en Android (`expo-build-properties`) porque rompía WorkManager al arrancar.

Datos de rutas (`docs/DATA_MODEL.md`): modelo tipo GTFS en `src/data/model.ts`; las pantallas usan solo `routesRepository` (`src/data/repository.ts`), que lee `src/data/dataset.json`. Ese JSON se genera con `npm run data:seed` desde los CSV de `data/seed`; no editarlo a mano. Las 10 rutas (6M, AE, D1, M1, P1, P2, P3, RG, S1, T2) tienen códigos y nombres reales de Metrosinú, pero paradas, recorridos y horarios FICTICIOS (`quality: 'ficticio'`). No copiar paradas de Moovit (tiene derechos). Los datos reales se cargan con `npm run data:import -- <carpeta>`. ETA y avisos siguen siendo de muestra (`src/data/live.ts`).

Backend: Supabase (`docs/ADR-001-backend.md`, `docs/BACKEND.md`). Esquema en `supabase/migrations` (PostGIS, RLS, pg_cron con retención de 30 días). Pruebas pgTAP en `supabase/tests`. Desarrollo local con Docker: `npm run db:start` / `db:reset` / `db:test` / `test:integration`. Tras cambiar el esquema: `npm run db:types`. Tras cambiar rutas: `npm run data:seed` (regenera `dataset.json` y `supabase/seed.sql`). La app usa el backend solo si están `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; sin ellas funciona igual. La sesión anónima se crea solo al escribir (compartir o reportar), nunca al abrir la app. Nadie lee posiciones ni reportes individuales: solo `route_live_status`. Proyecto en la nube: pendiente (lo crea el usuario, región São Paulo).
