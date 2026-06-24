import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder';

// A validação foi movida para runtime (quando a API é efetivamente chamada)
// para não quebrar o `next build`.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

