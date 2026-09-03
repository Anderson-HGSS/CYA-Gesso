const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let produtosDoOrcamento = [];

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

async function carregarOpcoes() { 
  const [clientes, produtos] = await Promise.all([
    supabase.from('cliente').select('clienteid, nome_cliente').order('nome_cliente'), 
    supabase.from('produto').select('produtoid, ds_produto, vl_venda_produto').order('ds_produto')
  ]); 

  if (clientes.error || produtos.error) return mensagem('Não foi possível carregar clientes e produtos.'); 

  document.getElementById('orc-cliente').innerHTML = 
    '<option value="">Selecione o cliente</option>' + 
    clientes.data.map((c) => `<option value="${c.clienteid}">${esc(c.nome_cliente)}</option>`).join(''); 

  produtosDoOrcamento = produtos.data; 
}

async function carregarOrcamentos(pesquisa = '') { 
  const [orcamentos, clientes] = await Promise.all([
    supabase.from('orcamento').select('*').order('orcamentoid', { ascending: false }).limit(100), 
    supabase.from('cliente').select('clienteid, nome_cliente')
  ]); 

  if (orcamentos.error || clientes.error) return mensagem('Não foi possível carregar os orçamentos.'); 

  const nomes = new Map(clientes.data.map((c) => [c.clienteid, c.nome_cliente])); 
  const termo = pesquisa.trim().toLocaleLowerCase('pt-BR'); 
  const dados = orcamentos.data.filter((o) => 
    !termo || 
    String(o.orcamentoid).includes(termo) || 
    String(nomes.get(o.clienteid) || '').toLocaleLowerCase('pt-BR').includes(termo)
  ); 

  document.querySelector('[data-record-count]').textContent = `${dados.length} ${dados.length === 1 ? 'registro' : 'registros'}`; 

  document.querySelector('[data-records]').innerHTML = dados.length 
    ? dados.map((o) => 
        `<tr>` +
          `<td>${o.orcamentoid}</td>` +
          `<td>${esc(nomes.get(o.clienteid) || o.clienteid)}</td>` +
          `<td>${dataFormatada(o.dt_orcamento)}</td>` +
          `<td>${dataFormatada(o.dt_validade_orcamento)}</td>` +
          `<td>${moeda(o.vl_total_orcamento)}</td>` +
          `<td class="text-end">` +
            `<button class="action-button text-danger border-0 bg-transparent" data-delete="${o.orcamentoid}">Excluir</button>` +
          `</td>` +
        `</tr>`
      ).join('') 
    : '<tr><td colspan="6" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>'; 
}

function opcoesProdutos() { 
  return '<option value="">Selecione o produto</option>' + 
    produtosDoOrcamento.map((p) => `<option value="${p.produtoid}" data-price="${p.vl_venda_produto}">${esc(p.ds_produto)}</option>`).join(''); 
}

function adicionarItem() { 
  const linha = document.createElement('tr'); 
  linha.innerHTML = 
    `<td><select class="form-select form-select-sm budget-product">${opcoesProdutos()}</select></td>` +
    `<td><input class="form-control form-control-sm budget-quantity" type="number" min="1" value="1"></td>` +
    `<td class="budget-price">R$ 0,00</td>` +
    `<td class="budget-line-total">R$ 0,00</td>` +
    `<td><button class="btn btn-sm text-danger budget-remove" type="button">×</button></td>`; 

  document.getElementById('budget-items').append(linha); 

  linha.querySelector('.budget-product').addEventListener('change', () => atualizarItem(linha)); 
  linha.querySelector('.budget-quantity').addEventListener('input', () => atualizarItem(linha)); 
  linha.querySelector('.budget-remove').addEventListener('click', () => { 
    linha.remove(); 
    atualizarTotal(); 
  }); 

  atualizarTotal(); 
}

function atualizarItem(linha) { 
  const opcao = linha.querySelector('.budget-product').selectedOptions[0]; 
  const unitario = Number(opcao?.dataset.price || 0); 
  const quantidade = Number(linha.querySelector('.budget-quantity').value || 0); 

  linha.dataset.total = unitario * quantidade; 
  linha.querySelector('.budget-price').textContent = moeda(unitario); 
  linha.querySelector('.budget-line-total').textContent = moeda(linha.dataset.total); 

  atualizarTotal(); 
}

