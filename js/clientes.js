const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SESSION_KEY = 'cyaGessoUsuarioLogado';
let clienteEmEdicao = null;
let paginaAtual = 1;
const REGISTROS_POR_PAGINA = 4;

const esc = (valor) => 
  String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ 
    '&': '&amp;', 
    '<': '&lt;', 
    '>': '&gt;', 
    '"': '&quot;', 
    "'": '&#039;' 
  })[caractere]);

function verificarSessao() { 
  if (!sessionStorage.getItem(SESSION_KEY)) { 
    window.location.replace('../index.html'); 
    return false; 
  } 
  return true; 
}

function mostrarMensagem(texto, tipo = 'danger') { 
  let alerta = document.getElementById('app-alert'); 
  if (!alerta) { 
    alerta = document.createElement('div'); 
    alerta.id = 'app-alert'; 
    document.body.append(alerta); 
  } 
  alerta.className = `alert alert-${tipo} alert-dismissible fade show app-alert`; 
  alerta.innerHTML = `${texto}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`; 
}

function mostrarErroBanco(contexto, erro) {
  const detalhes = [erro?.message, erro?.details, erro?.hint].filter(Boolean).join(' ');
  console.error(contexto, erro);
  mostrarMensagem(`${contexto} Detalhes: ${detalhes || 'erro sem detalhes retornados.'}`);
}

function configurarSaida() { 
  document.querySelector('[data-action="logout"]')?.addEventListener('click', (evento) => { 
    evento.preventDefault(); 
    sessionStorage.removeItem(SESSION_KEY); 
    window.location.replace('../index.html'); 
  }); 
}

function atualizarContagem(total) { 
  document.querySelector('[data-record-count]').textContent = `${total} ${total === 1 ? 'registro' : 'registros'}`; 
}

function aplicarMascaraCpfCnpj(campo) {
  const tipoCliente = document.getElementById('cliente-tipo').value;
  const numeros = campo.value.replace(/\D/g, '').slice(0, tipoCliente === 'J' ? 14 : 11);
  campo.value = tipoCliente === 'J'
    ? numeros.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    : numeros.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function renderizarPaginacaoClientes(total) {
  let navegacao = document.getElementById('paginacao-clientes');
  if (!navegacao) { navegacao = document.createElement('nav'); navegacao.id = 'paginacao-clientes'; navegacao.className = 'mt-3'; document.querySelector('[data-records]').closest('section').after(navegacao); }
  const paginas = Math.ceil(total / REGISTROS_POR_PAGINA);
  if (paginaAtual > paginas) paginaAtual = Math.max(1, paginas);
  navegacao.innerHTML = paginas > 1 ? `<ul class="pagination justify-content-end mb-0">${Array.from({ length: paginas }, (_, i) => `<li class="page-item ${paginaAtual === i + 1 ? 'active' : ''}"><button class="page-link" data-pagina-cliente="${i + 1}">${i + 1}</button></li>`).join('')}</ul>` : '';
}

async function carregarClientes(pesquisa = '') {
  let consulta = supabase
    .from('cliente')
    .select('*')
    .order('clienteid', { ascending: false })
    .limit(100);

  if (pesquisa.trim()) {
    consulta = consulta.or(`nome_cliente.ilike.%${pesquisa.trim()}%,cpf_cnpj_cliente.ilike.%${pesquisa.trim()}%`);
  }

  const { data, error } = await consulta;
  const corpo = document.querySelector('[data-records]');

  if (error) { 
    corpo.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Não foi possível realizar a pesquisa.</td></tr>'; 
    return mostrarErroBanco('Não foi possível carregar os clientes.', error); 
  }

  atualizarContagem(data.length);

  renderizarPaginacaoClientes(data.length);
  const clientesDaPagina = data.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA);
  corpo.innerHTML = data.length 
    ? clientesDaPagina.map((cliente) => 
        `<tr>` +
          `<td>${esc(cliente.clienteid)}</td>` +
          `<td><strong>${esc(cliente.nome_cliente)}</strong></td>` +
          `<td>${esc(cliente.tipo_cliente)}</td>` +
          `<td>${esc(cliente.cpf_cnpj_cliente)}</td>` +
          `<td class="text-end">` +
            `<button class="action-button border-0 bg-transparent" data-edit="${cliente.clienteid}">Editar</button>` +
            `<button class="action-button text-danger border-0 bg-transparent" data-delete="${cliente.clienteid}">Excluir</button>` +
          `</td>` +
        `</tr>`
      ).join('') 
    : '<tr><td colspan="5" class="text-center text-secondary py-4">Nenhum registro encontrado.</td></tr>';
}

