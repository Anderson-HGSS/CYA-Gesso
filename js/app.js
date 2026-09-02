import { supabase } from './supabase.js';
import { DB } from './config.js';
import { requireAuth, logout, showMessage } from './auth.js';

const page = document.documentElement.dataset.page;
const f = DB.fields;
const fieldsForPage = { clientes: f.cliente, categorias: f.categoria, produtos: f.produto, orcamentos: f.orcamento, usuarios: f.usuarios };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(String(value).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function initNav() { document.querySelectorAll('[data-action="logout"]').forEach(el => el.addEventListener('click', logout)); }
function emptyRow(columns) { return `<tr><td colspan="${columns}" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>`; }
function setCount(count) { const counter = document.querySelector('[data-record-count]'); if (counter) counter.textContent = `${count} ${count === 1 ? 'registro' : 'registros'}`; }
function actions(id) { return `<button class="action-button text-danger border-0 bg-transparent" data-delete="${esc(id)}">Excluir</button>`; }

async function loadRecords() {
  const tbody = document.querySelector('tbody[data-records]');
  if (!tbody || !DB[page]) return;
  const { data, error } = await supabase.from(DB[page]).select('*').order(fieldsForPage[page]?.id || 'id', { ascending: false }).limit(100);
  if (error) { console.error(error); tbody.innerHTML = `<tr><td colspan="${tbody.dataset.columns}" class="text-center text-danger py-4">Não foi possível carregar os registros.</td></tr>`; return showMessage('Não foi possível carregar os registros. Tente novamente mais tarde.'); }
  setCount(data.length); tbody.innerHTML = data.length ? await rowsForPage(data) : emptyRow(tbody.dataset.columns);
}

async function rowsForPage(rows) {
  if (page === 'clientes') return rows.map(row => `<tr><td>${esc(row.clienteid)}</td><td><strong>${esc(row.nome_cliente)}</strong></td><td>${esc(row.tipo_cliente)}</td><td>${esc(row.cpf_cnpj_cliente)}</td><td class="text-end">${actions(row.clienteid)}</td></tr>`).join('');
  if (page === 'categorias') return rows.map(row => `<tr><td>${esc(row.categoriaprodutoid)}</td><td><strong>${esc(row.ds_categoria_produto)}</strong></td><td class="text-end">${actions(row.categoriaprodutoid)}</td></tr>`).join('');
  if (page === 'usuarios') return rows.map(row => `<tr><td>${esc(row.id)}</td><td><strong>${esc(row.usuario)}</strong></td><td>${esc(row.nome_completo)}</td><td class="text-end">${actions(row.id)}</td></tr>`).join('');
  if (page === 'produtos') {
    const { data: categories, error } = await supabase.from(DB.categorias).select('categoriaprodutoid, ds_categoria_produto');
    if (error) { console.error(error); showMessage('Não foi possível carregar as categorias dos produtos.'); }
    const names = new Map((categories || []).map(item => [item.categoriaprodutoid, item.ds_categoria_produto]));
    return rows.map(row => `<tr><td>${esc(row.produtoid)}</td><td><strong>${esc(row.ds_produto)}</strong></td><td>${esc(names.get(row.categoriaprodutoid) || row.categoriaprodutoid)}</td><td>${esc(row.obs_produto || '—')}</td><td>${money(row.vl_venda_produto)}</td><td>${date(row.dt_cadastro_produto)}</td><td>${esc(row.status_produto || '—')}</td><td class="text-end">${actions(row.produtoid)}</td></tr>`).join('');
  }
  if (page === 'orcamentos') {
    const { data: clients, error } = await supabase.from(DB.clientes).select('clienteid, nome_cliente');
    if (error) { console.error(error); showMessage('Não foi possível carregar os clientes dos orçamentos.'); }
    const names = new Map((clients || []).map(item => [item.clienteid, item.nome_cliente]));
    return rows.map(row => `<tr><td>${esc(row.orcamentoid)}</td><td>${esc(names.get(row.clienteid) || row.clienteid)}</td><td>${date(row.dt_orcamento)}</td><td>${date(row.dt_validade_orcamento)}</td><td>${money(row.vl_total_orcamento)}</td><td class="text-end">${actions(row.orcamentoid)}</td></tr>`).join('');
  }
  return '';
}

async function deleteRecord(id) {
  if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
  const { error } = await supabase.from(DB[page]).delete().eq(fieldsForPage[page].id, id);
  if (error) { console.error(error); return showMessage('Não foi possível excluir o registro.'); }
  showMessage('Registro excluído com sucesso.', 'success'); loadRecords();
}
function value(id) { return document.getElementById(id)?.value.trim() || ''; }
function numberValue(raw) { const text = String(raw).replace(/[^0-9,.-]/g, ''); return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text); }

