import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getSupabase } from '../api/supabase';
import { ScreenLayout } from '../components/ScreenLayout';
import { Button } from '../components/Button';
import { colors, radius, spacing, fonts, fontSize } from '../theme';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Completa la sesión web (requerido para funcionamiento en algunos navegadores integrados)
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  async function signInWithGoogle() {
    const supabase = getSupabase();
    if (!supabase) return;

    // Obtenemos el "Deep Link" al que debe volver la app tras validar en Google
    const redirectTo = Linking.createURL('');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true, // Importante para usar con expo-web-browser
      },
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (data?.url) {
      // Abre el navegador del sistema para iniciar sesión
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success') {
        const { url } = res;
        // Parsear el Token y Refesh Token desde la URL enviada por Supabase (ej: mibus://#access_token=...)
        const { queryParams } = Linking.parse(url);

        const access_token = queryParams?.access_token as string;
        const refresh_token = queryParams?.refresh_token as string;

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) {
            Alert.alert('Error', sessionError.message);
          } else {
            router.back();
          }
        }
      }
    }
  }

  async function signInWithEmail() {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert('Error', 'Supabase no está configurado');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Error al iniciar sesión', error.message);
    } else {
      router.back();
    }
  }

  async function signUpWithEmail() {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert('Error', 'Supabase no está configurado');
      return;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Error al registrarse', error.message);
    } else if (!session) {
      Alert.alert('Revisa tu correo', 'Por favor verifica tu correo para continuar.');
    } else {
      router.back();
    }
  }

  const handleAction = isLogin ? signInWithEmail : signUpWithEmail;

  return (
    <ScreenLayout
      title={isLogin ? 'Iniciar Sesión' : 'Registro'}
      subtitle={
        isLogin
          ? 'Inicia sesión para guardar tu perfil en la nube'
          : 'Crea tu cuenta para respaldar tus datos'
      }
      ctaLabel={isLogin ? 'Iniciar Sesión' : 'Registrarse'}
      onCta={handleAction}
      footerNote={
        isLogin
          ? '¿No tienes cuenta? Toca aquí para registrarte'
          : '¿Ya tienes cuenta? Toca aquí para iniciar sesión'
      }
      headerAction={
        <Text style={styles.toggleBtnText} onPress={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Registrarse' : 'Ingresar'}
        </Text>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setEmail(text)}
            value={email}
            placeholder="tu@correo.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setPassword(text)}
            value={password}
            secureTextEntry={true}
            placeholder="Contraseña"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>O continuar con</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.googleContainer}>
          <Button label="Google" variant="outline" onPress={signInWithGoogle} />
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
  toggleBtnText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.body,
    color: colors.primary,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
  },
  googleContainer: {
    marginTop: spacing.xs,
  },
});
