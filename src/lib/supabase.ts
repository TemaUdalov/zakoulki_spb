import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** false, пока в .env не прописаны ключи — тогда приложение покажет подсказку */
export const isConfigured = Boolean(url && key)

// Этот ключ публичный по задумке: данные защищают правила RLS в базе (см. supabase/schema.sql)
export const supabase = createClient(url ?? 'http://localhost', key ?? 'not-configured')
