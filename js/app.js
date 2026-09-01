import { supabase } from './supabase.js';
import { DB } from './config.js';
import { requireAuth, logout, showMessage } from './auth.js';

const page = document.documentElement.dataset.page;
const f = DB.fields;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);

function initNav() {
  document.querySelectorAll('.navbar-brand span').forEach(el => el.textContent = 'CYA GESSO');
  document.querySelectorAll('[data-action="logout"]').forEach(el => el.addEventListener('click', logout));
}

function initChoicePage() {
  const main = document.querySelector('main .container'); if (!main) return;
  const header = main.querySelector('.page-header'); const existingButton = header?.querySelector('.btn');
  const content = [...main.children].filter(el => el !== header);
  content.forEach(el => el.hidden = true); if (existingButton) existingButton.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'surface-card action-panel';
  panel.innerHTML = '<h2 class="section-heading mb-3">O que você deseja fazer?</h2><div class="d-flex flex-wrap gap-2"><button class="btn btn-primary" data-choice="search">Pesquisar</button><button class="btn btn-outline-primary" data-choice="create">Cadastrar</button><a class="btn btn-light" href="../menu.html">Voltar ao Menu</a></div>';
  header.after(panel);
  panel.querySelector('[data-choice="search"]').onclick = () => { content.forEach(el => el.hidden = false); panel.hidden = true; loadRecords(); };
  panel.querySelector('[data-choice="create"]').onclick = () => { const modal = document.querySelector('.modal'); if (modal) bootstrap.Modal.getOrCreateInstance(modal).show(); };
}

async function loadRecords(search = '') {
  const table = DB[page]; const fields = f[page.slice(0, -1)] || f[page];
  if (!table || !fields) return;
  let query = supabase.from(table).select('*').limit(100);
  const searchField = page === 'clientes' ? fields.nome : page === 'categorias' ? fields.descricao : page === 'produtos' ? fields.descricao : fields.id;
  if (search) query = query.ilike(searchField, `%${search}%`);
  const { data, error } = await query;
  if (error) return showMessage(`Não foi possível consultar registros: ${error.message}`);
  const tbody = document.querySelector('tbody'); if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(row => rowHtml(row, fields)).join('') : '<tr><td colspan="8" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>';
}

function rowHtml(row, fields) {
  const id = esc(row[fields.id]);
  const title = esc(row[fields.nome] || row[fields.descricao] || id);
  const detail = esc(row[fields.documento] || row[fields.observacao] || row[fields.data] || '');
  const status = esc(row[fields.status] || '');
  return `<tr><td>${id}</td><td><strong>${title}</strong></td><td>${detail}</td><td><span class="status-badge status-active">${status}</span></td><td class="text-end"><button class="action-button border-0 bg-transparent" data-view="${id}">Visualizar</button><button class="action-button text-danger border-0 bg-transparent" data-delete="${id}">Excluir</button></td></tr>`;
}

async function deleteRecord(id) {
  if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
  const fields = f[page.slice(0, -1)] || f[page];
  const { error } = await supabase.from(DB[page]).delete().eq(fields.id, id);
  if (error) return showMessage(`Não foi possível excluir: ${error.message}`);
  showMessage('Registro excluído com sucesso.', 'success'); loadRecords();
}

export async function getClientWithBudgets(clienteId) {
  const { cliente, orcamento } = f;
  const [{ data: client, error: clientError }, { data: budgets, error: budgetError }] = await Promise.all([
    supabase.from(DB.clientes).select('*').eq(cliente.id, clienteId).single(),
    supabase.from(DB.orcamentos).select('*').eq(orcamento.clienteId, clienteId).order(orcamento.data, { ascending: false })
  ]);
  if (clientError || budgetError) throw new Error(clientError?.message || budgetError?.message);
  return { client, budgets };
}

export async function getBudgetWithItems(orcamentoId) {
  const { orcamento, item } = f;
  const [{ data: budget, error: budgetError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from(DB.orcamentos).select('*').eq(orcamento.id, orcamentoId).single(),
    supabase.from(DB.itensOrcamento).select('*').eq(item.orcamentoId, orcamentoId)
  ]);
  if (budgetError || itemsError) throw new Error(budgetError?.message || itemsError?.message);
  return { budget, items };
}

export function calculateBudgetTotal(items) {
  return items.reduce((total, current) => total + Number(current.quantidade) * Number(current.valorUnitario), 0);
}