function resumo() { 
  const subtotal = [...document.querySelectorAll('#budget-items tr')].reduce((soma, linha) => soma + Number(linha.dataset.total || 0), 0); 
  const percentual = Number(document.getElementById('orc-desconto').value || 0); 
  const desconto = subtotal * Math.min(100, Math.max(0, percentual)) / 100; 

  return { subtotal, percentual, desconto, total: subtotal - desconto }; 
}

function atualizarTotal() { 
  const { subtotal, percentual, desconto, total } = resumo(); 

  document.getElementById('orc-subtotal').textContent = moeda(subtotal); 
  document.getElementById('orc-discount-rate').textContent = `${percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`; 
  document.getElementById('orc-discount-value').textContent = moeda(desconto); 
  document.getElementById('orc-total').textContent = moeda(total); 
}

async function cadastrarOrcamento() { 
  const clienteid = Number(document.getElementById('orc-cliente').value); 
  const dt_orcamento = document.getElementById('orc-data').value; 
  const dt_validade_orcamento = document.getElementById('orc-validade').value; 

  const itens = [...document.querySelectorAll('#budget-items tr')].map((linha) => { 
    const opcao = linha.querySelector('.budget-product').selectedOptions[0]; 
    return { 
      produtoid: Number(opcao?.value), 
      produtodesc: opcao?.textContent, 
      qt_produto: Number(linha.querySelector('.budget-quantity').value), 
      vl_unitario: Number(opcao?.dataset.price), 
      vl_total: Number(linha.dataset.total) 
    }; 
  }); 

  if (!clienteid || !dt_orcamento || !dt_validade_orcamento || !itens.length || itens.some((i) => !i.produtoid || i.qt_produto <= 0)) {
    return mensagem('Informe cliente, datas e ao menos um produto com quantidade válida.'); 
  }

  const { total } = resumo(); 
  const { data: orcamento, error } = await supabase
    .from('orcamento')
    .insert({ clienteid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento: total })
    .select('orcamentoid')
    .single(); 

  if (error) return mensagem('Não foi possível criar o orçamento.'); 

  const { error: erroItens } = await supabase
    .from('orcamento_item')
    .insert(itens.map((i) => ({ ...i, orcamentoid: orcamento.orcamentoid }))); 

  if (erroItens) return mensagem('O orçamento foi criado, mas não foi possível salvar os itens.'); 

  bootstrap.Modal.getInstance(document.getElementById('orcamentoModal'))?.hide(); 
  mensagem('Orçamento cadastrado com sucesso.', 'success'); 
  carregarOrcamentos(document.querySelector('[data-search]').value); 
}

async function excluirOrcamento(id) { 
  if (!window.confirm('Tem certeza que deseja excluir este orçamento?')) return; 

  const { error: erroItens } = await supabase.from('orcamento_item').delete().eq('orcamentoid', id); 
  if (erroItens) return mensagem('Não foi possível excluir os itens do orçamento.'); 

  const { error } = await supabase.from('orcamento').delete().eq('orcamentoid', id); 
  if (error) return mensagem('Não foi possível excluir o orçamento.'); 

  mensagem('Orçamento excluído com sucesso.', 'success'); 
  carregarOrcamentos(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarOpcoes().then(() => { 
    carregarOrcamentos(); 
    adicionarItem(); 
  }); 

  document.querySelector('[data-search]').addEventListener('input', (e) => carregarOrcamentos(e.target.value)); 
  document.querySelector('[data-add-item]').addEventListener('click', adicionarItem); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarOrcamento); 
  document.getElementById('orc-desconto').addEventListener('input', atualizarTotal); 

  document.addEventListener('click', (e) => { 
    if (e.target.dataset.delete) excluirOrcamento(e.target.dataset.delete); 
  }); 

  document.getElementById('orcamentoModal').addEventListener('hidden.bs.modal', () => { 
    document.querySelector('#orcamentoModal form').reset(); 
    document.getElementById('budget-items').innerHTML = ''; 
    adicionarItem(); 
  }); 
}