async function loadCategories() {
  const select = document.getElementById('produto-categoria'); if (!select) return;
  const { data, error } = await supabase.from(DB.categorias).select('categoriaprodutoid, ds_categoria_produto').order('ds_categoria_produto');
  if (error) { console.error(error); return showMessage('Não foi possível carregar as categorias.'); }
  select.innerHTML = '<option value="">Selecione uma categoria</option>' + (data.length ? data.map(item => `<option value="${item.categoriaprodutoid}">${esc(item.ds_categoria_produto)}</option>`).join('') : '<option value="" disabled>Nenhuma categoria cadastrada.</option>');
}

async function loadBudgetOptions() {
  const [clientsResult, productsResult] = await Promise.all([supabase.from(DB.clientes).select('clienteid, nome_cliente').order('nome_cliente'), supabase.from(DB.produtos).select('produtoid, ds_produto, vl_venda_produto').order('ds_produto')]);
  if (clientsResult.error || productsResult.error) { console.error(clientsResult.error || productsResult.error); return showMessage('Não foi possível carregar clientes e produtos para o orçamento.'); }
  document.getElementById('orc-cliente').innerHTML = '<option value="">Selecione o cliente</option>' + (clientsResult.data.length ? clientsResult.data.map(item => `<option value="${item.clienteid}">${esc(item.nome_cliente)}</option>`).join('') : '<option value="" disabled>Nenhum cliente cadastrado.</option>');
  window.budgetProducts = productsResult.data; addBudgetItem();
}
function productOptions() { return '<option value="">Selecione o produto</option>' + (window.budgetProducts || []).map(item => `<option value="${item.produtoid}" data-price="${item.vl_venda_produto}">${esc(item.ds_produto)}</option>`).join(''); }
function addBudgetItem() {
  const tbody = document.querySelector('#budget-items'); if (!tbody) return;
  const tr = document.createElement('tr'); tr.innerHTML = `<td><select class="form-select form-select-sm budget-product">${productOptions()}</select></td><td><input class="form-control form-control-sm budget-quantity" type="number" min="1" value="1"></td><td class="budget-price">R$ 0,00</td><td class="budget-line-total">R$ 0,00</td><td><button class="btn btn-sm text-danger budget-remove" type="button" aria-label="Remover item">×</button></td>`;
  tbody.append(tr); tr.querySelector('.budget-product').addEventListener('change', () => updateBudgetRow(tr)); tr.querySelector('.budget-quantity').addEventListener('input', () => updateBudgetRow(tr)); tr.querySelector('.budget-remove').addEventListener('click', () => { tr.remove(); updateBudgetTotal(); }); updateBudgetTotal();
}
function updateBudgetRow(row) { const option = row.querySelector('.budget-product').selectedOptions[0], unit = Number(option?.dataset.price || 0), quantity = Number(row.querySelector('.budget-quantity').value || 0); row.dataset.total = unit * quantity; row.querySelector('.budget-price').textContent = money(unit); row.querySelector('.budget-line-total').textContent = money(row.dataset.total); updateBudgetTotal(); }
function updateBudgetTotal() { const total = [...document.querySelectorAll('#budget-items tr')].reduce((sum, row) => sum + Number(row.dataset.total || 0), 0); const output = document.getElementById('orc-total'); if (output) output.textContent = money(total); }