// Recebe itens já selecionados pela interface. IDs de orçamento e item nunca são enviados:
// ambos são gerados pelo banco, e o ORCAMENTOID retornado é usado somente como FK dos itens.
export async function createBudget({ clienteId, data, validade, items }) {
  if (!clienteId || !data || !validade || !items?.length) throw new Error('Informe cliente, datas e ao menos um item.');
  const { orcamento, item } = f;
  const normalizedItems = items.map(current => ({
    produtoId: Number(current.produtoId),
    produtoDescricao: current.produtoDescricao,
    quantidade: Number(current.quantidade),
    valorUnitario: Number(current.valorUnitario),
    valorTotal: Number(current.quantidade) * Number(current.valorUnitario)
  }));
  if (normalizedItems.some(current => !current.produtoId || current.quantidade <= 0 || current.valorUnitario < 0)) throw new Error('Itens do orçamento inválidos.');
  const total = normalizedItems.reduce((sum, current) => sum + current.valorTotal, 0);
  const { data: budget, error: budgetError } = await supabase.from(DB.orcamentos).insert({
    [orcamento.clienteId]: Number(clienteId),
    [orcamento.data]: data,
    [orcamento.validade]: validade,
    [orcamento.total]: total
  }).select().single();
  if (budgetError) throw new Error(budgetError.message);
  const itemRows = normalizedItems.map(current => ({
    [item.orcamentoId]: budget[orcamento.id],
    [item.produtoId]: current.produtoId,
    [item.produtoDescricao]: current.produtoDescricao,
    [item.quantidade]: current.quantidade,
    [item.valorUnitario]: current.valorUnitario,
    [item.valorTotal]: current.valorTotal
  }));
  const { error: itemError } = await supabase.from(DB.itensOrcamento).insert(itemRows);
  if (itemError) throw new Error(itemError.message);
  return budget;
}

function bindCrud() {
  document.addEventListener('click', event => { const id = event.target.dataset.delete; if (id) deleteRecord(id); });
  document.querySelectorAll('tbody').forEach(body => body.addEventListener('click', event => { if (event.target.dataset.view) showMessage('A visualização detalhada depende dos campos e relacionamentos configurados no Supabase.', 'info'); }));
}

function value(id) { return document.getElementById(id)?.value.trim() || null; }

async function loadProductCategories() {
  const select = document.getElementById('produto-categoria');
  if (!select) return;
  const cf = f.categoria;
  const { data, error } = await supabase.from(DB.categorias).select(`${cf.id}, ${cf.descricao}`).order(cf.descricao);
  if (error) return showMessage(`Não foi possível carregar categorias: ${error.message}`);
  select.innerHTML = '<option value="">Selecione uma categoria</option>' + data.map(category => `<option value="${category[cf.id]}">${esc(category[cf.descricao])}</option>`).join('');
}

function bindForms() {
  const save = document.querySelector('.modal-footer .btn-primary');
  if (!save || !['clientes', 'categorias', 'produtos'].includes(page)) return;
  save.addEventListener('click', async () => {
    const fields = f[page.slice(0, -1)];
    let payload;
    if (page === 'clientes') {
      const nome = value('cliente-nome');
      const documento = value('cliente-doc');
      if (!nome || !documento) return showMessage('Preencha nome e CPF/CNPJ do cliente.');
      const digitos = documento.replace(/\D/g, '');
      payload = { [fields.tipo]: digitos.length > 11 ? 'J' : 'F', [fields.documento]: documento, [fields.nome]: nome };
    } else if (page === 'categorias') {
      const nome = value('categoria-nome');
      if (!nome) return showMessage('Preencha o nome da categoria.');
      payload = { [fields.descricao]: nome };
    } else {
      const nome = value('produto-nome');
      const categoriaId = value('produto-categoria');
      const venda = Number(String(value('produto-venda') || '').replace(',', '.').replace(/[^0-9.]/g, ''));
      if (!nome || !categoriaId || !Number.isFinite(venda)) return showMessage('Preencha produto, categoria e preço de venda.');
      payload = { [fields.categoriaId]: Number(categoriaId), [fields.descricao]: nome, [fields.observacao]: value('produto-descricao'), [fields.valorVenda]: venda, [fields.dataCadastro]: new Date().toISOString(), [fields.status]: value('produto-status') || 'ATIVO' };
    }
    Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);
    save.disabled = true;
    const { error } = await supabase.from(DB[page]).insert(payload);
    save.disabled = false;
    if (error) return showMessage(`Não foi possível cadastrar: ${error.message}`);
    bootstrap.Modal.getInstance(document.querySelector('.modal'))?.hide();
    showMessage('Registro cadastrado com sucesso.', 'success');
    document.querySelector('.modal form')?.reset();
  });
}

async function initInternal() {
  await requireAuth(); initNav(); bindCrud(); bindForms();
  if (['clientes', 'categorias', 'produtos'].includes(page)) initChoicePage();
  if (page === 'produtos') loadProductCategories();
  if (page === 'orcamentos') loadRecords();
}
initInternal();
