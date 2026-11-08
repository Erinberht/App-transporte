# Backend (Supabase)

Decisión y comparación: [`ADR-001-backend.md`](ADR-001-backend.md). Esquema: `supabase/migrations/`. Pruebas de la base: `supabase/tests/`.

## Desarrollo local

Requiere Docker Desktop encendido.

```bash
npm run db:start            # levanta Supabase local (la primera vez descarga imágenes)
npm run db:reset            # aplica migraciones + supabase/seed.sql (rutas ficticias)
npm run db:test             # pruebas pgTAP de seguridad y privacidad (RLS, límites, retención)
npm run test:integration    # la capa API de la app contra el Supabase local
npm run db:types            # regenera src/api/database.types.ts tras cambiar el esquema
npm run db:stop
```

Supabase Studio (panel web local) queda en http://127.0.0.1:54323.

Para cambiar el esquema: `npx supabase migration new <nombre>`, escribir el SQL y luego correr `npm run db:reset`, `npm run db:test` y `npm run db:types`.

### Conectar la app al backend local

En `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://<IP-del-PC-en-la-red-local>:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY de `npx supabase status`>
```

- El teléfono no ve `127.0.0.1` del PC: usa la IP del PC en el Wi-Fi o `adb reverse tcp:54321 tcp:54321` con `http://127.0.0.1:54321`.
- El backend local usa `http`. Las builds de desarrollo lo permiten; las de producción solo deben apuntar a la URL `https` de la nube.

Sin estas variables, la app funciona igual que antes, sin backend.

## Qué hay en la base

| Tabla                                                                                    | Contenido                                                             | Quién lee              | Quién escribe                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `dataset_meta`, `stops`, `routes`, `route_patterns`, `pattern_stops`, `service_headways` | Catálogo de rutas (modelo de `DATA_MODEL.md`, con PostGIS)            | Todos                  | Solo la importación (rol de servicio)                                                        |
| `buses`                                                                                  | Busetas físicas para el QR (etapa 3.2). Sin placa ni conductor        | Todos (las activas)    | Solo administración                                                                          |
| `profiles`                                                                               | Un registro por usuario anónimo; fechas de consentimiento (etapa 6.1) | El propio usuario      | El propio usuario (solo el consentimiento)                                                   |
| `shared_trips`                                                                           | Viaje compartido: ruta, bus opcional, inicio y fin                    | El propio usuario      | El propio usuario (crear y terminar)                                                         |
| `trip_positions`                                                                         | Posiciones GPS de un viaje                                            | **Nadie** directamente | El dueño del viaje activo (máximo una cada 3 s, dentro de Montería, no más viejas de 10 min) |
| `occupancy_reports`                                                                      | Lleno, medio o vacío                                                  | **Nadie** directamente | El dueño del viaje activo (máximo una cada 2 min y 10 por viaje, de la misma ruta)           |

Funciones (RPC):

- `get_transit_dataset()`: todo el catálogo en el formato `TransitDataset` de la app.
- `route_live_status(route_id)`: viajes activos, posición agregada del bus (centro de las últimas posiciones de los 2 últimos minutos, redondeada a unos 10 m) y cupo más reportado en los últimos 10 minutos. Es la base de las etapas 3.1 y 3.3.
- `delete_my_data()`: "Borrar mis datos". Elimina el usuario anónimo y, en cascada, su perfil, sus viajes, sus posiciones y sus reportes.
- `purge_expired_data()`: solo interna, ejecutada por pg_cron todos los días a las 3:15 a. m. (hora de Colombia).

## Privacidad (Ley 1581 de 2012)

- **Sin datos personales directos:** no se piden nombre, correo, teléfono ni placa. Cada instalación es un usuario anónimo de Supabase Auth (id aleatorio).
- **Sesión solo cuando hace falta:** la app no crea el usuario anónimo al abrirse. Lo crea al compartir un viaje o reportar cupo (`ensureAnonymousSession`). Consultar rutas no deja rastro.
- **Nadie ve recorridos individuales:** las reglas de acceso (RLS) bloquean la lectura de posiciones y reportes. Solo sale el agregado por ruta.
- **Retención de 30 días:** cada día se borran los viajes de más de 30 días, con sus posiciones y reportes, y los usuarios anónimos inactivos por 30 días. Los viajes abiertos por más de 3 horas se cierran solos.
- **Borrado a petición:** `delete_my_data()` (el botón llega en la etapa 6.1).
- ⚖️ **Para revisión legal (etapa 6.1):** si una posición GPS con un id anónimo es dato personal (dato de geolocalización), el texto de autorización y la política de tratamiento, y si 30 días es proporcional a la finalidad.

## Uso desde la app

- `src/api/supabase.ts`: cliente único, o `null` si no hay configuración. La sesión se guarda con `expo-sqlite/localStorage`.
- `src/api/transit.ts`: `fetchTransitDataset`, `fetchRouteLiveStatus`, `ensureAnonymousSession` y `deleteMyData`.
- `src/data/transitSync.ts`: al arrancar usa la copia guardada si es más nueva que las rutas incluidas. Después descarga el catálogo y lo guarda para el siguiente arranque, así las rutas no cambian con una pantalla abierta.

## Proyecto en la nube (pendiente)

1. Crear el proyecto en [supabase.com](https://supabase.com) en la región **São Paulo**.
2. Activar **Anonymous sign-ins** en Authentication → Sign In / Providers y, antes del piloto público, CAPTCHA.
3. Vincular y aplicar el esquema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
4. **Cargar rutas en la nube:** `npm run data:sql` genera `supabase/seed.sql`. Ejecútalo en el SQL Editor del panel o con `psql "<cadena de conexión>" -f supabase/seed.sql`. Es idempotente: se puede volver a correr al actualizar rutas.
5. Copiar la URL y la **publishable key** (Settings → API Keys) a `.env.local` y a las variables de entorno de EAS (`preview` y `production`). La publishable key no es secreta; la **secret key** nunca va en la app.