async function saveBudget() {
  const clienteId = value('orc-cliente'), data = value('orc-data'), validade = value('orc-validade');
  const items = [...document.querySelectorAll('#budget-items tr')].map(row => { const selected = row.querySelector('.budget-product').selectedOptions[0]; return { produtoid: Number(selected?.value), produtodesc: selected?.textContent, qt_produto: Number(row.querySelector('.budget-quantity').value), vl_unitario: Number(selected?.dataset.price), vl_total: Number(row.dataset.total) }; });
  if (!clienteId || !data || !validade || !items.length || items.some(item => !item.produtoid || item.qt_produto <= 0)) return showMessage('Informe cliente, datas e ao menos um produto com quantidade válida.');
  const total = items.reduce((sum, item) => sum + item.vl_total, 0);
  const { data: budget, error: budgetError } = await supabase.from(DB.orcamentos).insert({ clienteid: Number(clienteId), dt_orcamento: data, dt_validade_orcamento: validade, vl_total_orcamento: total }).select('orcamentoid').single();
  if (budgetError) { console.error(budgetError); return showMessage('Não foi possível criar o orçamento.'); }
  const { error: itemError } = await supabase.from(DB.itensOrcamento).insert(items.map(item => ({ ...item, orcamentoid: budget.orcamentoid })));
  if (itemError) { console.error(itemError); return showMessage('O orçamento foi criado, mas não foi possível salvar os itens.'); }
  bootstrap.Modal.getInstance(document.querySelector('#orcamentoModal'))?.hide(); showMessage('Orçamento cadastrado com sucesso.', 'success'); loadRecords();
}

async function saveSimpleRecord() {
  let table, payload;
  if (page === 'clientes') { const nome = value('cliente-nome'), documento = value('cliente-doc'), tipo = value('cliente-tipo'); if (!nome || !documento || !tipo) return showMessage('Preencha nome, CPF/CNPJ e tipo de cliente.'); table = DB.clientes; payload = { nome_cliente: nome, cpf_cnpj_cliente: documento, tipo_cliente: tipo }; }
  else if (page === 'categorias') { const nome = value('categoria-nome'); if (!nome) return showMessage('Preencha o nome da categoria.'); table = DB.categorias; payload = { ds_categoria_produto: nome }; }
  else if (page === 'produtos') { const nome = value('produto-nome'), category = value('produto-categoria'), price = numberValue(value('produto-venda')); if (!nome || !category || !Number.isFinite(price)) return showMessage('Preencha produto, categoria e preço de venda.'); table = DB.produtos; payload = { ds_produto: nome, categoriaprodutoid: Number(category), obs_produto: value('produto-descricao') || null, vl_venda_produto: price, dt_cadastro_produto: value('produto-data') || new Date().toISOString().slice(0, 10), status_produto: value('produto-status') || null }; }
  else if (page === 'usuarios') { const usuario = value('usuario'), nome = value('nome-completo'), senha = value('senha'); if (!usuario || !nome || !senha) return showMessage('Preencha usuário, nome completo e senha.'); table = DB.usuarios; payload = { usuario, nome_completo: nome, senha }; } else return;
  const { error } = await supabase.from(table).insert(payload);
  if (error) { console.error(error); return showMessage('Não foi possível cadastrar o registro.'); }
  bootstrap.Modal.getInstance(document.querySelector('.modal'))?.hide(); document.querySelector('.modal form')?.reset(); showMessage('Registro cadastrado com sucesso.', 'success'); loadRecords();
}
function bindEvents() { document.addEventListener('click', event => { if (event.target.dataset.delete) deleteRecord(event.target.dataset.delete); }); document.querySelector('[data-save]')?.addEventListener('click', () => page === 'orcamentos' ? saveBudget() : saveSimpleRecord()); document.querySelector('[data-add-item]')?.addEventListener('click', addBudgetItem); }
async function init() { await requireAuth(); initNav(); bindEvents(); if (page === 'produtos') loadCategories(); if (page === 'orcamentos') loadBudgetOptions(); if (DB[page]) loadRecords(); }
init();
