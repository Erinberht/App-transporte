# Modelo de datos de rutas

Modelo inspirado en [GTFS](https://gtfs.org/es/documentation/schedule/reference/), simplificado para las busetas de Montería. Los tipos están en `src/data/model.ts`, la validación en `src/data/validate.ts` y el acceso desde la app en `src/data/repository.ts`.

## Estado de los datos (noviembre de 2026)

| Dato                                         | Origen                                  | Calidad      |
| -------------------------------------------- | --------------------------------------- | ------------ |
| Códigos y nombres de las 10 rutas            | Listado público de líneas de Metrosinú  | Real         |
| Paradas, coordenadas y recorridos            | Inventados para desarrollo              | **Ficticio** |
| Horarios y frecuencias                       | Inventados (patrón típico de hora pico) | **Ficticio** |
| Llegada en vivo, avisos (`src/data/live.ts`) | Muestra fija                            | **Ficticio** |

Las 10 rutas son las que, según fuentes públicas, pasan cerca de la sede Montería de Unicórdoba: **6M** 6 de Marzo, **AE** Terminal – Aeropuerto, **D1** Dorado, **M1** Mogambo 22, **P1** Pradera 27, **P2** Pradera Mercasur, **P3** Panzenú, **RG** Rancho Grande, **S1** Santander y **T2** Tambo.

> No hay recorridos oficiales abiertos: OpenStreetMap no tiene rutas de bus en Montería y la Alcaldía no los publica. Las listas de paradas de Moovit tienen derechos, así que no se copian. Para tener datos reales: (1) pedirlos con un derecho de petición a la Secretaría de Tránsito y a Metrosinú, o (2) levantarlos con GPS recorriendo cada ruta. La app muestra "Recorrido aproximado (datos de prueba)" mientras la calidad no sea `verificado`.

## Entidades

```
TransitDataset
├── source        (kind: seed | import, description, generatedAt)
├── stops[]       Stop: id, name, coordinate
└── routes[]      BusRoute: id, shortName, longName, operator, color
    ├── patterns[]  RoutePattern: id, direction (0 ida a la U, 1 regreso), headsign, quality
    │   ├── stops[]   PatternStop: stopId → Stop, minutesFromStart
    │   └── shape[]   LatLng (polilínea en orden)
    └── service[]   ServicePeriod: days (weekday | saturday | sunday_holiday), quality
        └── headways[] Headway: from "HH:MM", to "HH:MM" (excluida), everyMinutes
```

`quality` puede ser `ficticio`, `aproximado` (trazado con referencias) o `verificado` (GPS en campo o fuente oficial). Va por recorrido y por horario, para poder reemplazar las rutas una por una.

### Equivalencias con GTFS

| Este modelo                    | GTFS                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `Stop`                         | `stops.txt`                                                                    |
| `BusRoute`                     | `routes.txt` (`route_short_name`, `route_long_name`, `route_color`)            |
| `RoutePattern`                 | `trips.txt` con un mismo `shape_id` y secuencia de paradas, más `shapes.txt`   |
| `PatternStop.minutesFromStart` | `stop_times.txt` (tiempos relativos a la salida)                               |
| `ServicePeriod.days`           | `calendar.txt` (los festivos se tratan como domingo, vía `calendar_dates.txt`) |
| `Headway`                      | `frequencies.txt` (`exact_times = 0`)                                          |

Las busetas de Montería no tienen horario fijo por viaje sino frecuencia, por eso no hay `trips` individuales. Si algún día se exporta a GTFS, cada patrón y franja genera viajes con `frequencies.txt`.

## Reglas de validación

Las aplica `validateDataset` al importar y al arrancar la app (`parseDataset`):

- Ids únicos de paradas, rutas, recorridos y tipos de día por ruta.
- Coordenadas de paradas y trazados dentro de Montería (lat 8,60–8,95, lng −76,00 a −75,70). Atrapa latitud y longitud invertidas.
- Cada recorrido: al menos 2 paradas existentes, minutos que no retroceden y trazado de 2 o más puntos.
- Franjas `HH:MM` válidas (hasta `24:00`), que avanzan, ordenadas, sin solaparse y con frecuencia entera mayor que 0.
- Color `#RRGGBB`.

## Cargar datos (CSV)

Una carpeta con estos archivos (UTF-8, coma como separador, comillas dobles si hace falta):

| Archivo                 | Columnas                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| `routes.csv`            | `route_id, short_name, long_name, operator, color`                     |
| `stops.csv`             | `stop_id, name, lat, lng`                                              |
| `patterns.csv`          | `pattern_id, route_id, direction, headsign, quality`                   |
| `pattern_stops.csv`     | `pattern_id, sequence, stop_id, minutes_from_start` (minutos opcional) |
| `service.csv`           | `route_id, days, from, to, every_minutes, quality`                     |
| `shapes.csv` (opcional) | `pattern_id, sequence, lat, lng`                                       |

- Si `minutes_from_start` está vacío, se estima por distancia a 18 km/h más 30 s por parada.
- Si falta `shapes.csv`, el trazado une las paradas en línea recta.
- Un levantamiento con GPS (GPX o CSV del celular) se convierte en `shapes.csv` con `sequence, lat, lng` por punto.

```bash
npm run data:seed                      # regenera src/data/dataset.json desde data/seed (ficticio)
npm run data:import -- data/real \
  --description "Recorridos levantados con GPS, nov. 2026"
npm run data:import -- data/real --out /tmp/prueba.json   # probar sin tocar la app
```

El script valida todo y, si hay errores, no escribe nada y termina con código 1. Después de importar, corre `npm test`: `src/data/__tests__/dataset.test.ts` revisa el archivo que usa la app. Si los datos dejan de ser ficticios, actualiza ese test.

## Uso desde la app

```ts
import { routesRepository } from '../data/repository';

routesRepository.listRoutes(); // 10 rutas
routesRepository.getPatternStops('P1'); // paradas en orden, con minutos
routesRepository.nearestPatternStop('P1', origin); // parada más cercana al usuario
routesRepository.routesNear(origin, 500); // rutas a menos de 500 m
routesRepository.nextDepartures('P1', new Date(), { stopId: 'pradera', count: 3 });
```

La interfaz es síncrona: trabaja sobre un `TransitDataset` en memoria. Con el backend (etapa 2.3), la app descargará el mismo JSON, lo guardará para usarlo sin conexión y llamará `createRoutesRepository(dataset)`. Las pantallas no cambian.

Limitaciones conocidas: no hay calendario de festivos (`isHoliday` lo pasa quien llama) y no se modela servicio después de medianoche.
