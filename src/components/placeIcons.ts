import { Briefcase, GraduationCap, House, MapPin, type LucideIcon } from 'lucide-react-native';

import type { Destination } from '../data/destinations';

/** Ícono de cada tipo de destino (universidad o lugar del usuario). */
export const PLACE_ICONS: Record<Destination['icon'], LucideIcon> = {
  campus: GraduationCap,
  home: House,
  work: Briefcase,
  other: MapPin,
};
