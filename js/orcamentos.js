const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let produtosDoOrcamento = [];
let clientesDoOrcamento = [];
let orcamentoEmEdicao = null;
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

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const numero = (v) => {
  const texto = String(v).replace(/[^0-9,.-]/g, '');
  return Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
};

function aplicarMascaraMoeda(campo) {
  const centavos = campo.value.replace(/\D/g, '');
  campo.value = moeda(Number(centavos || 0) / 100);
}

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

function dataAtual() { return new Date().toISOString().slice(0, 10); }
function renderizarPaginacaoOrcamentos(total) { let navegacao = document.getElementById('paginacao-orcamentos'); if (!navegacao) { navegacao = document.createElement('nav'); navegacao.id = 'paginacao-orcamentos'; navegacao.className = 'mt-3'; document.querySelector('[data-records]').closest('section').after(navegacao); } const paginas = Math.ceil(total / REGISTROS_POR_PAGINA); if (paginaAtual > paginas) paginaAtual = Math.max(1, paginas); navegacao.innerHTML = paginas > 1 ? `<ul class="pagination justify-content-end mb-0">${Array.from({ length: paginas }, (_, i) => `<li class="page-item ${paginaAtual === i + 1 ? 'active' : ''}"><button class="page-link" data-pagina-orcamento="${i + 1}">${i + 1}</button></li>`).join('')}</ul>` : ''; }

async function carregarOpcoes() { 
  const [clientes, produtos] = await Promise.all([
    supabase.from('cliente').select('clienteid, nome_cliente').order('nome_cliente'), 
    supabase.from('produto').select('produtoid, ds_produto, vl_venda_produto, valor_variavel').order('ds_produto')
  ]); 

  if (clientes.error || produtos.error) return mostrarErroBanco('Não foi possível carregar clientes e produtos.', clientes.error || produtos.error); 

  clientesDoOrcamento = clientes.data;
  document.getElementById('orc-clientes').innerHTML = clientes.data.map((c) => `<option value="${esc(c.nome_cliente)}"></option>`).join('');
  produtosDoOrcamento = produtos.data; 
}

async function carregarOrcamentos(pesquisa = '') { 
  const [orcamentos, clientes] = await Promise.all([
    supabase.from('orcamento').select('*').order('orcamentoid', { ascending: false }).limit(100), 
    supabase.from('cliente').select('clienteid, nome_cliente')
  ]); 

  if (orcamentos.error || clientes.error) return mostrarErroBanco('Não foi possível carregar os orçamentos.', orcamentos.error || clientes.error); 

  const nomes = new Map(clientes.data.map((c) => [c.clienteid, c.nome_cliente])); 
  const termo = pesquisa.trim().toLocaleLowerCase('pt-BR'); 
  const dados = orcamentos.data.filter((o) => 
    !termo || 
    String(o.orcamentoid).includes(termo) || 
    String(nomes.get(o.clienteid) || '').toLocaleLowerCase('pt-BR').includes(termo)
  ); 

  document.querySelector('[data-record-count]').textContent = `${dados.length} ${dados.length === 1 ? 'registro' : 'registros'}`; 

  renderizarPaginacaoOrcamentos(dados.length);
  const orcamentosDaPagina = dados.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA);
  document.querySelector('[data-records]').innerHTML = dados.length 
    ? orcamentosDaPagina.map((o) => 
        `<tr>` +
          `<td>${o.orcamentoid}</td>` +
          `<td>${esc(nomes.get(o.clienteid) || o.clienteid)}</td>` +
          `<td>${dataFormatada(o.dt_orcamento)}</td>` +
          `<td>${esc(o.obra || '—')}</td>` +
          `<td>${moeda(o.vl_total_orcamento)}</td>` +
          `<td class="text-end">` +
            `<button class="action-button border-0 bg-transparent" data-view="${o.orcamentoid}">Visualizar</button>` +
            `<button class="action-button border-0 bg-transparent" data-edit="${o.orcamentoid}">Editar</button>` +
            `<button class="action-button text-danger border-0 bg-transparent" data-delete="${o.orcamentoid}">Excluir</button>` +
          `</td>` +
        `</tr>`
      ).join('') 
    : '<tr><td colspan="6" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>'; 
}

