// === CONFIG SUPABASE ===
const SUPABASE_URL = 'https://fzcflkbhjbxifvjrltwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y2Zsa2JoamJ4aWZ2anJsdHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTk3OTQsImV4cCI6MjA3MjU3NTc5NH0.Ocb6Q7BDzC67v5l9VZx340Tp04RP5AbYAVV8nCxFPL8';

let _supa = null;

// carrega supabase-js v2
async function ensureLib() {
  if (window.supabase) return;
  await new Promise(res => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@supabase/supabase-js@2';
    s.onload = res;
    document.head.appendChild(s);
  });
}

// cria UMA única instância e configura para não persistir sessão (evita o warning)
async function getClient() {
  await ensureLib();
  if (_supa) return _supa;
  _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,       // não salva sessão
      autoRefreshToken: false,     // não renova
      detectSessionInUrl: false,   // ignora callback
      storageKey: 'cpf-login'      // chave isolada (mesmo que não use sessão)
    },
    global: { headers: {} }
  });
  return _supa;
}

// altera/mescla headers globais SEM recriar o cliente
async function setGlobalHeaders(h) {
  const s = await getClient();
  s.rest.headers = { ...(s.rest.headers || {}), ...(h || {}) };
}

// =================== UTIL ===================
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text || '');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// persistência simples dos headers do admin
function saveAdmin(cpf, passhash) {
  localStorage.setItem('admin_cpf', cpf);
  localStorage.setItem('admin_pass', passhash);
}
function loadAdmin() {
  return {
    cpf: localStorage.getItem('admin_cpf') || '',
    pass: localStorage.getItem('admin_pass') || ''
  };
}

// aplica headers salvos ao carregar
(async () => {
  const a = loadAdmin();
  if (a.cpf && a.pass) await setGlobalHeaders({ 'x-admin-cpf': a.cpf, 'x-admin-pass': a.pass });
})();

// =================== LOGIN (CPF + senha) ===================
async function loginOperatorCPF(cpf, senha) {
  cpf = String(cpf || '').replace(/\D/g,'');
  const passhash = await sha256Hex(senha || '');
  saveAdmin(cpf, passhash);
  await setGlobalHeaders({ 'x-admin-cpf': cpf, 'x-admin-pass': passhash });

  const s = await getClient();
  const { data, error } = await s.rpc('is_admin');
  if (error) throw error;
  if (!data) throw new Error('Credenciais inválidas (CPF/senha).');
  return { ok: true };
}

// =================== CLIENTE (TOKEN) ===================
async function setToken(token) {
  await setGlobalHeaders({ 'x-case-token': token });
}

// =================== FUNÇÕES DE DADOS ===================
async function getCaseByToken(token)   { await setToken(token); const s = await getClient(); return await s.from('cases').select('*').single(); }
async function getEventsByToken(token) { await setToken(token); const s = await getClient(); return await s.from('case_events').select('*').order('created_at', { ascending:false }); }
async function getFilesByToken(token)  { await setToken(token); const s = await getClient(); return await s.from('case_files').select('*').order('created_at', { ascending:false }); }
async function getNotificationsByToken(token){ await setToken(token); const s = await getClient(); return await s.from('notifications').select('*').order('created_at', { ascending:false }); }
async function markNotificationRead(id){ const s = await getClient(); return await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); }

async function signStorageUrl(path, expires=60){ const s = await getClient(); return await s.storage.from('cases').createSignedUrl(path, expires); }
async function uploadFile(path, file){ const s = await getClient(); return await s.storage.from('cases').upload(path, file, { upsert:true }); }

async function operatorCreateCase(data){ const s = await getClient(); return await s.from('cases').insert(data).select('id, token').single(); }
async function operatorAddEvent(case_id, status, description){ const s = await getClient(); const res = await s.from('case_events').insert({ case_id, status, description }); if(!res.error){ await operatorNotify(case_id, 'Novo andamento publicado.'); } return res; }
async function operatorAttachFile(meta){ const s = await getClient(); return await s.from('case_files').insert(meta); }
async function operatorNotify(case_id, message){ const s = await getClient(); return await s.from('notifications').insert({ case_id, message }); }

// =================== PWA ===================
window._pwa = { deferred: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._pwa.deferred = e; });
async function promptInstall() {
  if (window._pwa.deferred) {
    const e = window._pwa.deferred;
    e.prompt(); await e.userChoice; window._pwa.deferred = null;
  } else { alert('No seu celular, use "Adicionar à Tela Inicial".'); }
}
