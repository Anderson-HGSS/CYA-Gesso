const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let usuarioEmEdicao = null;

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
  if (error) return mensagem('Não foi possível carregar os usuários.'); 

  document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`; 

  const acoes = administrador() 
    ? (u) => `<button class="action-button border-0 bg-transparent" data-edit="${u.id}">Editar</button><button class="action-button text-danger border-0 bg-transparent" data-delete="${u.id}">Excluir</button>` 
    : () => '—'; 

  document.querySelector('[data-records]').innerHTML = data.length 
    ? data.map((u) => 
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

  document.querySelector('[data-search]').addEventListener('input', (e) => carregarUsuarios(e.target.value)); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarUsuario); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.edit) editarUsuario(e.target.dataset.edit); 
    if (e.target.dataset.delete) excluirUsuario(e.target.dataset.delete); 
  }); 

  document.getElementById('usuarioModal').addEventListener('hidden.bs.modal', () => { 
    usuarioEmEdicao = null; 
    document.querySelector('#usuarioModal form').reset(); 
    document.querySelector('#usuarioModal .modal-title').textContent = 'Cadastrar usuário'; 
  }); 
}