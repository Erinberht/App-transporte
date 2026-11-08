# ADR-001 · Backend: Supabase

- **Estado:** aceptada (8 de noviembre de 2026)
- **Contexto:** etapa 2.3 de `PROMPTS.md`. Hace falta un backend para el catálogo de rutas, los viajes compartidos en vivo, los reportes de cupo y los usuarios anónimos, para un piloto con estudiantes de Unicórdoba (sede Montería). El equipo es de una persona.

## Opciones

### A. Supabase (Postgres + PostGIS + Realtime + Auth)

Servicio gestionado alrededor de Postgres. Incluye autenticación (con inicio de sesión anónimo), API REST/RPC generada desde el esquema, canales en tiempo real, reglas de seguridad por fila (RLS), PostGIS y pg_cron.

### B. Node + Fastify + Postgres (propio)

Servidor propio en un VPS o PaaS (Render, Fly.io, Railway) con un Postgres gestionado, autenticación propia (tokens por dispositivo) y WebSockets propios para el tiempo real.

## Comparación

| Criterio                      | A. Supabase                                                                                                                                                                                   | B. Node + Fastify + Postgres                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Costo del piloto**          | Plan Free: USD 0. 500 MB de base, 5 GB de transferencia, 50.000 usuarios activos al mes, 200 conexiones en tiempo real simultáneas y 2 millones de mensajes al mes. Pro: desde USD 25 al mes. | Servidor y Postgres gestionado: unos USD 10–25 al mes en planes pequeños, más el tiempo de mantenerlos. |
| **Tiempo real**               | Incluido (Realtime: cambios de la base y canales de difusión).                                                                                                                                | Hay que construir WebSockets, reconexión, escalado y autenticación de canales.                          |
| **Usuarios anónimos**         | `signInAnonymously()` incluido, con límite por IP (30 por hora, configurable).                                                                                                                | Hay que construirlo: tokens por dispositivo, rotación y revocación.                                     |
| **Geoespacial**               | PostGIS disponible.                                                                                                                                                                           | PostGIS en el Postgres gestionado (casi todos lo ofrecen).                                              |
| **Seguridad de datos**        | RLS en la base: las reglas viven junto a los datos y se prueban con pgTAP.                                                                                                                    | Reglas en el código del servidor; más superficie para errores.                                          |
| **Facilidad**                 | Esquema en migraciones SQL, tipos TypeScript generados, entorno local idéntico con Docker (`supabase start`).                                                                                 | Más piezas que escribir, desplegar y vigilar.                                                           |
| **Retención de datos**        | pg_cron incluido para borrar a los 30 días.                                                                                                                                                   | Tarea programada propia.                                                                                |
| **Dependencia del proveedor** | Media: es Postgres estándar, migraciones SQL portables. Auth y Realtime son lo más atado.                                                                                                     | Baja.                                                                                                   |
| **Riesgos**                   | El plan Free **pausa el proyecto tras una semana sin actividad** (no aplica a Pro). No incluye backups.                                                                                       | Más trabajo de operación para una sola persona.                                                         |

Fuentes: [precios de Supabase](https://supabase.com/pricing), [pausa de proyectos Free](https://supabase.com/docs/guides/platform/free-project-pausing), [inicio de sesión anónimo](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase con Expo](https://docs.expo.dev/guides/using-supabase/). Precios consultados en noviembre de 2026: revisarlos antes de cambiar de plan.

## Decisión

**Supabase.** Para el piloto da casi todo lo necesario: tiempo real, usuarios anónimos, RLS, PostGIS y retención programada. Cuesta USD 0 y deja a una sola persona concentrada en la app y no en la infraestructura. El esquema es SQL estándar en `supabase/migrations`, así que migrar a la opción B más adelante es viable.

## Consecuencias

- Durante el piloto conviene pasar a **Pro** (USD 25 al mes), o mantener actividad diaria, para evitar la pausa por inactividad y tener backups.
- Región sugerida para el proyecto en la nube: **São Paulo (sa-east-1)**, la más cercana a Montería.
- Activar CAPTCHA (Turnstile o hCaptcha) en el inicio de sesión anónimo antes del piloto público. Supabase lo recomienda para evitar que se llene la base con usuarios falsos.
- La app funciona sin backend: si `EXPO_PUBLIC_SUPABASE_*` no está configurado o no hay red, usa las rutas incluidas o la última copia guardada.
- Detalles de operación, del esquema y de la privacidad: [`docs/BACKEND.md`](BACKEND.md).
