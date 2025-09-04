
// Insert your Supabase URL and Anon Key below
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SEU_ANON_KEY';
// Supabase JS v2 via CDN
const supaReady = new Promise((resolve)=>{
  if (window.supabase) return resolve();
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/@supabase/supabase-js@2';
  s.onload = resolve;
  document.head.appendChild(s);
});

async function supaClient(){
  await supaReady;
  if (!window._supa) {
    window._supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: {} } });
  }
  return window._supa;
}

async function setTokenHeader(token){
  const supa = await supaClient();
  // stay anonymous, just add header for RLS
  supa.rest.setAuth(null);
  supa.rest.headers = { ...(supa.rest.headers||{}), 'x-case-token': token };
}

async function loginOperator(email, password){
  const supa = await supaClient();
  return await supa.auth.signInWithPassword({ email, password });
}

async function operatorCreateCase(data){
  const supa = await supaClient();
  // data: {code,title,client_name,client_cpf,token}
  return await supa.from('cases').insert(data).select('id, token').single();
}

async function operatorAddEvent(case_id, status, description){
  const supa = await supaClient();
  return await supa.from('case_events').insert({ case_id, status, description });
}

async function operatorAttachFile(meta){
  const supa = await supaClient();
  return await supa.from('case_files').insert(meta);
}

async function getCaseByToken(token){
  await setTokenHeader(token);
  const supa = await supaClient();
  return await supa.from('cases').select('*').single();
}

async function getEventsByToken(token){
  await setTokenHeader(token);
  const supa = await supaClient();
  return await supa.from('case_events').select('*').order('created_at', { ascending: false });
}

async function getFilesByToken(token){
  await setTokenHeader(token);
  const supa = await supaClient();
  return await supa.from('case_files').select('*').order('created_at', { ascending: false });
}

async function signStorageUrl(path, expires=60){
  const supa = await supaClient();
  return await supa.storage.from('cases').createSignedUrl(path, expires);
}

async function uploadFile(path, file){
  const supa = await supaClient();
  return await supa.storage.from('cases').upload(path, file, { upsert: true });
}

// PWA install helper
window._pwa = { deferred: null };
window.addEventListener('beforeinstallprompt', (e)=>{e.preventDefault(); window._pwa.deferred = e;});
async function promptInstall(){
  if(window._pwa.deferred){
    const e = window._pwa.deferred;
    e.prompt();
    await e.userChoice;
    window._pwa.deferred = null;
  } else {
    alert('No seu celular, use "Adicionar à Tela Inicial".');
  }
}
