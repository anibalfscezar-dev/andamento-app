// === CONFIG SUPABASE (seu projeto) ===
const SUPABASE_URL = 'https://fzcflkbhjbxifvjrltwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y2Zsa2JoamJ4aWZ2anJsdHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTk3OTQsImV4cCI6MjA3MjU3NTc5NH0.Ocb6Q7BDzC67v5l9VZx340Tp04RP5AbYAVV8nCxFPL8';

// cliente supabase e headers atuais
let _supa = null;
let _headers = {}; // ex.: { 'x-admin-cpf': '12345678909', 'x-admin-pass': '<sha256>' }

// carrega a lib supabase-js v2 via CDN quando necessário
async function ensureLib() {
  if (window.supabase) return;
  await new Promise(res => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@supabase/supabase-js@2';
    s.onload = res;
    document.head.appendChild(s);
  });
}

// cria (ou recria) o cliente com headers globais
async function createClient(headers = {}) {
  await ensureLib();
  _headers = headers;
  _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers }
  });
  return _supa;
}

// retorna o cliente atual (cria com os headers atuais se ainda não existir)
async function supaClient() {
  if (!_supa) return await createClient(_headers);
  return _supa;
}

// =================== UTIL ===================

// SHA-256 → hex
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text || '');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// guarda headers de admin no localStorage (persistência simples)
function setAdminHeaders(cpf, passhash) {
  localStorage.setItem('admin_cpf', cpf);
  localStorage.setItem('admin_pass', passhash);
}

// lê headers de admin do localStorage
function getAdminHeaders() {
  return {
    'x-admin-cpf': localStorage.getItem('admin_cpf') || '',
    'x-admin-pass': localStorage.getItem('admin_pass') || ''
  };
}

// aplica headers salvos recriando o cliente
async function applySavedAdminHeaders() {
  const hdr = getAdminHeaders();
  await createClient(hdr);
}

// ao carregar a página, tenta aplicar headers de admin previamente salvos
applySavedAdminHeaders();

// =================== LOGIN (CPF + senha) ===================

// Login do operador por CPF + senha (senha padrão: 4 primeiros dígitos do CPF)
// Valida via RPC is_admin() (definida no schema.sql)
async function loginOperatorCPF(cpf, senha) {
  cpf = String(cpf || '').replace(/\D/g, ''); // apenas números
  const passhash = await sha256Hex(senha || '');
  setAdminHeaders(cpf, passhash);

  // recria o cliente com esses headers
  await createClient({ 'x-admin-cpf': cpf, 'x-admin-pass': passhash });

  // valida chamando a função RPC (não depende de SELECT em tabelas com RLS)
  const s = await supaClient();
  const { data, error } = await s.rpc('is_admin');
  if (error) throw error;
  if (!data) throw new Error('Credenciais inválidas (CPF/senha).');

  return { ok: true };
}

// =================== CLIENTE (TOKEN) ===================

// cria um cliente com o token do caso (mesclando headers atuais do admin, se houver)
async function clientWithToken(token) {
  const headers = { ..._headers, 'x-case-token': token };
  await createClient(headers);
  return _supa;
}

// =================== FUNÇÕES DE DADOS ===================
// (chame get*/operator* a partir das páginas, p.ex. admin.html / case.html)

// --- Cliente (leitura do próprio caso) ---
async function getCaseByToken(token) {
  await clientWithToken(token);
  const s = await supaClient();
  return await s.from('cases').select('*').single();
}

async function getEventsByToken(token) {
  await clientWithToken(token);
  const s = await supaClient();
  return await s.from('case_events').select('*').order('created_at', { ascending: false });
}

async function getFilesByToken(token) {
  await clientWithToken(token);
  const s = await supaClient();
  return await s.from('case_files').select('*').order('created_at', { ascending: false });
}

async function getNotificationsByToken(token) {
  await clientWithToken(token);
  const s = await supaClient();
  return await s.from('notifications').select('*').order('created_at', { ascending: false });
}

async function markNotificationRead(id) {
  const s = await supaClient();
  return await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

// --- Storage (arquivos) ---
async function signStorageUrl(path, expires = 60) {
  const s = await supaClient();
  return await s.storage.from('cases').createSignedUrl(path, expires);
}

async function uploadFile(path, file) {
  const s = await supaClient();
  return await s.storage.from('cases').upload(path, file, { upsert: true });
}

// --- Operador (escrita total, controlada por RLS via is_admin) ---
async function operatorCreateCase(data) {
  const s = await supaClient();
  return await s.from('cases').insert(data).select('id, token').single();
}

async function operatorAddEvent(case_id, status, description) {
  const s = await supaClient();
  const res = await s.from('case_events').insert({ case_id, status, description });
  // notificação automática no novo andamento
  if (!res.error) {
    await operatorNotify(case_id, 'Novo andamento publicado.');
  }
  return res;
}

async function operatorAttachFile(meta) {
  const s = await supaClient();
  return await s.from('case_files').insert(meta);
}

async function operatorNotify(case_id, message) {
  const s = await supaClient();
  return await s.from('notifications').insert({ case_id, message });
}

// =================== PWA (instalação) ===================
window._pwa = { deferred: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._pwa.deferred = e; });
async function promptInstall() {
  if (window._pwa.deferred) {
    const e = window._pwa.deferred;
    e.prompt();
    await e.userChoice;
    window._pwa.deferred = null;
  } else {
    alert('No seu celular, use "Adicionar à Tela Inicial".');
  }
}
