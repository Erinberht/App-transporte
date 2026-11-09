# Compartir el recorrido en vivo

Código: `src/sharing/`. Servidor: `supabase/migrations/20261108230000_buses_en_vivo.sql`.

## Flujo

1. **Compartir** (`src/app/compartir.tsx`) llama a `liveShare.start()` y abre "En viaje".
2. `liveShare` (`shareSession.ts`):
   - pide los permisos;
   - crea un viaje anónimo (`shared_trips`) y cierra antes cualquier otro que hubiera quedado abierto;
   - enciende el GPS.
3. Con cada lectura del GPS:
   - revisa si el viajero bajó (`alighting.ts`);
   - si no bajó, decide si envía la posición (`trip_positions`).
4. **En viaje** muestra el estado: compartiendo, último envío, sin señal o un error con su acción. **Dejar de compartir** apaga el GPS y cierra el viaje.
5. **Bus en el mapa** consulta `route_live_buses` cada 15 s mientras está visible (`useLiveBuses`) y dibuja un bus por cada grupo de viajeros.

`shareSession.ts` no usa React: la tarea en segundo plano también le entrega lecturas. El GPS (`expoTracker.ts`) y el servidor se inyectan, así que las pruebas no necesitan teléfono ni red.

## Permisos y batería

| Permiso concedido       | Cómo se comparte                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Todo el tiempo"        | Tarea en segundo plano (`startLocationUpdatesAsync`). En Android lleva notificación fija "Compartiendo tu recorrido" y sigue con la pantalla apagada. |
| Solo con la app abierta | `watchPositionAsync`. "En viaje" pide mantener la app abierta.                                                                                        |
| Ninguno o GPS apagado   | No se crea el viaje. Se explica el problema y se ofrece "Abrir ajustes" o "Intentar de nuevo".                                                        |

- **Lecturas:** GPS de alta precisión, cada 10 s. Con precisión media (~100 m) no se distingue si la persona sigue sobre el recorrido, y por eso se apaga apenas termina el viaje. Se descartan las lecturas con más de 100 m de error.
- **Envíos:** como mucho uno cada 10 s y solo si la persona se movió 25 m. Si está quieta (por ejemplo, en un trancón), se envía uno por minuto para que el bus no desaparezca del mapa.
- **Sin señal:** no se guarda una cola de envíos. Al volver la señal se envía solo la última posición, porque las viejas no sirven para el tiempo real.
- **Notificación de Android:** expo-location no permite agregarle botones. Tocarla abre la app, y desde ahí se deja de compartir.
- **Si se cierra la app:** el servicio se detiene con ella (`killServiceOnDestroy`) y el servidor cierra el viaje a los 10 minutos.

## Cuando no llega la posición

"En viaje" dice el motivo. El código queda en el registro del teléfono (`adb logcat`, línea `[compartir] envío fallido`):

| Mensaje                            | Causa                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Estás fuera de Montería            | El servidor solo acepta posiciones dentro de la ciudad; la app ni intenta enviarlas. |
| La hora del teléfono no está bien  | `recorded_at` desfasado más de 10 minutos.                                           |
| El servidor no aceptó tu ubicación | Otro límite del servidor (por ejemplo, más de una posición cada 3 s).                |
| Sin señal                          | Sin internet o el servidor no respondió.                                             |

En todos los casos se reintenta con la siguiente lectura del GPS.

## Cuándo se detiene solo

Las reglas están en `alighting.ts`:

| Regla                                                                  | Motivo          |
| ---------------------------------------------------------------------- | --------------- |
| 2 minutos a menos de 7,2 km/h y a más de 80 m del recorrido            | `auto_alighted` |
| 1 minuto a menos de 7,2 km/h y a menos de 150 m de la parada de bajada | `auto_alighted` |
| El viaje lleva 90 minutos                                              | `timeout`       |
| El servidor ya cerró el viaje (10 minutos sin posiciones)              | `timeout`       |

- Un bus quieto en un trancón **no** se confunde con una bajada, porque sigue sobre el recorrido.
- Si el GPS no da la velocidad, se calcula con las posiciones.
- **Limitación:** el recorrido de las rutas es ficticio. Si el bus real pasa a más de 80 m de la línea dibujada, la primera regla podría cortar antes de tiempo. Con recorridos reales (`verificado`) desaparece el problema.

## Cupo del bus

