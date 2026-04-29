import { createClient } from '@supabase/supabase-js';

// Usamos um texto de "fallback" para enganar o Next.js durante a compilação
// assim ele nunca trava o build, mesmo que o Netlify demore a injetar as chaves.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mcxjfxmjncwttwknqzsw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jeGpmeG1qbmN3dHR3a25xenN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjQwOTcsImV4cCI6MjA5MjMwMDA5N30.B9CrKf6vBFE50IJJ5eAelusws2Mwk03M9yLdJV8JwW8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);