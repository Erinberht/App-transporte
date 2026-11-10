# Perfil del estudiante (etapa 4.1)

El perfil es **opcional**. Se edita en "Mi perfil" (`src/app/perfil.tsx`), que se abre desde el encabezado de "¿A dónde vas?". Tiene tres partes:

| Parte                | Contenido                                                                               | Dónde se usa                                     |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Horario de clases    | Por día (lunes a domingo): hora de entrada y nombre opcional. Máximo 12 clases por día  | "¿A dónde vas?" propone la próxima clase de hoy  |
| Lugares frecuentes   | Nombre, tipo (casa, trabajo, otro) y ubicación. Máximo 10                               | Destinos además de la universidad                |
| Opciones de caminata | Ritmo (normal o lento) y máximo a pie por tramo (sin límite, o de 2 a 16 min de 2 en 2) | Motor de recomendación (`docs/RECOMENDACION.md`) |
| Avisos               | Sugerencia de la mañana, hora de salir y "Tu bus se acerca" (apagados por defecto)      | `docs/AVISOS.md`                                 |

## Código

- `src/profile/model.ts`: tipos y funciones puras (`nextClass`, `classesOn`, `parseProfile`, que descarta lo dañado sin perder lo demás).
- `src/profile/store.ts`: `profileStore`, una instancia única sin React que guarda en `expo-sqlite/kv-store` (clave `profile:v1`). `useProfile()` la conecta con las pantallas.
- `src/data/destinations.ts`: `allDestinations(places)` agrega a la universidad los lugares del usuario (id `place:<id>`). Si un lugar se borra, el destino vuelve a ser la universidad.
- `src/state/trip.tsx`: expone `destination` ya resuelto. `walking` se lee y se guarda en el perfil.
- `src/app/lugar.tsx`: guardar o editar un lugar (`/lugar?id=<id>` para editar).

## Comportamiento

- **Próxima clase:** si hoy queda una clase por empezar, "¿A dónde vas?" elige la universidad y la hora de esa clase. Lo hace **una vez por clase y día**: si el usuario cambia el destino o la hora a mano, no se le vuelve a imponer, y la tarjeta "Próxima clase hoy" ofrece "Usar" para volver a ella.
- **Otros destinos:** el motor sirve para cualquier coordenada, pero solo conoce las rutas cargadas. Una ruta no sirve si su parada más cercana al destino queda a más de 1,2 km (`MAX_ALIGHT_DISTANCE_METERS`). Si ninguna sirve, "Elegir ruta" lo dice (`noRouteNotice`): "Ninguna de las rutas cargadas llega cerca de Casa". Si el motivo es otro (horario o límite de caminata), lo explica también.
- Al guardar un lugar se avisa si ninguna ruta pasa cerca (`servedByAnyRoute`), pero se deja guardar igual.
- Para un destino que no es la universidad, la hora se llama "Hora de llegada" y los textos no hablan de "clase".

## Ubicación del lugar

Se marca con **"Usar mi ubicación actual"** o **tocando el mapa / arrastrando el pin** (`src/components/LocationPicker.native.tsx`). No hay búsqueda por dirección: en Android, `geocodeAsync` envía el texto a Google, y la dirección de la casa es justo el dato que no debe salir del teléfono. En web no hay mapa: solo la ubicación actual.

## Privacidad (Ley 1581 de 2012)

- El perfil **se queda en el teléfono**. No se envía al backend ni se asocia al usuario anónimo de Supabase.
- "Borrar mi perfil" (con confirmación) elimina horario, lugares, caminata y avisos (y cancela los programados). Desinstalar la app también los borra.
- **Sincronización: pospuesta.** Requiere cuentas (hoy solo hay usuarios anónimos) y la revisión legal de la etapa 6.1. Un horario más la ubicación de la casa identifican a una persona aunque el id sea anónimo. Cuando llegue, debe ser opcional, con consentimiento explícito, y "Borrar mi perfil" debe borrar también la copia del servidor.
