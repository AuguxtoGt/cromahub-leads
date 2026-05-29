import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('from_me', false)
    .order('timestamp', { ascending: false })
    .limit(5);
  console.log("Incoming messages:", data?.length, error);
  if (data?.length) {
    console.log(data.map(d => ({ id: d.id, content: d.content, timestamp: d.timestamp })));
  }
}
check();
