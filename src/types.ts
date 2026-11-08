export type Occupancy = 'full' | 'medium' | 'empty';

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
