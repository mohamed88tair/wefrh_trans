/**
 * Supabase Client Configuration
 * Uses environment variables for connection
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and Key from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Server-side doesn't need session persistence
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
});

// Helper function to check connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('ai_models').select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}
