// Preencha somente estes valores com a URL e a anon/public key do projeto Supabase.
export const SUPABASE_URL = 'https://bymwinebienzvaimiadh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qPjGkoVq70xT2cqCd0jDVw_RJWWxeJg';

// Nomes das tabelas e campos do banco em minúsculo.
export const DB = {
  usuarios: 'usuarios',
  clientes: 'cliente',
  categorias: 'categoria_produto',
  produtos: 'produto',
  orcamentos: 'orcamento',
  itensOrcamento: 'orcamento_item',

  fields: {
    usuarios: {
      id: 'id',
      usuario: 'usuario',
      nomeCompleto: 'nome_completo',
      senha: 'senha'
    },
    cliente: {
      id: 'clienteid',
      tipo: 'tipo_cliente',
      documento: 'cpf_cnpj_cliente',
      nome: 'nome_cliente'
    },

    categoria: {
      id: 'categoriaprodutoid',
      descricao: 'ds_categoria_produto'
    },

    produto: {
      id: 'produtoid',
      categoriaId: 'categoriaprodutoid',
      descricao: 'ds_produto',
      observacao: 'obs_produto',
      valorVenda: 'vl_venda_produto',
      dataCadastro: 'dt_cadastro_produto',
      status: 'status_produto'
    },

    orcamento: {
      id: 'orcamentoid',
      clienteId: 'clienteid',
      data: 'dt_orcamento',
      validade: 'dt_validade_orcamento',
      total: 'vl_total_orcamento'
    },

    item: {
      orcamentoId: 'orcamentoid',
      id: 'orcamentoitemid',
      produtoId: 'produtoid',
      produtoDescricao: 'produtodesc',
      quantidade: 'qt_produto',
      valorUnitario: 'vl_unitario',
      valorTotal: 'vl_total'
    }
  }
};
