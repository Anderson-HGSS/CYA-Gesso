const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let produtoEmEdicao = null;
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

const dataFormatada = (v) =>
    v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';

const numero = (v) => {
    const texto = String(v).replace(/[^0-9,.-]/g, '');
    return Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
};

function aplicarMascaraMoeda(campo) { const centavos = campo.value.replace(/\D/g, ''); campo.value = (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function renderizarPaginacaoProdutos(total) { let navegacao = document.getElementById('paginacao-produtos'); if (!navegacao) { navegacao = document.createElement('nav'); navegacao.id = 'paginacao-produtos'; navegacao.className = 'mt-3'; document.querySelector('[data-records]').closest('section').after(navegacao); } const paginas = Math.ceil(total / REGISTROS_POR_PAGINA); if (paginaAtual > paginas) paginaAtual = Math.max(1, paginas); navegacao.innerHTML = paginas > 1 ? `<ul class="pagination justify-content-end mb-0">${Array.from({ length: paginas }, (_, i) => `<li class="page-item ${paginaAtual === i + 1 ? 'active' : ''}"><button class="page-link" data-pagina-produto="${i + 1}">${i + 1}</button></li>`).join('')}</ul>` : ''; }

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

async function carregarCategorias() {
    const { data, error } = await supabase
        .from('categoria_produto')
        .select('categoriaprodutoid, ds_categoria_produto')
        .order('ds_categoria_produto');

    if (error) return mostrarErroBanco('Não foi possível carregar as categorias.', error);

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
    if (error) return mostrarErroBanco('Não foi possível carregar os produtos.', error);

    const nomes = new Map((categorias || []).map((c) => [c.categoriaprodutoid, c.ds_categoria_produto]));

    document.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'registro' : 'registros'}`;

    renderizarPaginacaoProdutos(data.length);
    const produtosDaPagina = data.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA);
    document.querySelector('[data-records]').innerHTML = data.length
        ? produtosDaPagina.map((p) =>
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
        status_produto
    };

    const consulta = produtoEmEdicao
        ? supabase.from('produto').update(dados).eq('produtoid', produtoEmEdicao)
        : supabase.from('produto').insert({ ...dados, dt_cadastro_produto: new Date().toISOString().slice(0, 10) });

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
    document.getElementById('produto-venda').value = moeda(data.vl_venda_produto);
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

    document.querySelector('[data-search]').addEventListener('input', (e) => { paginaAtual = 1; carregarProdutos(e.target.value); });
    document.querySelector('[data-save]').addEventListener('click', cadastrarProduto);
    document.getElementById('produto-venda').addEventListener('input', (e) => aplicarMascaraMoeda(e.target));

    document.addEventListener('click', (e) => {
        if (e.target.dataset.edit) editarProduto(e.target.dataset.edit);
        if (e.target.dataset.delete) excluirProduto(e.target.dataset.delete);
        if (e.target.dataset.paginaProduto) { paginaAtual = Number(e.target.dataset.paginaProduto); carregarProdutos(document.querySelector('[data-search]').value); }
    });

    document.getElementById('produtoModal').addEventListener('hidden.bs.modal', () => {
        produtoEmEdicao = null;
        document.querySelector('#produtoModal form').reset();
        document.getElementById('produto-status').value = 'Ativo';
        document.querySelector('#produtoModal .modal-title').textContent = 'Novo produto';
    });
}
