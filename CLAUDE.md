# Mi bus · Unicórdoba — contexto del proyecto

Lee también `AGENTS.md` (reglas de Expo: usar Expo Router, `npx expo install`, no confiar en memoria sobre APIs de Expo).

## Producto
App para estudiantes de la Universidad de Córdoba (Montería, Colombia) que ayuda a llegar a clase en buseta:
- Elegir ruta/buseta según la ubicación del usuario, priorizando llegar a tiempo a clase.
- Ver la hora de llegada de la buseta, retrasos, tráfico y alternativas si una buseta falla.
- Compartir ubicación en vivo al subir (opcional: escanear QR del bus) y reportar cupo (lleno/medio/vacío).
- Rutas sugeridas según el perfil (lugares frecuentes, horario de clases).
- Modelo predictivo de tiempos con datos compartidos voluntariamente (festivos, horas pico, desvíos).
- Más adelante: otros destinos de la ciudad, más usuarios y anuncios.

## Reglas
- Idioma de la interfaz y los textos: español (Colombia). Código e identificadores técnicos pueden estar en inglés, pero los nombres de rutas y pantallas actuales están en español.
- Diseño fuente: Figma `VjOT24SKfGNoZXmTJTFO4M` (nodo del flujo: `7:2161` a `7:2472`). Tokens en `src/theme.ts`.
- Privacidad primero: la ubicación compartida es anónima, solo durante el viaje, y se detiene al bajar. Cumplir la Ley 1581 de 2012 (habeas data, Colombia).
- Los anuncios siempre llevan la etiqueta "Anuncio" y nunca aparecen en la pantalla "En viaje".
- Antes de dar una tarea por terminada: `npm run typecheck` y `npx expo lint`.

## Estado actual
Flujo de 5 pantallas con datos de muestra (`src/data`). Sin backend, sin GPS real, mapa ilustrativo.
