// Modelo de datos de transporte, inspirado en GTFS pero simplificado para las busetas de Montería.
// Ver docs/DATA_MODEL.md (equivalencias con GTFS, formato CSV de importación y ejemplos).
//
// Este archivo solo declara tipos: lo usan la app y el script scripts/import-routes.ts.

export type LatLng = { latitude: number; longitude: number };

/** Calidad de un dato geográfico u horario. */
export type DataQuality =
  /** Inventado para desarrollo. No describe la realidad. */
  | 'ficticio'
  /** Trazado a partir de referencias (nombres de barrios, avenidas). Puede tener errores. */
  | 'aproximado'
  /** Levantado en campo (GPS) o entregado por la autoridad de tránsito / la empresa. */
  | 'verificado';

/** Parada física (GTFS: stops.txt). Una parada puede servir a varias rutas. */
export type Stop = {
  id: string;
  name: string;
  coordinate: LatLng;
};

/** Parada dentro de un recorrido, con el tiempo típico desde el inicio (GTFS: stop_times.txt). */
export type PatternStop = {
  stopId: string;
  /** Minutos típicos desde la salida en la cabecera, sin tráfico anormal. */
  minutesFromStart: number;
};

/**
 * Recorrido de una ruta en un sentido (GTFS: trips + shapes, agrupados por patrón).
 * direction 0 = hacia la universidad, 1 = de regreso.
 */
export type RoutePattern = {
  id: string;
  direction: 0 | 1;
  /** Letrero de destino, ej. "Unicórdoba". */
  headsign: string;
  /** Paradas en orden de recorrido. */
  stops: PatternStop[];
  /** Polilínea del recorrido, en orden. Empieza en la primera parada y termina en la última. */
  shape: LatLng[];
  quality: DataQuality;
};

/** Tipo de día (GTFS: calendar.txt). Los festivos de Colombia operan como domingo. */
export type DayType = 'weekday' | 'saturday' | 'sunday_holiday';

/** Franja en la que la ruta pasa con una frecuencia fija (GTFS: frequencies.txt). */
export type Headway = {
  /** Hora de inicio "HH:MM" (incluida). */
  from: string;
  /** Hora de fin "HH:MM" (excluida). */
  to: string;
  /** Minutos entre busetas. */
  everyMinutes: number;
};

/** Horario de operación de una ruta para un tipo de día. */
export type ServicePeriod = {
  days: DayType;
  /** Franjas de frecuencia, ordenadas y sin solaparse. Fuera de ellas la ruta no opera. */
  headways: Headway[];
  quality: DataQuality;
};

/** Ruta de buseta (GTFS: routes.txt). */
export type BusRoute = {
  id: string;
  /** Código del letrero, ej. "P1". */
  shortName: string;
  /** Nombre de la ruta, ej. "Pradera 27". */
  longName: string;
  /** Empresa que la opera. */
  operator: string;
  /** Color de la ruta en hexadecimal ("#RRGGBB"). */
  color: string;
  patterns: RoutePattern[];
  service: ServicePeriod[];
};

/** Conjunto completo de datos de rutas que usa la app. */
export type TransitDataset = {
  /** Versión del formato. Subir si cambia el modelo. */
  schemaVersion: 1;
  source: {
    kind: 'seed' | 'import';
    /** Explicación legible del origen de los datos y sus limitaciones. */
    description: string;
    /** Fecha de generación ISO 8601. */
    generatedAt: string;
  };
  stops: Stop[];
  routes: BusRoute[];
};
