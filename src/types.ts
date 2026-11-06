export type Occupancy = 'full' | 'medium' | 'empty';

export type Route = {
  id: string;
  name: string;
  /** Minutos estimados de llegada a la parada del usuario (dato de muestra). */
  etaMinutes: number;
  /** Aviso opcional (retrasos, sin reportes, desvíos...). */
  notice?: string;
};

export type Ad = {
  id: string;
  /** Marca ficticia: reemplazar por anunciantes reales cuando exista el modelo de negocio. */
  brand: string;
  headline: string;
  body: string;
  cta: string;
  accent: string;
  accentSoft: string;
  icon: string;
};
