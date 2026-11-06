# Prompts para seguir construyendo con Claude Code

Úsalos en orden, uno por sesión o rama (`git checkout -b feature/...`). Cada prompt es autónomo. Pide siempre a Claude que termine con `npm run typecheck` y un commit.

> Antes de empezar, abre `claude` en la carpeta del proyecto. Para los prompts que usan Figma, conecta el servidor MCP de Figma.

---

## Etapa 1 · Fidelidad y base técnica

**1.1 Afinar el diseño con Figma**
```
Lee el archivo de Figma VjOT24SKfGNoZXmTJTFO4M (flujo de 5 pantallas, nodos 7:2161 a 7:2472) con el MCP de Figma. Compara cada pantalla con lo implementado en src/app y src/components. Extrae los tokens reales (colores, tipografía, radios, espaciados) con get_variable_defs y actualiza src/theme.ts. Corrige las diferencias visuales y lístalas al final. No cambies la lógica.
```

**1.2 Calidad de código**
```
Configura ESLint (npx expo lint), Prettier y Jest con jest-expo. Agrega tests de render para las 5 pantallas y para el estado en src/state/trip.tsx. Añade un workflow de GitHub Actions que corra typecheck, lint y tests en cada PR.
```

**1.3 Mapa real**
```
Reemplaza la ilustración src/components/RouteMap.tsx por un mapa real centrado en Montería usando MapLibre o react-native-maps (revisa la documentación de Expo SDK 58 antes de elegir). Mantén la misma API del componente (height, busLabel), dibuja la ruta como polilínea punteada y muestra la parada del usuario. Deja un mapa estático de respaldo si no hay conexión.
```

---

## Etapa 2 · Ubicación y rutas reales

**2.1 Ubicación y destino**
```
Con expo-location, pide permiso y obtén la ubicación del usuario. Añade una pantalla inicial "¿A dónde vas?" con la Universidad de Córdoba (sede Berástegui) como destino por defecto, y un campo para elegir hora de entrada a clase. Guarda el último destino. Estructura el código para que luego se puedan agregar otros destinos de Montería.
```

**2.2 Datos de rutas**
```
Define un modelo de datos tipo GTFS simplificado para las busetas de Montería: rutas (P1, P2, T2, Rancho Grande...), paradas con coordenadas, recorrido (polilínea), horarios de operación y frecuencia. Crea un seed con datos de ejemplo claramente marcados como ficticios y un script para cargar datos reales cuando los tengamos. Muestra el modelo en docs/DATA_MODEL.md y reemplaza src/data/routes.ts por una capa de acceso a datos (repository) que hoy lea del seed.
```

**2.3 Backend**
```
Propón y crea el backend: Supabase (Postgres + PostGIS + Realtime) o Node + Fastify + Postgres. Compara ambas en docs/ADR-001-backend.md (costo para un piloto, tiempo real, facilidad) y elige una. Implementa tablas para rutas, paradas, busetas, viajes compartidos, reportes de cupo y usuarios (con auth anónima por defecto). Conecta la app con una capa API tipada y variables de entorno en .env.example.
```

**2.4 Recomendación de ruta**
```
Implementa el motor de recomendación: dado origen, destino y hora de entrada a clase, devuelve las rutas posibles ordenadas por la que permite llegar a tiempo con más margen. Considera caminata a la parada, espera, trayecto y caminata final. Muestra en "Elegir ruta" el tiempo estimado, el margen y una etiqueta como "Llegas 15 min antes" o "Llegas tarde". Cubre el cálculo con tests unitarios, incluyendo casos límite.
```

---

## Etapa 3 · Tiempo real y comunidad

**3.1 Ubicación compartida en vivo**
```
Implementa "Compartir mi recorrido": al pulsar Compartir, empieza a enviar la posición del usuario al backend cada pocos segundos, asociada a una ruta y a un viaje anónimo (sin datos personales). Usa tareas en segundo plano con expo-location y cuida la batería. Detén el envío al pulsar "Dejar de compartir" y automáticamente al detectar que el usuario bajó (velocidad y distancia a la ruta). Muestra en "Bus en el mapa" la posición agregada del bus a partir de varios viajeros.
```

**3.2 QR del bus**
```
Implementa "Escanear el QR del bus" con expo-camera. El QR identifica la buseta (id del bus y ruta). Valida el QR contra el backend, vincula el viaje a esa buseta y confirma con una animación breve. Define el formato del QR en docs/QR_FORMAT.md y agrega un script que genere QR de prueba. Si el usuario no escanea, el viaje sigue funcionando por ruta.
```

**3.3 Cupo del bus**
```
Conecta los botones Lleno / Medio / Vacío de "En viaje" al backend. Agrega los reportes de varios viajeros con una regla simple (la mayoría reciente, expiran a los 10 minutos) y muestra en "Alerta de llegada" y en "Elegir ruta" el cupo con la hora del último reporte. Evita que un solo usuario sature con reportes (límite por viaje).
```