async function cadastrarCliente() {
  const nome_cliente = document.getElementById('cliente-nome').value.trim(); 
  const tipo_cliente = document.getElementById('cliente-tipo').value; 
  const cpf_cnpj_cliente = document.getElementById('cliente-doc').value.trim();

  if (!nome_cliente || !tipo_cliente || !cpf_cnpj_cliente) {
    return mostrarMensagem('Preencha nome, CPF/CNPJ e tipo de cliente.');
  }

  const tamanhoEsperado = tipo_cliente === 'F' ? 11 : 14;
  if (cpf_cnpj_cliente.replace(/\D/g, '').length !== tamanhoEsperado) {
    return mostrarMensagem(tipo_cliente === 'F' ? 'Informe um CPF com 11 dígitos.' : 'Informe um CNPJ com 14 dígitos.');
  }

  const dados = { nome_cliente, tipo_cliente, cpf_cnpj_cliente };
  const consulta = clienteEmEdicao 
    ? supabase.from('cliente').update(dados).eq('clienteid', clienteEmEdicao) 
    : supabase.from('cliente').insert(dados);

  const { error } = await consulta;

  if (error) return mostrarMensagem('Não foi possível salvar o cliente.');

  bootstrap.Modal.getInstance(document.getElementById('clienteModal'))?.hide(); 
  document.querySelector('#clienteModal form').reset(); 
  clienteEmEdicao = null; 
  mostrarMensagem('Cliente salvo com sucesso.', 'success'); 
  carregarClientes(document.querySelector('[data-search]').value);
}

async function editarCliente(id) { 
  const { data, error } = await supabase.from('cliente').select('*').eq('clienteid', id).single(); 
  if (error) return mostrarMensagem('Não foi possível carregar o cliente.'); 

  clienteEmEdicao = data.clienteid; 
  document.getElementById('cliente-nome').value = data.nome_cliente || ''; 
  document.getElementById('cliente-tipo').value = data.tipo_cliente || ''; 
  document.getElementById('cliente-doc').value = data.cpf_cnpj_cliente || ''; aplicarMascaraCpfCnpj(document.getElementById('cliente-doc'));
  document.querySelector('#clienteModal .modal-title').textContent = 'Editar cliente'; 
  bootstrap.Modal.getOrCreateInstance(document.getElementById('clienteModal')).show(); 
}

async function excluirCliente(id) { 
  if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return; 

  const { error } = await supabase.from('cliente').delete().eq('clienteid', id); 
  if (error) return mostrarMensagem('Não foi possível excluir o cliente.'); 

  mostrarMensagem('Cliente excluído com sucesso.', 'success'); 
  carregarClientes(document.querySelector('[data-search]').value); 
}

if (verificarSessao()) { 
  configurarSaida(); 
  carregarClientes(); 

  document.querySelector('[data-search]').addEventListener('input', (evento) => { paginaAtual = 1; carregarClientes(evento.target.value); }); 
  document.querySelector('[data-save]').addEventListener('click', cadastrarCliente); 
  document.getElementById('cliente-doc').addEventListener('input', (evento) => aplicarMascaraCpfCnpj(evento.target));
  document.getElementById('cliente-tipo').addEventListener('change', () => aplicarMascaraCpfCnpj(document.getElementById('cliente-doc')));

  document.addEventListener('click', (evento) => { 
    if (evento.target.dataset.edit) editarCliente(evento.target.dataset.edit); 
    if (evento.target.dataset.delete) excluirCliente(evento.target.dataset.delete); 
    if (evento.target.dataset.paginaCliente) { paginaAtual = Number(evento.target.dataset.paginaCliente); carregarClientes(document.querySelector('[data-search]').value); }
  }); 

  document.getElementById('clienteModal').addEventListener('hidden.bs.modal', () => { 
    clienteEmEdicao = null; 
    document.querySelector('#clienteModal form').reset(); 
    document.querySelector('#clienteModal .modal-title').textContent = 'Novo cliente'; 
  }); 
}