function opcoesProdutos() { 
  return '<option value="">Selecione o produto</option>' + 
    produtosDoOrcamento.map((p) => `<option value="${p.produtoid}" data-price="${p.vl_venda_produto}" data-variable="${p.valor_variavel === true}">${esc(p.ds_produto)}</option>`).join('');
}

function adicionarItem(item = null) {
  const linha = document.createElement('tr'); 
  linha.innerHTML = 
    `<td><select class="form-select form-select-sm budget-product">${opcoesProdutos()}</select></td>` +
    `<td><input class="form-control form-control-sm budget-quantity" type="number" min="1" value="1"></td>` +
    `<td><span class="budget-price">R$ 0,00</span><input class="form-control form-control-sm budget-manual-price" type="text" inputmode="decimal" aria-label="Valor unitário" value="R$ 0,00" hidden></td>` +
    `<td class="budget-line-total">R$ 0,00</td>` +
    `<td><button class="btn btn-sm text-danger budget-remove" type="button">×</button></td>`; 

  document.getElementById('budget-items').append(linha); 

  if (item) {
    const selecao = linha.querySelector('.budget-product');
    let opcao = [...selecao.options].find((o) => o.value === String(item.produtoid));
    if (!opcao) {
      opcao = document.createElement('option');
      opcao.value = item.produtoid;
      opcao.dataset.price = item.vl_unitario;
      selecao.append(opcao);
    }
    opcao.textContent = item.produtodesc ?? '';
    linha.dataset.unitario = item.vl_unitario;
    linha.querySelector('.budget-manual-price').value = moeda(item.vl_unitario);
    selecao.value = String(item.produtoid);
    linha.querySelector('.budget-quantity').value = item.qt_produto;
    atualizarItem(linha);
  }

  linha.querySelector('.budget-product').addEventListener('change', () => atualizarItem(linha, true));
  linha.querySelector('.budget-manual-price').addEventListener('input', (e) => {
    aplicarMascaraMoeda(e.target);
    atualizarItem(linha);
  });
  linha.querySelector('.budget-quantity').addEventListener('input', () => atualizarItem(linha)); 
  linha.querySelector('.budget-remove').addEventListener('click', () => { 
    linha.remove(); 
    atualizarTotal(); 
  }); 

  atualizarTotal(); 
}

function atualizarItem(linha, redefinirPreco = false) {
  const opcao = linha.querySelector('.budget-product').selectedOptions[0]; 
  const variavel = opcao?.dataset.variable === 'true';
  const campo = linha.querySelector('.budget-manual-price');
  campo.hidden = !variavel;
  campo.disabled = !variavel;
  linha.querySelector('.budget-price').hidden = variavel;
  if (redefinirPreco) {
    linha.dataset.unitario = variavel ? 0 : Number(opcao?.dataset.price || 0);
    campo.value = moeda(linha.dataset.unitario);
  }
  const unitario = variavel ? numero(campo.value) : Number(linha.dataset.unitario ?? opcao?.dataset.price ?? 0);
  linha.dataset.unitario = unitario;
  const quantidade = Number(linha.querySelector('.budget-quantity').value || 0); 

  linha.dataset.total = unitario * quantidade; 
  linha.querySelector('.budget-price').textContent = moeda(unitario); 
  linha.querySelector('.budget-line-total').textContent = moeda(linha.dataset.total); 

  atualizarTotal(); 
}

function resumo() { 
  const total = [...document.querySelectorAll('#budget-items tr')].reduce((soma, linha) => soma + Number(linha.dataset.total || 0), 0); 

  return { total }; 
}

