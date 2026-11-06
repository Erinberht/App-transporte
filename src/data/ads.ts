import { colors } from '../theme';
import type { Ad } from '../types';

// Anuncios de MUESTRA con marcas ficticias, solo para mostrar cómo se verían en la app.
// Ubicaciones sugeridas: franja inferior en "Elegir ruta" y tarjeta en "Alerta de llegada";
// nunca durante "En viaje" para no distraer.
export const SAMPLE_ADS: Ad[] = [
  {
    id: 'cafe',
    brand: 'Café La Ceiba',
    headline: 'Tu tinto antes de clase',
    body: '2x1 en tintos con tu carnet · Frente a la entrada principal',
    cta: 'Ver oferta',
    accent: '#8A5A2B',
    accentSoft: '#F6EBDD',
    icon: 'coffee-outline',
  },
  {
    id: 'papeleria',
    brand: 'Papelería El Estudiante',
    headline: 'Impresiones desde $100',
    body: 'Copias, anillados y útiles · Abierto hasta las 8 pm',
    cta: 'Cómo llegar',
    accent: colors.primary,
    accentSoft: colors.primarySoft,
    icon: 'printer-outline',
  },
  {
    id: 'almuerzo',
    brand: 'Corrientazo Montería',
    headline: 'Almuerzo estudiantil $9.000',
    body: 'Sopa, seco y jugo · Pide por la app y recoge sin fila',
    cta: 'Pedir',
    accent: colors.success,
    accentSoft: colors.successSoft,
    icon: 'silverware-fork-knife',
  },
  {
    id: 'gimnasio',
    brand: 'Gym Sinú Fit',
    headline: 'Matrícula gratis para estudiantes',
    body: 'Presenta tu carnet de Unicórdoba este mes',
    cta: 'Saber más',
    accent: colors.danger,
    accentSoft: colors.dangerSoft,
    icon: 'dumbbell',
  },
];
