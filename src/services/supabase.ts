import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ewqlronqewlghdkhuflw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cWxyb25xZXdsZ2hka2h1Zmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY4MzMsImV4cCI6MjA4Nzk2MjgzM30.3OXwn-cyXsqbfzqalydy1hRZaaE6X720c7CU-zJmSkE';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);