import { Redirect, useLocalSearchParams } from 'expo-router';

// Enlace del QR (mibus://bus/v1/<código>, ver docs/QR_FORMAT.md): si el QR se escanea con la
// cámara normal del teléfono, la app se abre aquí y valida el bus en "Escanear el QR del bus".
export default function BusQrLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/escanear-qr', params: { code } }} />;
}
