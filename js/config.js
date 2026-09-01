// Preencha somente estes valores com a URL e a anon/public key do projeto Supabase.
export const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';

// Nomes reais do banco existente. Não são usados para criar ou alterar tabelas.
export const DB = {
  usuarios: 'USUARIOS',
  clientes: 'CLIENTE',
  categorias: 'CATEGORIA_PRODUTO',
  produtos: 'PRODUTO',
  orcamentos: 'ORCAMENTO',
  itensOrcamento: 'ORCAMENTO_ITEM',
  fields: {
    cliente: { id: 'CLIENTEID', tipo: 'TIPO_CLIENTE', documento: 'CPF_CNPJ_CLIENTE', nome: 'NOME_CLIENTE' },
    categoria: { id: 'CATEGORIAPRODUTOID', descricao: 'DS_CATEGORIA_PRODUTO' },
    produto: { id: 'PRODUTOID', categoriaId: 'CATEGORIAPRODUTOID', descricao: 'DS_PRODUTO', observacao: 'OBS_PRODUTO', valorVenda: 'VL_VENDA_PRODUTO', dataCadastro: 'DT_CADASTRO_PRODUTO', status: 'STATUS_PRODUTO' },
    orcamento: { id: 'ORCAMENTOID', clienteId: 'CLIENTEID', data: 'DT_ORCAMENTO', validade: 'DT_VALIDADE_ORCAMENTO', total: 'VL_TOTAL_ORCAMENTO' },
    item: { orcamentoId: 'ORCAMENTOID', id: 'ORCAMENTOITEMID', produtoId: 'PRODUTOID', produtoDescricao: 'PRODUTODESC', quantidade: 'QT_PRODUTO', valorUnitario: 'VL_UNITARIO', valorTotal: 'VL_TOTAL' }
  }
};
