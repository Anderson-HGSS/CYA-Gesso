const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let usuarioEmEdicao = null;
let paginaAtual = 1;
const REGISTROS_POR_PAGINA = 4;

const esc = (v) => 
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ 
    '&': '&amp;', 
    '<': '&lt;', 
    '>': '&gt;', 
    '"': '&quot;', 
    "'": '&#039;' 
  })[c]);

function lerSessao() { 
  try { 
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); 
  } catch { 
    sessionStorage.removeItem(SESSION_KEY); 
    return null; 
  } 
}

function verificarSessao() { 
  if (!lerSessao()) { 
    window.location.replace('../index.html'); 
    return false; 
  } 
  return true; 
}

function mensagem(t, tipo = 'danger') { 
  let a = document.getElementById('app-alert'); 
  if (!a) { 
    a = document.createElement('div'); 
    a.id = 'app-alert'; 
    document.body.append(a); 
  } 
  a.className = `alert alert-${tipo} alert-dismissible fade show app-alert`; 
  a.innerHTML = `${t}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`; 
}

function mostrarErroBanco(contexto, erro) {
  const detalhes = [erro?.message, erro?.details, erro?.hint].filter(Boolean).join(' ');
  console.error(contexto, erro);
  mensagem(`${contexto} Detalhes: ${detalhes || 'erro sem detalhes retornados.'}`);
}

function configurarSaida() { 
  document.querySelector('[data-action="logout"]')?.addEventListener('click', (e) => { 
    e.preventDefault(); 
    sessionStorage.removeItem(SESSION_KEY); 
    window.location.replace('../index.html'); 
  }); 
}

function administrador() { 
  return lerSessao()?.isAdmin === true; 
}

function renderizarPaginacaoUsuarios(total) { let navegacao = document.getElementById('paginacao-usuarios'); if (!navegacao) { navegacao = document.createElement('nav'); navegacao.id = 'paginacao-usuarios'; navegacao.className = 'mt-3'; document.querySelector('[data-records]').closest('section').after(navegacao); } const paginas = Math.ceil(total / REGISTROS_POR_PAGINA); if (paginaAtual > paginas) paginaAtual = Math.max(1, paginas); navegacao.innerHTML = paginas > 1 ? `<ul class="pagination justify-content-end mb-0">${Array.from({ length: paginas }, (_, i) => `<li class="page-item ${paginaAtual === i + 1 ? 'active' : ''}"><button class="page-link" data-pagina-usuario="${i + 1}">${i + 1}</button></li>`).join('')}</ul>` : ''; }

async function carregarUsuarios(pesquisa = '') { 
  let consulta = supabase
    .from('usuarios')
    .select('id, usuario, nome_completo')
    .order('id', { ascending: false })
    .limit(100); 

  if (pesquisa.trim()) {
    consulta = consulta.or(`usuario.ilike.%${pesquisa.trim()}%,nome_completo.ilike.%${pesquisa.trim()}%`); 
  }

  const { data, error } = await consulta; 
  if (error) return mostrarErroBanco('Não foi possível carregar os usuários.', error); 

  document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`; 

  const acoes = administrador() 
    ? (u) => `<button class="action-button border-0 bg-transparent" data-edit="${u.id}">Editar</button><button class="action-button text-danger border-0 bg-transparent" data-delete="${u.id}">Excluir</button>` 
    : () => '—'; 

  renderizarPaginacaoUsuarios(data.length);
  const usuariosDaPagina = data.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA);
  document.querySelector('[data-records]').innerHTML = data.length 
    ? usuariosDaPagina.map((u) => 
        `<tr>` +
          `<td>${u.id}</td>` +
          `<td><strong>${esc(u.usuario)}</strong></td>` +
          `<td>${esc(u.nome_completo)}</td>` +
          `<td class="text-end">${acoes(u)}</td>` +
        `</tr>`
      ).join('') 
    : '<tr><td colspan="4" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>'; 
}

async function cadastrarUsuario() { 
  const usuario = document.getElementById('usuario-nome').value.trim(); 
  const nome_completo = document.getElementById('usuario-nome-completo').value.trim(); 
  const senha = document.getElementById('usuario-senha').value; 
  const confirmacao = document.getElementById('usuario-confirmacao').value; 

  if (!usuario || !nome_completo || !senha || !confirmacao) {
    return mensagem('Preencha todos os campos do cadastro.'); 
  }
  if (senha !== confirmacao) {
    return mensagem('As senhas não coincidem.'); 
  }

  const dados = { usuario, nome_completo, senha }; 
  const consulta = usuarioEmEdicao 
    ? supabase.from('usuarios').update(dados).eq('id', usuarioEmEdicao) 
    : supabase.from('usuarios').insert(dados); 

  const { error } = await consulta; 
  if (error) return mensagem('Não foi possível salvar o usuário.'); 

  bootstrap.Modal.getInstance(document.getElementById('usuarioModal'))?.hide(); 
  mensagem('Usuário salvo com sucesso.', 'success'); 
  carregarUsuarios(document.querySelector('[data-search]').value); 
}

async function editarUsuario(id) { 
  if (!administrador()) return mensagem('Apenas o administrador pode editar usuários.'); 

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, usuario, nome_completo, senha')
    .eq('id', id)
    .single(); 

  if (error) return mensagem('Não foi possível carregar o usuário.'); 

  usuarioEmEdicao = data.id; 
  document.getElementById('usuario-nome').value = data.usuario; 
  document.getElementById('usuario-nome-completo').value = data.nome_completo; 
  document.getElementById('usuario-senha').value = data.senha; 
  document.getElementById('usuario-confirmacao').value = data.senha; 

  document.querySelector('#usuarioModal .modal-title').textContent = 'Editar usuário'; 
  bootstrap.Modal.getOrCreateInstance(document.getElementById('usuarioModal')).show(); 
}

async function excluirUsuario(id) { 
  if (!administrador()) return mensagem('Apenas o administrador pode excluir usuários.'); 
  if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return; 

  const { error } = await supabase.from('usuarios').delete().eq('id', id); 
  if (error) return mensagem('Não foi possível excluir o usuário.'); 

  mensagem('Usuário excluído com sucesso.', 'success'); 
  carregarUsuarios(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarUsuarios(); 

  document.querySelector('[data-search]').addEventListener('input', (e) => { paginaAtual = 1; carregarUsuarios(e.target.value); }); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarUsuario); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.edit) editarUsuario(e.target.dataset.edit); 
    if (e.target.dataset.delete) excluirUsuario(e.target.dataset.delete); 
    if (e.target.dataset.paginaUsuario) { paginaAtual = Number(e.target.dataset.paginaUsuario); carregarUsuarios(document.querySelector('[data-search]').value); }
  }); 

  document.getElementById('usuarioModal').addEventListener('hidden.bs.modal', () => { 
    usuarioEmEdicao = null; 
    document.querySelector('#usuarioModal form').reset(); 
    document.querySelector('#usuarioModal .modal-title').textContent = 'Cadastrar usuário'; 
  }); 
}
