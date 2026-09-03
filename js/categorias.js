const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let categoriaEmEdicao = null;

const esc = (valor) => 
  String(valor ?? '').replace(/[&<>"']/g, (c) => ({ 
    '&': '&amp;', 
    '<': '&lt;', 
    '>': '&gt;', 
    '"': '&quot;', 
    "'": '&#039;' 
  })[c]);

function verificarSessao() { 
  if (!sessionStorage.getItem(SESSION_KEY)) { 
    window.location.replace('../index.html'); 
    return false; 
  } 
  return true; 
}

function mostrarMensagem(texto, tipo = 'danger') { 
  let a = document.getElementById('app-alert'); 
  if (!a) { 
    a = document.createElement('div'); 
    a.id = 'app-alert'; 
    document.body.append(a); 
  } 
  a.className = `alert alert-${tipo} alert-dismissible fade show app-alert`; 
  a.innerHTML = `${texto}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`; 
}

function configurarSaida() { 
  document.querySelector('[data-action="logout"]')?.addEventListener('click', (e) => { 
    e.preventDefault(); 
    sessionStorage.removeItem(SESSION_KEY); 
    window.location.replace('../index.html'); 
  }); 
}

async function carregarCategorias(pesquisa = '') { 
  let consulta = supabase
    .from('categoria_produto')
    .select('*')
    .order('categoriaprodutoid', { ascending: false })
    .limit(100); 

  if (pesquisa.trim()) consulta = consulta.ilike('ds_categoria_produto', `%${pesquisa.trim()}%`); 

  const { data, error } = await consulta; 
  const corpo = document.querySelector('[data-records]'); 

  if (error) return mostrarMensagem('Não foi possível carregar as categorias.'); 

  document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`; 

  corpo.innerHTML = data.length ? data.map((categoria) => 
    `<tr>` +
      `<td>${categoria.categoriaprodutoid}</td>` +
      `<td><strong>${esc(categoria.ds_categoria_produto)}</strong></td>` +
      `<td class="text-end">` +
        `<button class="action-button border-0 bg-transparent" data-edit="${categoria.categoriaprodutoid}">Editar</button>` +
        `<button class="action-button text-danger border-0 bg-transparent" data-delete="${categoria.categoriaprodutoid}">Excluir</button>` +
      `</td>` +
    `</tr>`
  ).join('') : '<tr><td colspan="3" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>'; 
}

async function cadastrarCategoria() { 
  const ds_categoria_produto = document.getElementById('categoria-nome').value.trim(); 
  if (!ds_categoria_produto) return mostrarMensagem('Preencha o nome da categoria.'); 

  const consulta = categoriaEmEdicao 
    ? supabase.from('categoria_produto').update({ ds_categoria_produto }).eq('categoriaprodutoid', categoriaEmEdicao) 
    : supabase.from('categoria_produto').insert({ ds_categoria_produto }); 

  const { error } = await consulta; 

  if (error) return mostrarMensagem('Não foi possível salvar a categoria.'); 

  bootstrap.Modal.getInstance(document.getElementById('categoriaModal'))?.hide(); 
  mostrarMensagem('Categoria salva com sucesso.', 'success'); 
  carregarCategorias(document.querySelector('[data-search]').value); 
}

async function editarCategoria(id) { 
  const { data, error } = await supabase.from('categoria_produto').select('*').eq('categoriaprodutoid', id).single(); 
  if (error) return mostrarMensagem('Não foi possível carregar a categoria.'); 

  categoriaEmEdicao = data.categoriaprodutoid; 
  document.getElementById('categoria-nome').value = data.ds_categoria_produto; 
  document.querySelector('#categoriaModal .modal-title').textContent = 'Editar categoria'; 
  bootstrap.Modal.getOrCreateInstance(document.getElementById('categoriaModal')).show(); 
}

async function excluirCategoria(id) { 
  if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return; 

  const { error } = await supabase.from('categoria_produto').delete().eq('categoriaprodutoid', id); 
  if (error) return mostrarMensagem('Não foi possível excluir a categoria.'); 

  mostrarMensagem('Categoria excluída com sucesso.', 'success'); 
  carregarCategorias(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarCategorias(); 

  document.querySelector('[data-search]').addEventListener('input', (e) => carregarCategorias(e.target.value)); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarCategoria); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.edit) editarCategoria(e.target.dataset.edit); 
    if (e.target.dataset.delete) excluirCategoria(e.target.dataset.delete); 
  }); 

  document.getElementById('categoriaModal').addEventListener('hidden.bs.modal', () => { 
    categoriaEmEdicao = null; 
    document.querySelector('#categoriaModal form').reset(); 
    document.querySelector('#categoriaModal .modal-title').textContent = 'Nova categoria'; 
  }); 
}