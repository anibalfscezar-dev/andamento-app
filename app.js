
// Supabase config (usar seu projeto)
const SUPABASE_URL = 'https://fzcflkbhjbxifvjrltwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y2Zsa2JoamJ4aWZ2anJsdHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTk3OTQsImV4cCI6MjA3MjU3NTc5NH0.Ocb6Q7BDzC67v5l9VZx340Tp04RP5AbYAVV8nCxFPL8';
const supaReady = new Promise((resolve)=>{ if(window.supabase) return resolve(); const s=document.createElement('script'); s.src='https://unpkg.com/@supabase/supabase-js@2'; s.onload=resolve; document.head.appendChild(s); });
async function supaClient(){ await supaReady; if(!window._supa){ window._supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: {} } }); } return window._supa; }

// Helpers: hash SHA-256
async function sha256Hex(text){ const enc=new TextEncoder().encode(text); const buf=await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

// Admin headers via CPF+senha(hash)
function setAdminHeaders(cpf, passhash){ localStorage.setItem('admin_cpf', cpf); localStorage.setItem('admin_pass', passhash); }
function getAdminHeaders(){ return { 'x-admin-cpf': localStorage.getItem('admin_cpf')||'', 'x-admin-pass': localStorage.getItem('admin_pass')||'' }; }
function applyGlobalHeaders(){ const hdr=getAdminHeaders(); supaClient().then(s=>{ s.rest.headers = { ...(s.rest.headers||{}), ...hdr }; }); }
applyGlobalHeaders();

async function loginOperatorCPF(cpf, senha){
  cpf = String(cpf||'').replace(/\D/g,'');
  const passhash = await sha256Hex((senha||''));
  setAdminHeaders(cpf, passhash);
  applyGlobalHeaders();
  const s = await supaClient();
  // sanity check: trigger RLS; if not admin, will error on write. For now, just try a harmless select head
  const { error } = await s.from('cases').select('id', { head:true, count:'exact' });
  if(error){ throw error; }
  return { ok:true };
}

// Token header para cliente
function setTokenHeader(token){ supaClient().then(s=>{ s.rest.headers = { ...(s.rest.headers||{}), 'x-case-token': token }; }); }

// Funções cliente
async function getCaseByToken(token){ setTokenHeader(token); const s=await supaClient(); return await s.from('cases').select('*').single(); }
async function getEventsByToken(token){ setTokenHeader(token); const s=await supaClient(); return await s.from('case_events').select('*').order('created_at',{ascending:false}); }
async function getFilesByToken(token){ setTokenHeader(token); const s=await supaClient(); return await s.from('case_files').select('*').order('created_at',{ascending:false}); }
async function getNotificationsByToken(token){ setTokenHeader(token); const s=await supaClient(); return await s.from('notifications').select('*').order('created_at',{ascending:false}); }
async function markNotificationRead(id){ const s=await supaClient(); return await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); }

// Storage
async function signStorageUrl(path, expires=60){ const s=await supaClient(); return await s.storage.from('cases').createSignedUrl(path, expires); }
async function uploadFile(path, file){ const s=await supaClient(); return await s.storage.from('cases').upload(path, file, { upsert:true }); }

// Operações do operador
async function operatorCreateCase(data){ applyGlobalHeaders(); const s=await supaClient(); return await s.from('cases').insert(data).select('id, token').single(); }
async function operatorAddEvent(case_id, status, description){ applyGlobalHeaders(); const s=await supaClient(); const res = await s.from('case_events').insert({ case_id, status, description }); if(!res.error){ await operatorNotify(case_id, 'Novo andamento publicado.'); } return res; }
async function operatorAttachFile(meta){ applyGlobalHeaders(); const s=await supaClient(); return await s.from('case_files').insert(meta); }
async function operatorNotify(case_id, message){ applyGlobalHeaders(); const s=await supaClient(); return await s.from('notifications').insert({ case_id, message }); }

// PWA install
window._pwa = { deferred:null }; window.addEventListener('beforeinstallprompt', e=>{e.preventDefault(); window._pwa.deferred=e;});
async function promptInstall(){ if(window._pwa.deferred){ const e=window._pwa.deferred; e.prompt(); await e.userChoice; window._pwa.deferred=null; } else { alert('No seu celular, use "Adicionar à Tela Inicial".'); } }

