// Tokens de diseño tomados del prototipo de Figma ("Untitled", flujo "Mi bus").
// Valores aproximados a partir de las capturas: ajustar con get_variable_defs / get_design_context
// de Figma cuando se afine el diseño.
export const colors = {
  background: '#F4F7FC',
  surface: '#FFFFFF',
  border: '#DCE3EE',
  text: '#14223D',
  textMuted: '#66758C',

  primary: '#2360D9',
  primarySoft: '#E8F0FE',

  success: '#1E8A5B',
  successSoft: '#E4F4EB',

  danger: '#C0453F',
  dangerSoft: '#FCE8E6',
  route: '#D9534F',

  mapBase: '#EEF0E8',
  mapBlock: '#E0E3DA',
  mapPark: '#DCEBD7',
  mapRiver: '#CFE3F1',
  mapStreet: '#FFFFFF',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;
