# Formato del QR del bus

Cada buseta lleva un QR pegado por dentro. Escanearlo es **opcional**: vincula el viaje compartido a esa buseta. Sin escanear, el viaje funciona igual, solo con la ruta.

## Contenido

```
mibus://bus/v1/<código>
```

Ejemplo: `mibus://bus/v1/PRUEBA-P3-01`

| Parte      | Significado                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mibus://` | Esquema de la app (`scheme` en `app.json`). Con la cámara normal del teléfono, abre Mi bus si está instalada.                              |
| `bus/`     | Tipo de QR. Hoy solo existe `bus`.                                                                                                         |
| `v1/`      | Versión del formato. Una versión nueva no rompe los QR ya impresos: la app dice "Actualiza la app".                                        |
| `<código>` | Código de la buseta, `buses.code` en la base. Lleva mayúsculas, números y guiones, de 2 a 32 caracteres, y no empieza ni termina en guion. |

- **Lo que no lleva el QR:** ni la ruta ni datos secretos. La ruta se consulta en el servidor (`buses.route_id`), así que si un bus cambia de ruta no hay que reimprimir nada. Un QR falso solo sirve si su código existe en la base.
- **Al leerlo:** se toleran mayúsculas y minúsculas, espacios alrededor y una `/` al final.
- **Código:** `src/qr/busQr.ts` (`formatBusQr` y `parseBusQr`).

## Validación

`src/qr/resolveScan.ts` interpreta lo que lee la cámara:

| Resultado     | Cuándo                                                                  | Qué hace la app                                                |
| ------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `linked`      | Bus activo de la ruta elegida                                           | Confirmación de 1,5 s y vuelve a Compartir                     |
| `other_route` | Bus activo de otra ruta                                                 | Pregunta "¿Cambiar a M1?"                                      |
| `invalid`     | QR ajeno, otra versión, código mal formado o bus inexistente o inactivo | Explica el motivo y ofrece escanear otro o seguir sin escanear |
| `error`       | Sin servidor configurado o sin conexión                                 | Igual que `invalid`                                            |

- **Vinculación en el servidor:** el viaje se crea con `shared_trips.bus_id`. Un trigger (`check_trip_bus`) rechaza los buses inexistentes, inactivos o de otra ruta, y el bus no se puede cambiar después.
- **Cámara:** solo lee el QR. No se toman ni se guardan fotos, y la app no pide permiso de micrófono (`recordAudioAndroid: false`).

## Busetas y QR de prueba

- `data/seed/buses.csv` trae 2 busetas por ruta (`PRUEBA-<ruta>-01` y `-02`). `npm run data:seed` (o `data:sql`) las incluye en `supabase/seed.sql`. Las que se quiten del CSV se **desactivan**, sin borrarse, y su QR deja de valer.
- `npm run qr:generate` genera en `data/qr/` (ignorada por git) un SVG por buseta y `index.html` para imprimir: 5 × 5 cm, con corrección de errores M.
- Los QR de prueba no se pegan en buses reales. Las busetas reales se cargan cuando haya acuerdo con las empresas, con otro CSV: `npm run data:sql -- --buses reales.csv` y `npm run qr:generate -- --in reales.csv`.