En "En viaje", los botones **Lleno / Medio / Vacío** envían el reporte al servidor (`liveShare.reportOccupancy`). Solo se puede reportar mientras se comparte el recorrido, porque el reporte va asociado al viaje anónimo.

- **Límites:** un reporte cada 2 minutos y máximo 10 por viaje (`check_occupancy_report`). La app los revisa antes de enviar y avisa: "Podrás actualizarlo en 1 min".
- **Regla:** `live_occupancy()` toma los reportes de los últimos 10 minutos y cuenta **un voto por viajero**, su último reporte. Gana el nivel con más votos; en empate, el más reciente.
- **Agregación:** por ruta y, para los viajeros que escanearon el QR, por buseta. En "En viaje" se muestra primero el de tu buseta.
- **Dónde se ve:** "Esperando tu bus" y "Elegir ruta" muestran, por ejemplo, "Cupo medio · hace 3 min · 2 viajeros", consultado cada 30 s (`useLiveOccupancy`). Sin reportes recientes se dice tal cual.

## Avisos: buseta varada, desvío o retraso (etapa 3.4)

**Reportar.** En "En viaje", quien comparte puede tocar **Se varó**, **Cambió de ruta o se desvió** o **Va muy retrasada** (`liveShare.reportIncident`).

- **Límites:** cada tipo una vez por viaje. Lo controla el trigger `check_incident_report`.
- **Lugar:** lo pone el servidor con la última posición del propio viaje. La app no puede elegirlo.
- **Bus quieto:** si el bus lleva 5 minutos quieto sobre el recorrido y lejos de la parada de bajada (`detectStuck`), la app pregunta "¿Se varó?". Se responde con "Sí, se varó" o "No, es el tráfico", y no vuelve a preguntar en ese viaje.

**Avisar.** `live_incidents()` agrupa los reportes de los últimos 30 minutos por ruta y tipo, con cuántos viajeros los hicieron y la parada más cercana. La app lo consulta cada 30 s (`useLiveIncidents`).

- **"Elegir ruta":** "⚠ La P3 se varó cerca de Calle 22 · hace 4 min · 2 viajeros reportan". La recomendada nunca es una ruta varada o desviada.
- **"Esperando tu bus":** el mismo aviso, más la **mejor alternativa** (`bestAlternative`) con un botón "Cambiar a M1". La alternativa es una ruta que llega a tiempo y no tiene avisos graves.

**Hora en vivo y retrasos (`src/planner/liveEta.ts` y `disruption.ts`).** Con viajeros compartiendo, la hora de paso sale del bus en vivo más cercano que aún no pasa por tu parada y que alcanzas a tomar. Se ubica el bus sobre el recorrido y se interpolan los minutos entre paradas. Si esa hora es 10 minutos o más posterior a la del horario, se avisa **"Posible retraso"** y se sugiere la alternativa.

- **Limitación:** el servicio es por frecuencia y los horarios son ficticios. Un bus que nadie comparte puede llegar antes que el que se ve en vivo, por eso el aviso dice "posible".

## Servidor

- `route_live_buses(ruta)`: agrupa a los viajeros que están a menos de 300 m entre sí (`ST_ClusterDBSCAN`) y devuelve un bus por grupo. Incluye el centro del grupo, redondeado a 4 decimales (~11 m), y cuántos viajeros lo forman. Así dos P3 en lados opuestos de la ciudad no se promedian en un punto falso.
- `route_live_status(ruta)`: ahora usa el grupo más grande como posición.
- `close_stale_trips()`: pg_cron la ejecuta cada 5 minutos y cierra los viajes que llevan 10 minutos sin posiciones. Cada viaje termina en la hora de su última posición, con el motivo `timeout`.

**Privacidad:** si una sola persona comparte, la posición del bus es la suya. Es anónima, solo existe mientras va en un bus público y la persona aceptó al pulsar Compartir (decisión del producto, opción A). Nadie lee las posiciones individuales.

## Probarlo en un teléfono

- Hace falta un build nuevo (`eas build --profile preview`), porque se agregó `expo-task-manager` y cambiaron los permisos nativos. Expo Go no admite ubicación en segundo plano.
- La migración se aplica a la nube con `db push` (ver `docs/BACKEND.md`).
- Antes de publicar en Google Play, el permiso de ubicación "todo el tiempo" y el servicio en primer plano exigen la declaración de Play Console: un formulario y un video que muestre "Compartir mi recorrido" y la notificación. Para el APK de prueba no hace falta.
