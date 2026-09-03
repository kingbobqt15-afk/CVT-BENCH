(function(){
'use strict';

const SUPABASE_URL = 'https://uwmwiklhgdykjckjrjjd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W5PfQZ-_iXlLYEo7JU7AmA_ySJWUTfY';

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('CVT//BENCH: Supabase browser library did not load.');
  return;
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.CVTBenchSupabase = client;
window.CVTBenchSupabaseConfig = { url: SUPABASE_URL };
console.log('CVT//BENCH: Supabase client initialized.');
})();
