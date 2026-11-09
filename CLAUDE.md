# Mi bus · Unicórdoba — contexto del proyecto

Lee también `AGENTS.md` (reglas de Expo: usar Expo Router, `npx expo install`, no confiar en memoria sobre APIs de Expo).

## Producto

App para estudiantes de la Universidad de Córdoba (Montería, Colombia) que ayuda a llegar a clase en buseta:

- Elegir ruta/buseta según la ubicación del usuario, priorizando llegar a tiempo a clase.
- Ver la hora de llegada de la buseta, retrasos, tráfico y alternativas si una buseta falla.
- Compartir ubicación en vivo al subir (opcional: escanear QR del bus) y reportar cupo (lleno/medio/vacío).
- Rutas sugeridas según el perfil (lugares frecuentes, horario de clases).
- Modelo predictivo de tiempos con datos compartidos voluntariamente (festivos, horas pico, desvíos).
- Alcance actual: la sede Montería de la Universidad de Córdoba es el destino principal. No agregar otras sedes (Berástegui, etc.). Desde la etapa 4.1 el usuario puede guardar sus propios lugares frecuentes (casa, trabajo...) como destinos; el motor solo sugiere las rutas cargadas y debe decir cuándo ninguna sirve.
- Más adelante: más usuarios y anuncios.

## Reglas

- Idioma de la interfaz y los textos: español (Colombia). Código e identificadores técnicos pueden estar en inglés, pero los nombres de rutas y pantallas actuales están en español.
- Diseño fuente: Figma `VjOT24SKfGNoZXmTJTFO4M` (nodo del flujo: `7:2161` a `7:2472`). Tokens en `src/theme.ts`.
- Privacidad primero: la ubicación compartida es anónima, solo durante el viaje, y se detiene al bajar. Cumplir la Ley 1581 de 2012 (habeas data, Colombia).
- Los anuncios siempre llevan la etiqueta "Anuncio" y nunca aparecen en la pantalla "En viaje".
- Antes de dar una tarea por terminada: `npm run typecheck`, `npx expo lint` y `npm test`.
- Los tests van en carpetas `__tests__` fuera de `src/app/` (todo archivo en `src/app/` es una ruta).

## Estado actual

Flujo: "¿A dónde vas?" (`index.tsx`) → Elegir ruta → Esperando tu bus (`bus-en-el-mapa.tsx`, con "Buscar otra ruta"; absorbió la "Alerta de llegada" del prototipo) → Compartir (QR opcional en `escanear-qr.tsx`) → En viaje → Fin del viaje (`fin-del-viaje.tsx`, sin anuncios). Sin paginación "N de 5" (era solo guía del prototipo). La ubicación del usuario (`src/location/useUserLocation.ts`, solo primer plano) se guarda en memoria como origen del viaje y no se envía a ningún lado. Destinos en `src/data/destinations.ts` (hoy solo Unicórdoba sede Montería; los lugares del usuario llegan con el perfil, etapa 4.1). Mapa real con `react-native-maps` que dibuja el recorrido de la ruta elegida; el mapa ilustrativo (`StaticRouteMap`) queda como respaldo sin conexión y en web.

Build de Android con EAS (`eas.json`: perfiles `preview` = APK interno y `production` = AAB). Paquete `com.erinberht.mibus`. La clave `GOOGLE_MAPS_ANDROID_API_KEY` va en `.env.local` (local, ignorado por git) y como variable de entorno de EAS (`sensitive`, entornos preview y production) para los builds en la nube. R8 desactivado en Android (`expo-build-properties`) porque rompía WorkManager al arrancar.

Recomendación de rutas (`docs/RECOMENDACION.md`): `src/planner/recommend.ts` (función pura) + `useRoutePlan()`. Ordena por margen para llegar a clase. Las opciones de caminata imitan a Moovit: ritmo normal o lento (×2) y máximo de 2 a 16 min por tramo, sin límite por defecto. "Elegir ruta" preselecciona la mejor y el mapa marca como "Tu parada" la parada que elige el motor.

Compartir el recorrido (`docs/COMPARTIR.md`): `src/sharing/`. `liveShare` (instancia única, sin React) crea el viaje anónimo, enciende el GPS (tarea en segundo plano con "Permitir todo el tiempo"; si no, solo con la app abierta), envía la posición como mucho cada 10 s y se detiene solo al detectar que bajó (`alighting.ts`). "Bus en el mapa" dibuja un bus por grupo de viajeros (`route_live_buses`). Con un solo viajero se muestra igual (decisión del producto). Probar en teléfono requiere un build de EAS (no Expo Go).

QR del bus (`docs/QR_FORMAT.md`): `mibus://bus/v1/<código>`; `src/qr/` (formato y validación) + pantalla `src/app/escanear-qr.tsx` (expo-camera, sin micrófono). El enlace `src/app/bus/v1/[code].tsx` abre la app desde la cámara normal. Opcional: vincula el viaje (`shared_trips.bus_id`, validado por el trigger `check_trip_bus`). Busetas de prueba en `data/seed/buses.csv`; `npm run qr:generate` crea los QR en `data/qr/`.

Datos de rutas (`docs/DATA_MODEL.md`): modelo tipo GTFS en `src/data/model.ts`; las pantallas usan solo `routesRepository` (`src/data/repository.ts`), que lee `src/data/dataset.json`. Ese JSON se genera con `npm run data:seed` desde los CSV de `data/seed`; no editarlo a mano. Las 10 rutas (6M, AE, D1, M1, P1, P2, P3, RG, S1, T2) tienen códigos y nombres reales de Metrosinú, pero paradas, recorridos y horarios FICTICIOS (`quality: 'ficticio'`). No copiar paradas de Moovit (tiene derechos). Los datos reales se cargan con `npm run data:import -- <carpeta>`. ETA, cupo y avisos siguen siendo de muestra (`src/data/live.ts`).

Backend: Supabase (`docs/ADR-001-backend.md`, `docs/BACKEND.md`). Esquema en `supabase/migrations` (PostGIS, RLS, pg_cron con retención de 30 días). Pruebas pgTAP en `supabase/tests`. Desarrollo local con Docker: `npm run db:start` / `db:reset` / `db:test` / `test:integration`. Tras cambiar el esquema: `npm run db:types`. Tras cambiar rutas: `npm run data:seed` (regenera `dataset.json` y `supabase/seed.sql`). La app usa el backend solo si están `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; sin ellas funciona igual. La sesión anónima se crea solo al escribir (compartir o reportar), nunca al abrir la app. Nadie lee posiciones ni reportes individuales: solo `route_live_status`. Proyecto en la nube: `almafmszljkgkyjzrrrb` (São Paulo); variables en `.env.local` y EAS. Se aplica con `supabase db push --remote` por el pooler `aws-1-sa-east-1` (ver `docs/BACKEND.md`). Nunca guardar la contraseña de la base ni la secret key en archivos.
