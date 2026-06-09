const DEFAULT_DATE_CREATED = '2026-05-01T00:00:00.000Z';
const DEFAULT_DATE_UPDATED = '2026-05-02T00:00:00.000Z';

export function makeProduto(overrides = {}) {
  return {
    id: 'p1',
    nome: 'Produto A',
    sku: 'S1',
    categoria: 'Cat',
    preco: 10,
    multiplo_venda: 1,
    status: 'ativo',
    descricao: 'Produto de teste',
    created_at: DEFAULT_DATE_CREATED,
    updated_at: DEFAULT_DATE_UPDATED,
    ...overrides
  };
}

export function makeCliente(overrides = {}) {
  return {
    id: 'c1',
    empresa: 'Cliente A',
    razao_social: 'Cliente A LTDA',
    nome_contato: 'Ana',
    telefone: '11',
    cidade: 'Sao Paulo',
    estado: 'SP',
    status: 'ativo',
    ativo: true,
    created_at: DEFAULT_DATE_CREATED,
    updated_at: DEFAULT_DATE_UPDATED,
    ...overrides
  };
}

export function makePedidoItem(overrides = {}) {
  return {
    produto_id: 'p1',
    produto_nome: 'Produto A',
    quantidade: 2,
    preco_unitario: 10,
    desconto: 0,
    total: 20,
    ...overrides
  };
}

export function makePedido(overrides = {}) {
  return {
    id: 'ped1',
    numero: 'PED-1',
    cliente_id: 'c1',
    cliente_nome: 'Cliente A',
    status: 'aprovado',
    origem: 'manual',
    subtotal: 100,
    desconto: 0,
    total: 100,
    itens: [makePedidoItem()],
    created_at: DEFAULT_DATE_CREATED,
    updated_at: DEFAULT_DATE_UPDATED,
    request_id: 'req-ped1',
    ...overrides
  };
}
