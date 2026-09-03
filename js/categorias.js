const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let categoriaEmEdicao = null;
let paginaAtual = 1;
const REGISTROS_POR_PAGINA = 4;

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

function mostrarErroBanco(contexto, erro) {
  const detalhes = [erro?.message, erro?.details, erro?.hint].filter(Boolean).join(' ');
  console.error(contexto, erro);
  mostrarMensagem(`${contexto} Detalhes: ${detalhes || 'erro sem detalhes retornados.'}`);
}

function configurarSaida() { 
  document.querySelector('[data-action="logout"]')?.addEventListener('click', (e) => { 
    e.preventDefault(); 
    sessionStorage.removeItem(SESSION_KEY); 
    window.location.replace('../index.html'); 
  }); 
}

function renderizarPaginacaoCategorias(total) {
  let navegacao = document.getElementById('paginacao-categorias');
  if (!navegacao) { navegacao = document.createElement('nav'); navegacao.id = 'paginacao-categorias'; navegacao.className = 'mt-3'; document.querySelector('[data-records]').closest('section').after(navegacao); }
  const paginas = Math.ceil(total / REGISTROS_POR_PAGINA); if (paginaAtual > paginas) paginaAtual = Math.max(1, paginas);
  navegacao.innerHTML = paginas > 1 ? `<ul class="pagination justify-content-end mb-0">${Array.from({ length: paginas }, (_, i) => `<li class="page-item ${paginaAtual === i + 1 ? 'active' : ''}"><button class="page-link" data-pagina-categoria="${i + 1}">${i + 1}</button></li>`).join('')}</ul>` : '';
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

  if (error) return mostrarErroBanco('Não foi possível carregar as categorias.', error); 

  document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`; 

  renderizarPaginacaoCategorias(data.length);
  const categoriasDaPagina = data.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA);
  corpo.innerHTML = data.length ? categoriasDaPagina.map((categoria) => 
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
  const { data: produtos, error: erroProdutos } = await supabase.from('produto').select('produtoid').eq('categoriaprodutoid', id);
  if (erroProdutos) return mostrarMensagem('Não foi possível verificar os produtos da categoria.');
  if (produtos.length) {
    const { data: itens, error: erroItens } = await supabase.from('orcamento_item').select('produtoid').in('produtoid', produtos.map((produto) => produto.produtoid)).limit(1);
    if (erroItens) return mostrarMensagem('Não foi possível verificar os orçamentos da categoria.');
    if (itens.length) return mostrarMensagem('Não é possível excluir esta categoria porque existem produtos com esta categoria');
  }
  if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return; 

  const { error } = await supabase.from('categoria_produto').delete().eq('categoriaprodutoid', id); 
  if (error) return mostrarMensagem('Não foi possível excluir a categoria, pois ela está vinculada a um produto.'); 

  mostrarMensagem('Categoria excluída com sucesso.', 'success'); 
  carregarCategorias(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarCategorias(); 

  document.querySelector('[data-search]').addEventListener('input', (e) => { paginaAtual = 1; carregarCategorias(e.target.value); }); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarCategoria); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.edit) editarCategoria(e.target.dataset.edit); 
    if (e.target.dataset.delete) excluirCategoria(e.target.dataset.delete); 
    if (e.target.dataset.paginaCategoria) { paginaAtual = Number(e.target.dataset.paginaCategoria); carregarCategorias(document.querySelector('[data-search]').value); }
  }); 

  document.getElementById('categoriaModal').addEventListener('hidden.bs.modal', () => { 
    categoriaEmEdicao = null; 
    document.querySelector('#categoriaModal form').reset(); 
    document.querySelector('#categoriaModal .modal-title').textContent = 'Nova categoria'; 
  }); 
}
