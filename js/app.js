import { supabase } from './supabase.js';
import { DB } from './config.js';
import { requireAuth, logout, showMessage, getCurrentUser } from './auth.js';

const page = document.documentElement.dataset.page;
const fields = { clientes: DB.fields.cliente, categorias: DB.fields.categoria, produtos: DB.fields.produto, orcamentos: DB.fields.orcamento, usuarios: DB.fields.usuarios };
let activeSearch = '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';
const value = id => document.getElementById(id)?.value.trim() || '';
const numberValue = raw => { const text = String(raw).replace(/[^0-9,.-]/g, ''); return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text); };

function showSaveError(context, error) {
  const detail = error?.message || 'Erro sem detalhes retornados pelo Supabase.';
  console.error(context, error);
  showMessage(`${context} Detalhes: ${esc(detail)}`);
  window.alert(`${context}\n\nDetalhes técnicos: ${detail}`);
}

function initNav() { document.querySelectorAll('[data-action="logout"]').forEach(el => el.addEventListener('click', logout)); }
function setCount(count) { const el = document.querySelector('[data-record-count]'); if (el) el.textContent = `${count} ${count === 1 ? 'registro' : 'registros'}`; }
function emptyRow(columns) { return `<tr><td colspan="${columns}" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>`; }
function action(id) { return `<button class="action-button text-danger border-0 bg-transparent" data-delete="${esc(id)}">Excluir</button>`; }

function searchQuery(query, term) {
  if (!term) return query;
  if (page === 'clientes') return query.or(`nome_cliente.ilike.%${term}%,cpf_cnpj_cliente.ilike.%${term}%`);
  if (page === 'categorias') return query.ilike('ds_categoria_produto', `%${term}%`);
  if (page === 'produtos') return query.ilike('ds_produto', `%${term}%`);
  return query;
}

async function loadRecords(search = activeSearch) {
  const tbody = document.querySelector('[data-records]');
  if (!tbody || !DB[page]) return;
  activeSearch = search.trim();
  const query = searchQuery(supabase.from(DB[page]).select('*').order(fields[page].id, { ascending: false }).limit(100), activeSearch);
  const { data, error } = await query;
  if (error) { console.error(error); tbody.innerHTML = `<tr><td colspan="${tbody.dataset.columns}" class="text-center text-danger py-4">Não foi possível realizar a pesquisa.</td></tr>`; return showMessage('Não foi possível realizar a pesquisa.'); }
  const html = await renderRows(data);
  const count = html ? (page === 'orcamentos' ? (html.match(/<tr>/g) || []).length : data.length) : 0;
  setCount(count); tbody.innerHTML = html || emptyRow(tbody.dataset.columns);
}

async function renderRows(rows) {
  if (page === 'clientes') return rows.map(row => `<tr><td>${esc(row.clienteid)}</td><td><strong>${esc(row.nome_cliente)}</strong></td><td>${esc(row.tipo_cliente)}</td><td>${esc(row.cpf_cnpj_cliente)}</td><td class="text-end">${action(row.clienteid)}</td></tr>`).join('');
  if (page === 'categorias') return rows.map(row => `<tr><td>${esc(row.categoriaprodutoid)}</td><td><strong>${esc(row.ds_categoria_produto)}</strong></td><td class="text-end">${action(row.categoriaprodutoid)}</td></tr>`).join('');
  if (page === 'produtos') {
    const { data: categories, error } = await supabase.from(DB.categorias).select('categoriaprodutoid, ds_categoria_produto');
    if (error) { console.error(error); showMessage('Não foi possível carregar as categorias dos produtos.'); }
    const names = new Map((categories || []).map(item => [item.categoriaprodutoid, item.ds_categoria_produto]));
    return rows.map(row => `<tr><td>${esc(row.produtoid)}</td><td><strong>${esc(row.ds_produto)}</strong></td><td>${esc(names.get(row.categoriaprodutoid) || row.categoriaprodutoid)}</td><td>${esc(row.obs_produto || '—')}</td><td>${money(row.vl_venda_produto)}</td><td>${date(row.dt_cadastro_produto)}</td><td>${esc(row.status_produto || '—')}</td><td class="text-end">${action(row.produtoid)}</td></tr>`).join('');
  }
  if (page === 'orcamentos') {
    const { data: clients, error } = await supabase.from(DB.clientes).select('clienteid, nome_cliente');
    if (error) { console.error(error); showMessage('Não foi possível carregar os clientes dos orçamentos.'); }
    const names = new Map((clients || []).map(item => [item.clienteid, item.nome_cliente]));
    const term = activeSearch.toLocaleLowerCase('pt-BR');
    const filtered = rows.filter(row => !term || String(row.orcamentoid).includes(term) || String(names.get(row.clienteid) || '').toLocaleLowerCase('pt-BR').includes(term));
    return filtered.map(row => `<tr><td>${esc(row.orcamentoid)}</td><td>${esc(names.get(row.clienteid) || row.clienteid)}</td><td>${date(row.dt_orcamento)}</td><td>${date(row.dt_validade_orcamento)}</td><td>${money(row.vl_total_orcamento)}</td><td class="text-end">${action(row.orcamentoid)}</td></tr>`).join('');
  }
  return '';
}

