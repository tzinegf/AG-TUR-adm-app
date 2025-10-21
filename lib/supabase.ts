import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Safely resolve extra from multiple Expo Constant shapes across platforms
const extra: any = (
  (Constants?.expoConfig as any)?.extra ||
  (Constants as any)?.manifest?.extra ||
  (Constants as any)?.manifest2?.extra ||
  {}
);

// Resolve env vars from process.env (Expo public) and fallback to app.json extra
const resolvedSupabaseUrl =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
  extra?.EXPO_PUBLIC_SUPABASE_URL;

const resolvedSupabaseAnonKey =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!resolvedSupabaseUrl || !resolvedSupabaseAnonKey) {
  console.warn(
    '[Supabase] Missing configuration: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set them in your environment or app.json under expo.extra.'
  );
}

// Use different storage for web and native
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

// Create client only when configuration is present; otherwise expose a proxy that throws on usage
export const supabase = (resolvedSupabaseUrl && resolvedSupabaseAnonKey)
  ? createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (new Proxy({}, {
      get(_target, prop) {
        throw new Error(
          `[Supabase] Client not configured. Please set EXPO_PUBLIC_SUPABASE_URL and ` +
          `EXPO_PUBLIC_SUPABASE_ANON_KEY (checked process.env and expo-constants). Accessed property: ${String(prop)}`
        );
      }
    }) as any);

// Database types
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface BusRoute {
  id: string;
  origin: string;
  destination: string;
  // Novos campos de data/hora
  departure_datetime?: string; // timestamp/text no banco
  arrival_datetime?: string;   // timestamp/text no banco
  // Campos antigos (se ainda existirem) mantidos como opcionais
  departure?: string;
  arrival?: string;
  price: number;
  bus_company: string;
  bus_type: string;
  // Optional relation to a bus; some DB triggers may rely on this
  bus_id?: string;
  amenities?: string[];
  duration?: string;
  status: string;
  total_seats?: number;
  available_seats?: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  route_id: string;
  seat_number: string;
  passenger_name: string;
  passenger_document: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  route_id: string;
  seat_number: string;
  passenger_name: string;
  passenger_document: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  seats: number;
  type: 'convencional' | 'executivo' | 'leito';
  status: 'active' | 'maintenance' | 'inactive';
  amenities?: string[];
  imageurl?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}
