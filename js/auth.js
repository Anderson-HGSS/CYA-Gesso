import { supabase } from './supabase.js';

const root = document.documentElement;
const isLogin = root.dataset.page === 'login';
const loginPath = root.dataset.loginPath || 'index.html';
const SESSION_KEY = 'cyaGessoUsuarioLogado';

export function showMessage(text, kind = 'danger') {
  let alert = document.getElementById('app-alert');
  if (!alert) { alert = document.createElement('div'); alert.id = 'app-alert'; alert.className = 'alert alert-dismissible fade show app-alert'; alert.setAttribute('role', 'alert'); document.body.append(alert); }
  alert.className = `alert alert-${kind} alert-dismissible fade show app-alert`;
  alert.innerHTML = `${text}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>`;
}

function getPrototypeSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { sessionStorage.removeItem(SESSION_KEY); return null; }
}

export function getCurrentUser() { return getPrototypeSession(); }

export function requireAuth() {
  const session = getPrototypeSession();
  if (!session) window.location.replace(loginPath);
  return session;
}

export function logout(event) {
  event?.preventDefault();
  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace(loginPath);
}

function quoteFilterValue(value) { return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }

async function initLogin() {
  const form = document.getElementById('login-form');
  if (getPrototypeSession()) window.location.replace('menu.html');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const usuarioInformado = form.usuario.value.trim();
    const senhaInformada = form.password.value;
    button.disabled = true;
    const filter = quoteFilterValue(usuarioInformado);
    const { data, error } = await supabase.from('usuarios').select('id, usuario, nome_completo, senha').or(`usuario.eq.${filter},nome_completo.eq.${filter}`).limit(1);
    button.disabled = false;
    if (error) { console.error(error); return showMessage('Não foi possível realizar o login. Tente novamente.'); }
    const usuario = data?.[0];
    if (!usuario || usuario.senha !== senhaInformada) return showMessage('Usuário ou senha incorretos.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: usuario.id, nome: usuario.nome, nome_completo: usuario.nome_completo, isAdmin: usuario.nome === 'Admin' && senhaInformada === 'A' }));
    window.location.replace('menu.html');
  });
}

if (isLogin) {initLogin()};
