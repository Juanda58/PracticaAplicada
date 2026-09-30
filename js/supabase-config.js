// supabase-config.js — configuración pública del proyecto Supabase
// Pega aquí los valores desde Supabase > Project Settings > API.
// Usa únicamente la anon public key. Nunca pegues la service_role key en este archivo.
'use strict';

const SUPABASE_CONFIG = {
  url: 'https://bzahalpkdfsmqvxezxqb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6YWhhbHBrZGZzbXF2eGV6eHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDAzMzYsImV4cCI6MjEwMzkxNjMzNn0.gzb3XKeUjfQtsD1vV5tNNIMI45GfndikF2VggdyPQOQ',
};

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.includes('TU-PROYECTO') &&
    !SUPABASE_CONFIG.anonKey.includes('PEGA_AQUI')
  );
}

function supabaseConfigLabel() {
  return isSupabaseConfigured() ? 'Configurado' : 'Pendiente de configurar';
}