async function deleteRecord(id) {
  if (page === 'usuarios' && !getCurrentUser()?.isAdmin) return showMessage('Apenas o administrador pode excluir usuários.');
  if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
  const { error } = await supabase.from(DB[page]).delete().eq(fields[page].id, id);
  if (error) { console.error(error); return showMessage('Não foi possível excluir o registro.'); }
  showMessage('Registro excluído com sucesso.', 'success'); loadRecords();
}

async function loadCategories() {
  const select = document.getElementById('produto-categoria'); if (!select) return;
  const { data, error } = await supabase.from(DB.categorias).select('categoriaprodutoid, ds_categoria_produto').order('ds_categoria_produto');
  if (error) { console.error(error); return showMessage('Não foi possível carregar as categorias.'); }
  select.innerHTML = '<option value="">Selecione uma categoria</option>' + (data.length ? data.map(item => `<option value="${item.categoriaprodutoid}">${esc(item.ds_categoria_produto)}</option>`).join('') : '<option value="" disabled>Nenhuma categoria cadastrada.</option>');
}

async function loadBudgetOptions() {
  const [clients, products] = await Promise.all([supabase.from(DB.clientes).select('clienteid, nome_cliente').order('nome_cliente'), supabase.from(DB.produtos).select('produtoid, ds_produto, vl_venda_produto').order('ds_produto')]);
  if (clients.error || products.error) { console.error(clients.error || products.error); return showMessage('Não foi possível carregar clientes e produtos para o orçamento.'); }
  document.getElementById('orc-cliente').innerHTML = '<option value="">Selecione o cliente</option>' + (clients.data.length ? clients.data.map(item => `<option value="${item.clienteid}">${esc(item.nome_cliente)}</option>`).join('') : '<option value="" disabled>Nenhum cliente cadastrado.</option>');
  window.budgetProducts = products.data; addBudgetItem();
}
function productOptions() { return '<option value="">Selecione o produto</option>' + (window.budgetProducts || []).map(item => `<option value="${item.produtoid}" data-price="${item.vl_venda_produto}">${esc(item.ds_produto)}</option>`).join(''); }
function addBudgetItem() {
  const tbody = document.getElementById('budget-items'); if (!tbody) return;
  const row = document.createElement('tr');
  row.innerHTML = `<td><select class="form-select form-select-sm budget-product">${productOptions()}</select></td><td><input class="form-control form-control-sm budget-quantity" type="number" min="1" value="1"></td><td class="budget-price">R$ 0,00</td><td class="budget-line-total">R$ 0,00</td><td><button class="btn btn-sm text-danger budget-remove" type="button" aria-label="Remover item">×</button></td>`;
  tbody.append(row); row.querySelector('.budget-product').addEventListener('change', () => updateBudgetRow(row)); row.querySelector('.budget-quantity').addEventListener('input', () => updateBudgetRow(row)); row.querySelector('.budget-remove').addEventListener('click', () => { row.remove(); updateBudgetTotal(); }); updateBudgetTotal();
}
function updateBudgetRow(row) { const option = row.querySelector('.budget-product').selectedOptions[0]; const unit = Number(option?.dataset.price || 0); const quantity = Number(row.querySelector('.budget-quantity').value || 0); row.dataset.total = unit * quantity; row.querySelector('.budget-price').textContent = money(unit); row.querySelector('.budget-line-total').textContent = money(row.dataset.total); updateBudgetTotal(); }
function budgetSummary() { const subtotal = [...document.querySelectorAll('#budget-items tr')].reduce((sum, row) => sum + Number(row.dataset.total || 0), 0); const percentage = numberValue(value('orc-desconto') || 0); const discount = subtotal * (Math.min(100, Math.max(0, percentage)) / 100); return { subtotal, percentage, discount, total: subtotal - discount }; }
function updateBudgetTotal() { const { subtotal, percentage, discount, total } = budgetSummary(); document.getElementById('orc-subtotal').textContent = money(subtotal); document.getElementById('orc-discount-rate').textContent = `${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; document.getElementById('orc-discount-value').textContent = money(discount); document.getElementById('orc-total').textContent = money(total); }

async function saveBudget() {
  const clienteId = value('orc-cliente'), data = value('orc-data'), validade = value('orc-validade');
  const items = [...document.querySelectorAll('#budget-items tr')].map(row => { const option = row.querySelector('.budget-product').selectedOptions[0]; return { produtoid: Number(option?.value), produtodesc: option?.textContent, qt_produto: Number(row.querySelector('.budget-quantity').value), vl_unitario: Number(option?.dataset.price), vl_total: Number(row.dataset.total) }; });
  if (!clienteId || !data || !validade || !items.length || items.some(item => !item.produtoid || item.qt_produto <= 0)) return showMessage('Informe cliente, datas e ao menos um produto com quantidade válida.');
  const { percentage, total } = budgetSummary();
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return showMessage('Informe um desconto entre 0% e 100%.');
  const { data: budget, error: budgetError } = await supabase.from(DB.orcamentos).insert({ clienteid: Number(clienteId), dt_orcamento: data, dt_validade_orcamento: validade, vl_total_orcamento: total }).select('orcamentoid').single();
  if (budgetError) return showSaveError('Não foi possível criar o orçamento.', budgetError);
  const { error: itemError } = await supabase.from(DB.itensOrcamento).insert(items.map(item => ({ ...item, orcamentoid: budget.orcamentoid })));
  if (itemError) return showSaveError('O orçamento foi criado, mas não foi possível salvar os itens.', itemError);
  bootstrap.Modal.getInstance(document.getElementById('orcamentoModal'))?.hide(); showMessage('Orçamento cadastrado com sucesso.', 'success'); loadRecords();
}

async function saveRecord() {
  let table, payload;
  if (page === 'clientes') { const nome = value('cliente-nome'), documento = value('cliente-doc'), tipo = value('cliente-tipo'); if (!nome || !documento || !tipo) return showMessage('Preencha nome, CPF/CNPJ e tipo de cliente.'); table = DB.clientes; payload = { nome_cliente: nome, cpf_cnpj_cliente: documento, tipo_cliente: tipo }; }
  else if (page === 'categorias') { const nome = value('categoria-nome'); if (!nome) return showMessage('Preencha o nome da categoria.'); table = DB.categorias; payload = { ds_categoria_produto: nome }; }
  else if (page === 'produtos') { const nome = value('produto-nome'), categoria = value('produto-categoria'), preco = numberValue(value('produto-venda')); if (!nome || !categoria || !Number.isFinite(preco)) return showMessage('Preencha produto, categoria e preço de venda.'); table = DB.produtos; payload = { ds_produto: nome, categoriaprodutoid: Number(categoria), obs_produto: value('produto-descricao') || null, vl_venda_produto: preco, dt_cadastro_produto: value('produto-data') || new Date().toISOString().slice(0, 10), status_produto: value('produto-status') || null }; }
  else if (page === 'usuarios') return saveUser(); else return;
  const { error } = await supabase.from(table).insert(payload);
  if (error) return showSaveError('Não foi possível cadastrar o registro.', error);
  bootstrap.Modal.getInstance(document.querySelector('.modal'))?.hide(); document.querySelector('.modal form')?.reset(); showMessage('Registro cadastrado com sucesso.', 'success'); loadRecords();
}
async function saveUser() {
  const nome = value('usuario-nome'), nomeCompleto = value('usuario-nome-completo'), senha = value('usuario-senha'), confirmacao = value('usuario-confirmacao');
  if (!nome || !nomeCompleto || !senha || !confirmacao) return showMessage('Preencha todos os campos do cadastro.');
  if (senha !== confirmacao) return showMessage('As senhas não coincidem.');
  const { error } = await supabase.from(DB.usuarios).insert({ usuario, nome_completo: nomeCompleto, senha });
  if (error) return showSaveError('Não foi possível cadastrar o usuário.', error);
  bootstrap.Modal.getInstance(document.querySelector('.modal'))?.hide(); document.querySelector('.modal form')?.reset();
  showMessage('Usuário cadastrado com sucesso.', 'success');
}
function removeUserListing() { document.querySelector('[data-search]')?.closest('.mb-3')?.remove(); document.querySelector('[data-records]')?.closest('section')?.remove(); }
function bindEvents() { document.addEventListener('click', event => { if (event.target.dataset.delete) deleteRecord(event.target.dataset.delete); }); document.querySelector('[data-save]')?.addEventListener('click', () => page === 'orcamentos' ? saveBudget() : saveRecord()); document.querySelector('[data-add-item]')?.addEventListener('click', addBudgetItem); document.querySelector('[data-search]')?.addEventListener('input', event => loadRecords(event.target.value)); document.getElementById('orc-desconto')?.addEventListener('input', updateBudgetTotal); }
async function init() { if (!await requireAuth()) return; initNav(); if (page === 'usuarios') removeUserListing(); bindEvents(); if (page === 'produtos') loadCategories(); if (page === 'orcamentos') loadBudgetOptions(); if (DB[page] && page !== 'usuarios') loadRecords(); }
init();
