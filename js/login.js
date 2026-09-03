const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';

function mostrarMensagem(texto, tipo = 'danger') {
  let alerta = document.getElementById('app-alert');
  if (!alerta) {
    alerta = document.createElement('div');
    alerta.id = 'app-alert';
    alerta.setAttribute('role', 'alert');
    document.body.append(alerta);
  }
  alerta.className = `alert alert-${tipo} alert-dismissible fade show app-alert`;
  alerta.innerHTML = `${texto}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>`;
}

function lerSessao() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { sessionStorage.removeItem(SESSION_KEY); return null; }
}

function valorParaFiltro(valor) {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const formulario = document.getElementById('login-form');
if (lerSessao()) window.location.replace('menu.html');

formulario?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = formulario.querySelector('[type="submit"]');
  const usuarioInformado = formulario.usuario.value.trim();
  const senhaInformada = formulario.password.value;
  botao.disabled = true;

  const filtro = valorParaFiltro(usuarioInformado);
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, usuario, nome_completo, senha')
    .or(`usuario.eq.${filtro},nome_completo.eq.${filtro}`)
    .limit(1);

  botao.disabled = false;
  if (error) return mostrarMensagem('Não foi possível realizar o login. Tente novamente.');
  const usuario = data?.[0];
  if (!usuario || usuario.senha !== senhaInformada) return mostrarMensagem('Usuário ou senha incorretos.');

  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: usuario.id,
    usuario: usuario.usuario,
    nome_completo: usuario.nome_completo,
    isAdmin: usuario.usuario === 'Admin' && senhaInformada === 'A'
  }));
  window.location.replace('menu.html');
});
