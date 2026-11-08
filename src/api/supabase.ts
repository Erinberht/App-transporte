// Cliente de Supabase (https://docs.expo.dev/guides/using-supabase/).
//
// Es opcional: sin EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY la app
// funciona sin backend, con las rutas que trae incluidas. Ver .env.example y docs/BACKEND.md.
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

export type SupabaseConfig = { url: string; publishableKey: string };

/** Lee la configuración. Expo solo reemplaza `process.env.EXPO_PUBLIC_*` escrito así, literal. */
export function readSupabaseConfig(
  env = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabaseConfig | null {
  const url = env.url?.trim();
  const publishableKey = env.publishableKey?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

let client: AppSupabaseClient | null | undefined;

/** Cliente único de la app, o null si el backend no está configurado. */
export function getSupabase(): AppSupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig();
  if (!config) return (client = null);

  client = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Renovar la sesión solo con la app en primer plano.
  const current = client;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') current.auth.startAutoRefresh();
    else current.auth.stopAutoRefresh();
  });

  return client;
}
