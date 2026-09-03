const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let produtoEmEdicao = null;

const esc = (v) => 
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ 
    '&': '&amp;', 
    '<': '&lt;', 
    '>': '&gt;', 
    '"': '&quot;', 
    "'": '&#039;' 
  })[c]);

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataFormatada = (v) => 
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';

const numero = (v) => { 
  const texto = String(v).replace(/[^0-9,.-]/g, ''); 
  return Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto); 
};

function verificarSessao() { 
  if (!sessionStorage.getItem(SESSION_KEY)) { 
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

async function carregarCategorias() { 
  const { data, error } = await supabase
    .from('categoria_produto')
    .select('categoriaprodutoid, ds_categoria_produto')
    .order('ds_categoria_produto'); 

  if (error) return mensagem('Não foi possível carregar as categorias.'); 

  document.getElementById('produto-categoria').innerHTML = 
    '<option value="">Selecione uma categoria</option>' + 
    data.map((c) => `<option value="${c.categoriaprodutoid}">${esc(c.ds_categoria_produto)}</option>`).join(''); 

  return data; 
}

async function carregarProdutos(pesquisa = '') { 
  const categorias = await carregarCategorias(); 
  let consulta = supabase
    .from('produto')
    .select('*')
    .order('produtoid', { ascending: false })
    .limit(100); 

  if (pesquisa.trim()) consulta = consulta.ilike('ds_produto', `%${pesquisa.trim()}%`); 

  const { data, error } = await consulta; 
  if (error) return mensagem('Não foi possível carregar os produtos.'); 

  const nomes = new Map((categorias || []).map((c) => [c.categoriaprodutoid, c.ds_categoria_produto])); 

  document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`; 

  document.querySelector('[data-records]').innerHTML = data.length 
    ? data.map((p) => 
        `<tr>` +
          `<td>${p.produtoid}</td>` +
          `<td><strong>${esc(p.ds_produto)}</strong></td>` +
          `<td>${esc(nomes.get(p.categoriaprodutoid) || p.categoriaprodutoid)}</td>` +
          `<td>${esc(p.obs_produto || '—')}</td>` +
          `<td>${moeda(p.vl_venda_produto)}</td>` +
          `<td>${dataFormatada(p.dt_cadastro_produto)}</td>` +
          `<td>${esc(p.status_produto || '—')}</td>` +
          `<td class="text-end">` +
            `<button class="action-button border-0 bg-transparent" data-edit="${p.produtoid}">Editar</button>` +
            `<button class="action-button text-danger border-0 bg-transparent" data-delete="${p.produtoid}">Excluir</button>` +
          `</td>` +
        `</tr>`
      ).join('') 
    : '<tr><td colspan="8" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>'; 
}

async function cadastrarProduto() { 
  const ds_produto = document.getElementById('produto-nome').value.trim(); 
  const categoriaprodutoid = Number(document.getElementById('produto-categoria').value); 
  const vl_venda_produto = numero(document.getElementById('produto-venda').value); 
  const status_produto = document.getElementById('produto-status').value; 

  if (!ds_produto || !categoriaprodutoid || !Number.isFinite(vl_venda_produto)) {
    return mensagem('Preencha produto, categoria e preço de venda.'); 
  }

  const dados = { 
    ds_produto, 
    categoriaprodutoid, 
    obs_produto: document.getElementById('produto-descricao').value.trim() || null, 
    vl_venda_produto, 
    dt_cadastro_produto: document.getElementById('produto-data').value || new Date().toISOString().slice(0, 10), 
    status_produto 
  }; 

  const consulta = produtoEmEdicao 
    ? supabase.from('produto').update(dados).eq('produtoid', produtoEmEdicao) 
    : supabase.from('produto').insert(dados); 

  const { error } = await consulta; 
  if (error) return mensagem('Não foi possível salvar o produto.'); 

  bootstrap.Modal.getInstance(document.getElementById('produtoModal'))?.hide(); 
  mensagem('Produto salvo com sucesso.', 'success'); 
  carregarProdutos(document.querySelector('[data-search]').value); 
}

async function editarProduto(id) { 
  const { data, error } = await supabase.from('produto').select('*').eq('produtoid', id).single(); 
  if (error) return mensagem('Não foi possível carregar o produto.'); 

  produtoEmEdicao = data.produtoid; 
  document.getElementById('produto-nome').value = data.ds_produto || ''; 
  document.getElementById('produto-categoria').value = data.categoriaprodutoid || ''; 
  document.getElementById('produto-descricao').value = data.obs_produto || ''; 
  document.getElementById('produto-venda').value = data.vl_venda_produto || ''; 
  document.getElementById('produto-data').value = String(data.dt_cadastro_produto || '').slice(0, 10); 
  document.getElementById('produto-status').value = data.status_produto || 'Ativo'; 

  document.querySelector('#produtoModal .modal-title').textContent = 'Editar produto'; 
  bootstrap.Modal.getOrCreateInstance(document.getElementById('produtoModal')).show(); 
}

async function excluirProduto(id) { 
  if (!window.confirm('Tem certeza que deseja excluir este produto?')) return; 

  const { error } = await supabase.from('produto').delete().eq('produtoid', id); 
  if (error) return mensagem('Não foi possível excluir o produto.'); 

  mensagem('Produto excluído com sucesso.', 'success'); 
  carregarProdutos(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarProdutos(); 

  document.querySelector('[data-search]').addEventListener('input', (e) => carregarProdutos(e.target.value)); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarProduto); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.edit) editarProduto(e.target.dataset.edit); 
    if (e.target.dataset.delete) excluirProduto(e.target.dataset.delete); 
  }); 

  document.getElementById('produtoModal').addEventListener('hidden.bs.modal', () => { 
    produtoEmEdicao = null; 
    document.querySelector('#produtoModal form').reset(); 
    document.getElementById('produto-status').value = 'Ativo'; 
    document.querySelector('#produtoModal .modal-title').textContent = 'Novo produto'; 
  }); 
}