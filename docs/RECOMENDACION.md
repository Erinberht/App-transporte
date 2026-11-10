# Motor de recomendación de rutas

Código: `src/planner/recommend.ts`, una función pura con tests en `src/planner/__tests__`. La pantalla "Elegir ruta" lo usa a través de `useRoutePlan()`.

## Cálculo por ruta

```
llegada = ahora + caminata a la parada + espera del bus + trayecto + caminata al campus
margen  = hora de clase − llegada
```

1. **Parada de bajada:** la del recorrido más cercana al destino. Si es la primera del recorrido, la ruta va en el otro sentido y no sirve.
2. **Parada de subida:** se prueban todas las paradas anteriores a la de bajada y gana la que hace llegar antes. En empate gana la de menos caminata.
3. **Caminata:** distancia en línea recta × 1,3 (las calles no van rectas), a 4,5 km/h, redondeada hacia arriba.
4. **Espera:** el próximo paso del bus por la parada según el horario por frecuencia (`nextDepartures`). Si tarda más de 2 horas, la ruta "no opera a esta hora".
5. **Trayecto:** diferencia de `minutesFromStart` entre las paradas de subida y bajada.

## Opciones de caminata (como en Moovit)

Igual que en Moovit (Configuración → Planificador de viajes → Opciones de caminata):

| Opción                                 | Valores                                                     | Por defecto    |
| -------------------------------------- | ----------------------------------------------------------- | -------------- |
| Ritmo                                  | normal o **lento** (el doble de tiempo en cada tramo a pie) | normal         |
| Duración máxima de caminata, por tramo | 2 a 16 minutos                                              | **sin límite** |

Moovit no publica su velocidad base: los 4,5 km/h y el factor 1,3 son supuestos nuestros. Las preferencias se guardan en el perfil (`src/profile`, ver `docs/PERFIL.md`) y se editan en "Mi perfil" (el límite, de 2 en 2 minutos). El estado del viaje (`walking` en `src/state/trip.tsx`) las lee de ahí.

El destino puede ser la universidad o un lugar del perfil. Una ruta no sirve si su parada más cercana al destino queda a más de 1,2 km (`MAX_ALIGHT_DISTANCE_METERS`); si ninguna sirve, `noRouteNotice` arma el aviso de "Elegir ruta".

## Orden y etiquetas

1. Rutas que llegan a tiempo, de **mayor a menor margen**. En empate: menos caminata total y luego menos trayecto.
2. Rutas que llegan tarde, de la menos tarde a la más tarde.
3. Rutas que no sirven: caminata mayor que el límite, sin servicio, o recorrido en sentido contrario.

| Margen      | Etiqueta                      |
| ----------- | ----------------------------- |
| 5 min o más | "Llegas N min antes" (verde)  |
| 0 a 4 min   | "Llegas justo" (ámbar)        |
| negativo    | "Llegas tarde · N min" (rojo) |

## Casos especiales

- **Hora de clase:** si ya pasó hace más de 60 minutos, se toma la de mañana. Por ejemplo, a las 8 p. m. la clase de las 7 a. m. es la de mañana. Si pasó hace menos, se mantiene la de hoy y la ruta aparece como "Llegas tarde".
- **Falta mucho:** con más de 90 minutos de anticipación, la mejor ruta muestra "sal a más tardar a las X". Ese es el último bus que aún te deja llegar con 10 minutos de colchón.
- **Muy cerca:** si el campus está a 600 m o menos por calles, aparece "Te conviene ir caminando".
- **Sin ubicación:** no se calcula nada. Se muestran las rutas en el orden del catálogo y un aviso para activar la ubicación.

## Limitaciones

Los horarios del seed son ficticios. Además, en un servicio por frecuencia la hora exacta de paso no es real: la espera calculada es la del horario. Cuando exista la posición en vivo (3.1) y el modelo predictivo (etapa 5), el paso 4 usará esos tiempos y lo demás seguirá igual.
