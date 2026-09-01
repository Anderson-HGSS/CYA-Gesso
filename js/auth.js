import { supabase } from './supabase.js';

const root = document.documentElement;
const isLogin = root.dataset.page === 'login';
const loginPath = root.dataset.loginPath || 'index.html';

export function showMessage(text, kind = 'danger') {
  let alert = document.getElementById('app-alert');
  if (!alert) { alert = document.createElement('div'); alert.id = 'app-alert'; alert.className = 'alert alert-dismissible fade show app-alert'; alert.setAttribute('role', 'alert'); document.body.append(alert); }
  alert.className = `alert alert-${kind} alert-dismissible fade show app-alert`;
  alert.innerHTML = `${text}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>`;
}

export async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) window.location.replace(loginPath);
  return session;
}

export async function logout(event) {
  event?.preventDefault();
  const { error } = await supabase.auth.signOut();
  if (error) showMessage('Não foi possível encerrar a sessão. Tente novamente.');
  else window.location.replace(loginPath);
}

async function initLogin() {
  const form = document.getElementById('login-form');
  const recovery = document.getElementById('forgot-password');
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.replace('menu.html');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    button.disabled = false;
    if (error) showMessage(error.message);
    else window.location.replace('menu.html');
  });
  recovery?.addEventListener('click', event => { event.preventDefault(); window.location.href = 'esqueci-senha.html'; });
}

if (isLogin) initLogin();