**3.4 Retrasos, tráfico y alternativas**
```
Detecta retrasos comparando la posición real de la buseta con el horario esperado. Cuando una ruta tenga retraso grande, desvío o falla de una buseta, muestra un aviso en la pantalla "Bus en el mapa" (como el de "Rancho Grande: sin reportes") y sugiere automáticamente la mejor alternativa con su hora de llegada. Añade el botón "Buscar otra ruta" funcional que recalcula con el motor de recomendación.
```

---

## Etapa 4 · Personalización y notificaciones

**4.1 Perfil del estudiante**
```
Crea el perfil: lugares frecuentes (casa, universidad, trabajo) y horario de clases por día. Pantalla para editarlo, guardado local y sincronizado cuando haya cuenta. El perfil es opcional y se puede borrar completo desde la app.
```

**4.2 Rutas basadas en el perfil + notificaciones**
```
Con el perfil, sugiere cada mañana la ruta y la hora de salida recomendadas para llegar a la primera clase. Implementa notificaciones push con expo-notifications: aviso de salida ("Sal en 10 min para llegar a tu clase de las 7"), alerta de llegada del bus y aviso de retraso en tu ruta habitual. El usuario puede activar o desactivar cada tipo.
```

---

## Etapa 5 · Modelo predictivo

**5.1 Datos y línea base**
```
Diseña la recolección de datos para el modelo predictivo: cada viaje compartido guarda (ruta, parada, hora de paso, hora real vs. esperada, día de la semana, festivo, clima si hay API disponible). Solo para usuarios que lo aceptan expresamente. Crea las tablas, un pipeline de limpieza y un notebook o script en /ml con una línea base (promedio por ruta, franja horaria y día) y su error (MAE). Incluye el calendario de festivos de Colombia y eventos de la universidad (inicio de semestre, parciales, grados).
```

**5.2 Modelo y despliegue**
```
Entrena un modelo para estimar el tiempo de llegada de cada buseta usando gradient boosting (LightGBM o similar) con las variables de la etapa 5.1. Evalúa contra la línea base con validación por tiempo (no aleatoria). Expón el modelo como un servicio (/predict) y haz que la app lo use, con respaldo a la línea base si el servicio falla. Muestra un rango ("5–7 min") cuando la incertidumbre sea alta. Documenta cómo reentrenar en /ml/README.md.
```

---

## Etapa 6 · Privacidad, seguridad y lanzamiento

**6.1 Privacidad y consentimiento**
```
Revisa todo el flujo de datos y asegura el cumplimiento de la Ley 1581 de 2012 (habeas data, Colombia): pantalla de consentimiento clara en español para ubicación y para participar en el modelo, política de tratamiento de datos, anonimización de viajes, retención limitada y botón "Borrar mis datos". Documenta en docs/PRIVACY.md qué se guarda y por cuánto tiempo. Marca lo que deba revisar un abogado.
```

**6.2 Antiabuso**
```
Protege contra reportes falsos y ubicaciones falsas: límites de frecuencia, validación de que la posición esté cerca de la ruta, descarte de valores atípicos y reputación simple por dispositivo. No bloquees a nadie sin aviso. Añade pruebas con datos manipulados.
```

**6.3 Piloto y publicación**
```
Prepara un piloto con estudiantes de Unicórdoba: configuración de EAS Build (Android primero), canal interno de pruebas, formulario de feedback dentro de la app y seguimiento de errores con Sentry. Crea una guía docs/PILOTO.md con métricas de éxito (usuarios activos, precisión del ETA, viajes compartidos).
```

---

## Etapa 7 · Anuncios (después de validar la app)

**7.1 Espacios publicitarios**
```
Convierte los anuncios de muestra de src/data/ads.ts en un sistema de anuncios: contrato de datos (anunciante, creatividad, vigencia, ubicación, segmentación), componente AdBanner con etiqueta "Anuncio" siempre visible, y reglas de colocación: franja en "Elegir ruta", tarjeta en "Alerta de llegada", nunca en "En viaje". Prioriza negocios cercanos a la universidad y a las paradas. Frecuencia máxima configurable.
```

**7.2 Monetización**
```
Evalúa en docs/ADR-002-ads.md dos caminos: (a) anunciantes locales vendidos directamente (cafeterías, papelerías, gimnasios) con panel simple para subir anuncios, y (b) una red como AdMob. Compara ingresos esperados, privacidad (sin vender datos de ubicación) y esfuerzo. Implementa el camino (a) con un panel mínimo y medición de impresiones y clics.
```

**7.3 Medición**
```
Agrega analítica respetuosa de la privacidad: impresiones y clics por anuncio, sin identificadores personales. Crea un reporte semanal para el anunciante (impresiones, clics, CTR) y un tablero interno.
```

---

### Consejos para trabajar con Claude Code

- Pide un **plan primero** en tareas grandes ("antes de escribir código, propón el plan y espera mi OK").
- Haz un commit por prompt; revisa el diff antes de seguir.
- Si algo del diseño cambia en Figma, vuelve al prompt 1.1.
- Mantén `CLAUDE.md` actualizado con las decisiones importantes.
