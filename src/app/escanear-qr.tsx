import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, QrCode, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { getSupabase } from '../api/supabase';
import { lookupBus, type BusInfo } from '../api/transit';
import { getRouteOrDefault } from '../data/repository';
import { BUS_QR_PREFIX, BUS_QR_VERSION } from '../qr/busQr';
import { resolveScan, scanProblemText, type ScanOutcome } from '../qr/resolveScan';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

/** Cuánto se muestra la confirmación antes de volver a "Compartir". */
export const CONFIRM_MS = 1500;

type Phase = { kind: 'scanning' } | { kind: 'checking' } | ScanOutcome;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/compartir');
}

// "Escanear el QR del bus" (opcional, desde "Compartir"). También se abre desde un enlace
// mibus://bus/v1/<código> si se escanea el QR con la cámara normal del teléfono.
export default function ScanBusScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { routeId, setRouteId, setBus } = useTrip();
  const route = getRouteOrDefault(routeId);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>(code ? { kind: 'checking' } : { kind: 'scanning' });
  // La cámara entrega el mismo QR muchas veces por segundo: solo se procesa el primero.
  const busy = useRef(false);

  const check = useCallback(
    async (data: string) => {
      if (busy.current) return;
      busy.current = true;
      setPhase({ kind: 'checking' });
      const client = getSupabase();
      const outcome = await resolveScan(data, routeId, client ? (c) => lookupBus(client, c) : null);
      setPhase(outcome);
    },
    [routeId],
  );

  // Abierto desde un enlace: el código ya viene, no hace falta la cámara.
  useEffect(() => {
    if (code) check(`${BUS_QR_PREFIX}${BUS_QR_VERSION}/${code}`);
  }, [code, check]);

  const link = useCallback(
    (bus: BusInfo) => {
      // El bus se guarda al mostrar la confirmación (<Linked>).
      if (bus.routeId !== routeId) setRouteId(bus.routeId);
      setPhase({ kind: 'linked', bus });
    },
    [routeId, setRouteId],
  );

  const scanAgain = () => {
    busy.current = false;
    setPhase({ kind: 'scanning' });
  };

  if (phase.kind === 'linked') return <Linked bus={phase.bus} onLinked={() => setBus(phase.bus)} />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Escanear el QR del bus
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={12}
          onPress={close}
          style={styles.close}
        >
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {phase.kind === 'scanning' && !permission ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}

        {phase.kind === 'scanning' && permission && !permission.granted ? (
          <View style={styles.card}>
            <Camera size={32} color={colors.primary} />
            <Text style={styles.cardTitle}>Permite usar la cámara</Text>
            <Text style={styles.cardBody}>
              Solo para leer el QR pegado en el bus. No se toman ni se guardan fotos.
            </Text>
            {permission.canAskAgain ? (
              <Button label="Permitir cámara" onPress={requestPermission} />
            ) : (
              <Button label="Abrir ajustes" onPress={() => Linking.openSettings()} />
            )}
          </View>
        ) : null}

        {phase.kind === 'scanning' && permission?.granted ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }: BarcodeScanningResult) => check(data)}
              accessibilityLabel="Cámara para leer el QR del bus"
            />
            <View style={styles.frame} pointerEvents="none" />
          </View>
        ) : null}

        {phase.kind === 'checking' ? (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.cardBody}>Validando el bus…</Text>
          </View>
        ) : null}

        {phase.kind === 'other_route' ? (
          <View style={styles.card}>
            <QrCode size={32} color={colors.warning} />
            <Text style={styles.cardTitle}>
              Este bus es de la ruta {getRouteOrDefault(phase.bus.routeId).shortName}
            </Text>
            <Text style={styles.cardBody}>
              Elegiste la ruta {route.shortName}. ¿Vas en el bus {phase.bus.code}?
            </Text>
            <Button
              label={`Cambiar a ${getRouteOrDefault(phase.bus.routeId).shortName}`}
              onPress={() => link(phase.bus)}
            />
            <Button label="Escanear otro" variant="outline" onPress={scanAgain} />
          </View>
        ) : null}

        {phase.kind === 'invalid' || phase.kind === 'error' ? (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <QrCode size={32} color={colors.danger} />
            <Text style={styles.cardTitle}>{scanProblemText(phase).title}</Text>
            <Text style={styles.cardBody}>{scanProblemText(phase).body}</Text>
            <Button label="Escanear otro" onPress={scanAgain} />
            <Button label="Seguir sin escanear" variant="outline" onPress={close} />
          </View>
        ) : null}
      </View>

      {phase.kind === 'scanning' ? (
        <Text style={styles.hint}>
          Apunta al QR de Mi bus pegado dentro de la buseta. Es opcional: puedes compartir sin él.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

/** Confirmación breve (check que aparece con un rebote) y vuelta a "Compartir". */
function Linked({ bus, onLinked }: { bus: BusInfo; onLinked: () => void }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));
  const route = getRouteOrDefault(bus.routeId);

  useEffect(() => {
    onLinked();
    AccessibilityInfo.announceForAccessibility?.(`Bus ${bus.code} vinculado`);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(close, CONFIRM_MS);
    return () => clearTimeout(timer);
    // Solo al montar: la confirmación se muestra una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[styles.root, styles.linked]} edges={['top', 'bottom']}>
      <Animated.View style={[styles.check, { opacity, transform: [{ scale }] }]}>
        <Check size={44} color={colors.onPrimary} strokeWidth={3} />
      </Animated.View>
      <Text style={styles.linkedTitle}>Bus vinculado</Text>
      <Text style={styles.linkedBody}>
        Bus {bus.code} · Ruta {route.shortName}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.title3, color: colors.text },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  cameraBox: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.onPrimary,
  },
  card: {
    gap: 12,
    padding: 20,
    alignItems: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight(fontSize.body),
    color: colors.textMuted,
  },
  hint: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
  linked: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  check: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedTitle: { fontFamily: fonts.bold, fontSize: fontSize.title, color: colors.success },
  linkedBody: { fontFamily: fonts.medium, fontSize: fontSize.bodyLg, color: colors.text },
});
