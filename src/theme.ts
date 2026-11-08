// Tokens de diseño extraídos del archivo de Figma VjOT24SKfGNoZXmTJTFO4M (flujo "Mi bus",
// nodos 7:2161 a 7:2472). El archivo no define variables de Figma (get_variable_defs
// devuelve vacío), así que estos valores salen de los estilos de cada nodo (get_design_context).
export const colors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#DEE5EE',
  text: '#182B43',
  textMuted: '#68788B',
  onPrimary: '#FFFFFF',

  primary: '#235ED7',
  primarySoft: '#EAF0FE',

  success: '#19805B',
  successSoft: '#E7F5ED',

  danger: '#9E504C',
  dangerSoft: '#FCEDEC',
  // Advertencia ("Llegas justo"). No está en el Figma: tono ámbar con contraste AA sobre su fondo.
  warning: '#8A5A00',
  warningSoft: '#FDF3DC',
  route: '#D36D68',

  mapBase: '#F0F1EC',
  mapBlock: '#E4E6DF',
  mapPark: '#DCE9D9',
  mapRiver: '#CFE2EF',
  mapStreet: '#FFFFFF',
} as const;

// Radios usados en el diseño: 5 (manzanas), 8 (etiquetas del mapa), 10 (íconos, avisos,
// opciones pequeñas), 16 (tarjetas y botones), 20 (mapa), 100 (píldoras).
export const radius = { xs: 5, chip: 8, sm: 10, md: 16, lg: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;

// Tipografía: Inter (cargada en src/app/_layout.tsx con @expo-google-fonts/inter).
// En React Native cada peso es una familia distinta, por eso se usa fontFamily y no fontWeight.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// Escala de texto del diseño (tamaño en px).
export const fontSize = {
  mapLabel: 9,
  tiny: 10,
  caption: 11,
  small: 12,
  body: 13,
  bodyLg: 14,
  button: 15,
  brand: 15,
  lead: 16,
  heading: 17,
  title3: 18,
  alert: 26,
  title: 27,
  eta: 29,
} as const;

/** Interlineado "relajado" del diseño (1.45) para textos de varias líneas. */
export const lineHeight = (size: number, ratio = 1.45) => Math.round(size * ratio);
