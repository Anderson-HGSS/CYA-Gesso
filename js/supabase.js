import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (SUPABASE_URL === 'https://bymwinebienzvaimiadh.supabase.co' || SUPABASE_ANON_KEY === 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg') {
  console.warn('Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js.');
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