function atualizarTotal() { 
  const { total } = resumo(); 

  document.getElementById('orc-total').textContent = moeda(total); 
}

async function cadastrarOrcamento() { 
  const clienteid = Number(document.getElementById('orc-cliente-id').value); 
  const dt_orcamento = dataAtual(); 
  const obra = document.getElementById('orc-obra').value.trim(); 
  const ambiente_servico = document.getElementById('orc-ambiente').value.trim(); 
  const observacoes = document.getElementById('orc-observacoes').value.trim(); 

  const itens = [...document.querySelectorAll('#budget-items tr')].map((linha) => { 
    const opcao = linha.querySelector('.budget-product').selectedOptions[0]; 
    return { 
      produtoid: Number(opcao?.value), 
      produtodesc: opcao?.textContent, 
      qt_produto: Number(linha.querySelector('.budget-quantity').value), 
      vl_unitario: Number(linha.dataset.unitario),
      vl_total: Number(linha.dataset.total) 
    }; 
  }); 

  if (!clienteid || !obra || !ambiente_servico || !itens.length || itens.some((i) => !i.produtoid || i.qt_produto <= 0)) {
    return mensagem('Informe cliente, nome da obra, ambiente e ao menos um produto com quantidade válida.'); 
  }

  const linhas = [...document.querySelectorAll('#budget-items tr')];
  const variavelSemValor = itens.find((item, indice) =>
    linhas[indice].querySelector('.budget-product').selectedOptions[0]?.dataset.variable === 'true' &&
    (!Number.isFinite(item.vl_unitario) || item.vl_unitario <= 0)
  );
  if (variavelSemValor) return mensagem(`Informe o valor do produto "${esc(variavelSemValor.produtodesc)}".`);

  const { total } = resumo(); 
  if (orcamentoEmEdicao !== null) {
    if (!Number.isFinite(total) || itens.some((i) =>
      !Number.isFinite(i.produtoid) || !Number.isFinite(i.qt_produto) ||
      !Number.isFinite(i.vl_unitario) || i.vl_unitario < 0 || !Number.isFinite(i.vl_total)
    )) return mensagem('Informe produtos, quantidades e valores válidos.');

    const id = orcamentoEmEdicao;
    const botaoSalvar = document.querySelector('[data-save]');
    if (botaoSalvar.disabled) return;
    botaoSalvar.disabled = true;
    try {
      const { error } = await supabase.from('orcamento')
        .update({ clienteid, obra, ambiente_servico, observacoes, vl_total_orcamento: total })
        .eq('orcamentoid', id);
      if (error) return mostrarErroBanco('Não foi possível atualizar o orçamento.', error);

      const { error: erroExclusao } = await supabase.from('orcamento_item').delete().eq('orcamentoid', id);
      if (erroExclusao) return mostrarErroBanco('Os dados do orçamento foram atualizados, mas não foi possível substituir os itens.', erroExclusao);

      const { error: erroItens } = await supabase.from('orcamento_item')
        .insert(itens.map((i) => ({ ...i, orcamentoid: id })));
      if (erroItens) return mostrarErroBanco('Os itens anteriores foram removidos, mas não foi possível salvar os novos. Mantenha o formulário aberto e tente salvar novamente.', erroItens);

      orcamentoEmEdicao = null;
      mensagem('Orçamento atualizado com sucesso.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('orcamentoModal'))?.hide();
      carregarOrcamentos(document.querySelector('[data-search]').value);
    } catch (erro) {
      mostrarErroBanco('Não foi possível concluir a edição do orçamento. Confira os dados antes de tentar novamente.', erro);
    } finally {
      botaoSalvar.disabled = false;
    }
    return;
  }

  const { data: orcamento, error } = await supabase
    .from('orcamento')
    .insert({ clienteid, dt_orcamento, obra, ambiente_servico, observacoes, vl_total_orcamento: total })
    .select('orcamentoid')
    .single(); 

  if (error) return mensagem('Não foi possível criar o orçamento.'); 

  const { error: erroItens } = await supabase
    .from('orcamento_item')
    .insert(itens.map(i => ({
      ...i,
      orcamentoid: orcamento.orcamentoid
    }))); 

  if (erroItens) {
    const detalhes = [erroItens.message, erroItens.details, erroItens.hint].filter(Boolean).join(' ');
    console.error('Não foi possível salvar os itens do orçamento:', erroItens);
    return mensagem(`O orçamento foi criado, mas não foi possível salvar os itens. Motivo informado pelo banco: ${detalhes || 'erro sem detalhes retornados.'}`);
  }

  carregarOrcamentos(document.querySelector('[data-search]').value); 
  const cadastrarOutro = window.confirm('Orçamento cadastrado com sucesso. Deseja cadastrar outro orçamento utilizando estes dados como base?');
  if (!cadastrarOutro) bootstrap.Modal.getInstance(document.getElementById('orcamentoModal'))?.hide();
}

async function editarOrcamento(id) {
  const [orcamento, itens] = await Promise.all([
    supabase.from('orcamento').select('orcamentoid, clienteid, obra, ambiente_servico, observacoes').eq('orcamentoid', id).single(),
    supabase.from('orcamento_item').select('produtoid, produtodesc, qt_produto, vl_unitario, vl_total').eq('orcamentoid', id)
  ]);
  if (orcamento.error || itens.error) return mostrarErroBanco('Não foi possível carregar o orçamento para edição.', orcamento.error || itens.error);

  const { data: cliente, error } = await supabase.from('cliente').select('nome_cliente').eq('clienteid', orcamento.data.clienteid).single();
  if (error) return mostrarErroBanco('Não foi possível carregar o cliente do orçamento.', error);

  orcamentoEmEdicao = orcamento.data.orcamentoid;
  document.getElementById('orc-cliente').value = cliente.nome_cliente ?? '';
  document.getElementById('orc-cliente-id').value = orcamento.data.clienteid;
  document.getElementById('orc-obra').value = orcamento.data.obra ?? '';
  document.getElementById('orc-ambiente').value = orcamento.data.ambiente_servico ?? '';
  document.getElementById('orc-observacoes').value = orcamento.data.observacoes ?? '';
  document.getElementById('budget-items').innerHTML = '';
  itens.data.forEach((item) => adicionarItem(item));
  atualizarTotal();
  document.querySelector('#orcamentoModal .modal-title').textContent = 'Editar orçamento';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('orcamentoModal')).show();
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

async function visualizarOrcamento(id) {
  const [orcamento, itens] = await Promise.all([
    supabase.from('orcamento').select('*').eq('orcamentoid', id).single(),
    supabase.from('orcamento_item').select('produtodesc, qt_produto, vl_unitario, vl_total').eq('orcamentoid', id)
  ]);
  if (orcamento.error || itens.error) return mostrarErroBanco('Não foi possível carregar o orçamento.', orcamento.error || itens.error);

  const { data: cliente, error: erroCliente } = await supabase.from('cliente').select('nome_cliente, tipo_cliente').eq('clienteid', orcamento.data.clienteid).single();
  if (erroCliente) return mostrarErroBanco('Não foi possível carregar o cliente do orçamento.', erroCliente);

  document.getElementById('documento-orcamento').innerHTML =
    `<div style="font-family:Arial,sans-serif;color:#111;padding:12px">` +
    `<h1 style="text-align:center;font-size:24px;margin:0 0 24px">CYA GESSO</h1>` +
    `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #777;padding-bottom:12px;margin-bottom:20px"><div>CNPJ: 26.865.625/0001-00<br>Telefone: (44) 9.9837-1440</div><div>Data: ${dataFormatada(orcamento.data.dt_orcamento)}</div></div>` +
    `<p><span class="somente-administrativo"><strong>Número do orçamento:</strong> ${esc(orcamento.data.orcamentoid)}<br></span><strong>Cliente:</strong> ${esc(cliente.nome_cliente)}<br><span class="somente-administrativo"><strong>Tipo do cliente:</strong> ${esc(cliente.tipo_cliente)}<br><strong>Obra:</strong> ${esc(orcamento.data.obra || '—')}<br><strong>Ambiente do serviço:</strong> ${esc(orcamento.data.ambiente_servico || '—')}<br></span><span class="somente-impressao"><strong>Obra:</strong> ${esc(orcamento.data.obra || '—')}<br></span></p>` +
    `<p style="text-align:left;font-weight:bold;margin:28px 0">CONFORME SOLICITAÇÃO, ESTAMOS ENVIANDO NOSSA PROPOSTA COMERCIAL<br>PARA REALIZAÇÃO DE NOSSOS SERVIÇOS</p>` +
    `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #777;padding:6px">Produto</th><th style="text-align:right;border-bottom:1px solid #777;padding:6px">Metros²</th><th style="text-align:right;border-bottom:1px solid #777;padding:6px">Unitário</th><th style="text-align:right;border-bottom:1px solid #777;padding:6px">Total</th></tr></thead><tbody>${itens.data.map((item) => `<tr><td style="padding:6px">${esc(item.produtodesc)}</td><td style="text-align:right;padding:6px">${esc(item.qt_produto)}</td><td style="text-align:right;padding:6px">${moeda(item.vl_unitario)}</td><td style="text-align:right;padding:6px">${moeda(item.vl_total)}</td></tr>`).join('')}</tbody></table>` +
    `<div style="border-top:1px solid #777;margin-top:20px;padding-top:14px"><strong>Observações:</strong><p>${esc(orcamento.data.observacoes || 'Nenhuma observação informada.')}</p></div>` +
    `<div style="border-top:1px solid #777;margin-top:20px;padding-top:14px;text-align:right"><strong style="font-size:18px">TOTAL<br>${moeda(orcamento.data.vl_total_orcamento)}</strong></div></div>`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('visualizacaoModal')).show();
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarOpcoes().then(() => { 
    carregarOrcamentos(); 
    adicionarItem(); 
  }); 

  document.querySelector('[data-search]').addEventListener('input', (e) => { paginaAtual = 1; carregarOrcamentos(e.target.value); }); 
  document.querySelector('[data-add-item]').addEventListener('click', () => adicionarItem());
  document.querySelector('[data-save]').addEventListener('click', cadastrarOrcamento); 
  document.addEventListener('click', (e) => { 
    if (e.target.dataset.delete) excluirOrcamento(e.target.dataset.delete); 
    if (e.target.dataset.view) visualizarOrcamento(e.target.dataset.view);
    if (e.target.dataset.edit) editarOrcamento(e.target.dataset.edit);
    if (e.target.dataset.paginaOrcamento) { paginaAtual = Number(e.target.dataset.paginaOrcamento); carregarOrcamentos(document.querySelector('[data-search]').value); }
  }); 

  document.getElementById('orc-cliente').addEventListener('input', (e) => { const cliente = clientesDoOrcamento.find((c) => c.nome_cliente === e.target.value); document.getElementById('orc-cliente-id').value = cliente ? cliente.clienteid : ''; });
  document.querySelector('[data-imprimir-orcamento]').addEventListener('click', () => window.print());
  document.getElementById('orcamentoModal').addEventListener('hidden.bs.modal', () => { 
    orcamentoEmEdicao = null;
    document.querySelector('#orcamentoModal .modal-title').textContent = 'Novo orçamento';
    document.querySelector('#orcamentoModal form').reset(); 
    document.getElementById('budget-items').innerHTML = ''; 
    adicionarItem(); 
  }); 
}
