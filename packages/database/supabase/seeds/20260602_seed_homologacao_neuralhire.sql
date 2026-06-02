-- NeuralHire v2
-- Seed seguro para homologacao com Supabase real.
-- Requisitos:
-- - criar/confirmar o usuario no Supabase Auth pelo painel
-- - definir o GUC neuralhire.homologacao_auth_user_id na mesma sessao antes de executar este script
--   exemplo:
--   select set_config('neuralhire.homologacao_auth_user_id', '00000000-0000-0000-0000-000000000000', false);

do $$
declare
  v_account_id uuid := '7b8d9d4f-7c67-4a3f-8c85-5f6d5df1a114';
  v_auth_user_id uuid := nullif(current_setting('neuralhire.homologacao_auth_user_id', true), '')::uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Defina neuralhire.homologacao_auth_user_id com o auth.users.id real antes de executar o seed';
  end if;

  insert into public.accounts (id, name, slug, status, created_at, updated_at)
  values (
    v_account_id,
    'NeuralHire Homologação',
    'neuralhire-homologacao',
    'active',
    now(),
    now()
  )
  on conflict (slug) do update
    set name = excluded.name,
        status = excluded.status,
        updated_at = now();

  update public.account_users
     set email = 'homologacao@neuralhire.local',
         nome = 'NeuralHire Homologação',
         role = 'owner',
         updated_at = now()
   where account_id = v_account_id
     and user_id = v_auth_user_id;

  if not exists (
    select 1
      from public.account_users
     where account_id = v_account_id
       and user_id = v_auth_user_id
  ) then
    insert into public.account_users (account_id, user_id, email, nome, role, created_at, updated_at)
    values (
      v_account_id,
      v_auth_user_id,
      'homologacao@neuralhire.local',
      'NeuralHire Homologação',
      'owner',
      now(),
      now()
    );
  end if;

  insert into public.fabricantes (id, account_id, nome, razao_social, cnpj, logo_url, status, pedido_minimo, boleto_minimo, comissao_padrao_percentual, prazo_maximo_dias, observacoes, created_at, updated_at)
  values
    ('11111111-1111-1111-1111-111111111111', v_account_id::text, 'Aurora Componentes', 'Aurora Componentes Industriais Ltda.', null, null, 'ativo', 1500, 0, 4.5, 21, 'Fabricante ficticio para homologacao', now(), now()),
    ('22222222-2222-2222-2222-222222222222', v_account_id::text, 'Atlas Ferragens', 'Atlas Ferragens e Acessorios Ltda.', null, null, 'ativo', 1000, 0, 3.75, 14, 'Fabricante ficticio para homologacao', now(), now()),
    ('33333333-3333-3333-3333-333333333333', v_account_id::text, 'Nexo Materiais', 'Nexo Materiais Industriais Ltda.', null, null, 'ativo', 2000, 0, 5.0, 28, 'Fabricante ficticio para homologacao', now(), now())
  on conflict (id) do update
    set nome = excluded.nome,
        razao_social = excluded.razao_social,
        status = excluded.status,
        pedido_minimo = excluded.pedido_minimo,
        boleto_minimo = excluded.boleto_minimo,
        comissao_padrao_percentual = excluded.comissao_padrao_percentual,
        prazo_maximo_dias = excluded.prazo_maximo_dias,
        observacoes = excluded.observacoes,
        updated_at = now();

  insert into public.produtos (id, account_id, codigo, sku, nome, descricao, categoria, marca, ean, ncm, preco, custo, estoque, unidade, ativo, tags, metadata, created_at, updated_at)
  values
    ('44444444-4444-4444-4444-444444444441', v_account_id, 'NH-1001', 'NH-1001', 'Painel Modular 42U', 'Painel modular ficticio para testes de catalogo.', 'Infraestrutura', 'Aurora Componentes', null, null, 1299.90, 870.00, 18, 'UN', true, array['homologacao','rack'], jsonb_build_object('fabricante_id', '11111111-1111-1111-1111-111111111111'), now(), now()),
    ('44444444-4444-4444-4444-444444444442', v_account_id, 'NH-1002', 'NH-1002', 'Kit Ventilacao Industrial', 'Kit ficticio para validacao de produto e estoque.', 'Acessorios', 'Atlas Ferragens', null, null, 249.50, 160.00, 32, 'UN', true, array['homologacao','kit'], jsonb_build_object('fabricante_id', '22222222-2222-2222-2222-222222222222'), now(), now()),
    ('44444444-4444-4444-4444-444444444443', v_account_id, 'NH-1003', 'NH-1003', 'Sensor de Nivel Pro', 'Sensor ficticio para homologacao de pedidos.', 'Automacao', 'Nexo Materiais', null, null, 399.00, 260.00, 25, 'UN', true, array['homologacao','sensor'], jsonb_build_object('fabricante_id', '33333333-3333-3333-3333-333333333333'), now(), now()),
    ('44444444-4444-4444-4444-444444444444', v_account_id, 'NH-1004', 'NH-1004', 'Mola de Fixacao Premium', 'Item ficticio de consumo recorrente.', 'Fixacao', 'Atlas Ferragens', null, null, 49.90, 20.00, 120, 'UN', true, array['homologacao','consumo'], jsonb_build_object('fabricante_id', '22222222-2222-2222-2222-222222222222'), now(), now()),
    ('44444444-4444-4444-4444-444444444445', v_account_id, 'NH-1005', 'NH-1005', 'Conjunto de Trilhos 2m', 'Produto ficticio para fluxos de selecao e pedido.', 'Estruturas', 'Aurora Componentes', null, null, 780.00, 520.00, 14, 'UN', true, array['homologacao','trilho'], jsonb_build_object('fabricante_id', '11111111-1111-1111-1111-111111111111'), now(), now())
  on conflict (id) do update
    set codigo = excluded.codigo,
        sku = excluded.sku,
        nome = excluded.nome,
        descricao = excluded.descricao,
        categoria = excluded.categoria,
        marca = excluded.marca,
        preco = excluded.preco,
        custo = excluded.custo,
        estoque = excluded.estoque,
        unidade = excluded.unidade,
        ativo = excluded.ativo,
        tags = excluded.tags,
        metadata = excluded.metadata,
        updated_at = now();

  insert into public.clientes (id, account_id, nome, documento, email, telefone, cidade, estado, tags, ativo, metadata, created_at, updated_at)
  values
    ('55555555-5555-5555-5555-555555555551', v_account_id, 'Cliente Horizonte Ltda.', null, 'compras@horizonte.example', '+55 11 99999-1001', 'Sao Paulo', 'SP', array['homologacao','industrial'], true, jsonb_build_object('segmento', 'industrial'), now(), now()),
    ('55555555-5555-5555-5555-555555555552', v_account_id, 'Metalworks Delta S.A.', null, 'suprimentos@delta.example', '+55 19 99999-1002', 'Campinas', 'SP', array['homologacao','distribuidor'], true, jsonb_build_object('segmento', 'distribuidor'), now(), now()),
    ('55555555-5555-5555-5555-555555555553', v_account_id, 'Construtec Vale ME', null, 'pedidos@construtec.example', '+55 21 99999-1003', 'Rio de Janeiro', 'RJ', array['homologacao','obra'], true, jsonb_build_object('segmento', 'construcao'), now(), now())
  on conflict (id) do update
    set nome = excluded.nome,
        documento = excluded.documento,
        email = excluded.email,
        telefone = excluded.telefone,
        cidade = excluded.cidade,
        estado = excluded.estado,
        tags = excluded.tags,
        ativo = excluded.ativo,
        metadata = excluded.metadata,
        updated_at = now();

  insert into public.pedidos (id, account_id, cliente_id, numero, status, origem, observacoes, subtotal, desconto, total, metadata, created_at, updated_at)
  values
    ('66666666-6666-6666-6666-666666666661', v_account_id, '55555555-5555-5555-5555-555555555551', 'NH-0001', 'confirmado', 'manual', 'Pedido ficticio para homologacao', 1549.40, 49.40, 1500.00, jsonb_build_object('canal', 'homologacao'), now(), now()),
    ('66666666-6666-6666-6666-666666666662', v_account_id, '55555555-5555-5555-5555-555555555552', 'NH-0002', 'em_separacao', 'manual', 'Segundo pedido ficticio para testes de tela.', 948.90, 0, 948.90, jsonb_build_object('canal', 'homologacao'), now(), now()),
    ('66666666-6666-6666-6666-666666666663', v_account_id, '55555555-5555-5555-5555-555555555553', 'NH-0003', 'rascunho', 'manual', 'Terceiro pedido ficticio para fluxo de criacao.', 399.00, 0, 399.00, jsonb_build_object('canal', 'homologacao'), now(), now())
  on conflict (id) do update
    set cliente_id = excluded.cliente_id,
        numero = excluded.numero,
        status = excluded.status,
        origem = excluded.origem,
        observacoes = excluded.observacoes,
        subtotal = excluded.subtotal,
        desconto = excluded.desconto,
        total = excluded.total,
        metadata = excluded.metadata,
        updated_at = now();

  insert into public.pedido_itens (id, account_id, pedido_id, produto_id, produto_nome, sku, quantidade, preco_unitario, desconto, subtotal, total, metadata, created_at, updated_at)
  values
    ('77777777-7777-7777-7777-777777777771', v_account_id, '66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441', 'Painel Modular 42U', 'NH-1001', 1, 1299.90, 0, 1299.90, 1299.90, '{}'::jsonb, now(), now()),
    ('77777777-7777-7777-7777-777777777772', v_account_id, '66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444444', 'Mola de Fixacao Premium', 'NH-1004', 5, 49.90, 49.40, 249.50, 200.10, '{}'::jsonb, now(), now()),
    ('77777777-7777-7777-7777-777777777773', v_account_id, '66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444443', 'Sensor de Nivel Pro', 'NH-1003', 2, 399.00, 0, 798.00, 798.00, '{}'::jsonb, now(), now()),
    ('77777777-7777-7777-7777-777777777774', v_account_id, '66666666-6666-6666-6666-666666666663', '44444444-4444-4444-4444-444444444442', 'Kit Ventilacao Industrial', 'NH-1002', 1, 249.50, 0, 249.50, 249.50, '{}'::jsonb, now(), now())
  on conflict (id) do update
    set pedido_id = excluded.pedido_id,
        produto_id = excluded.produto_id,
        produto_nome = excluded.produto_nome,
        sku = excluded.sku,
        quantidade = excluded.quantidade,
        preco_unitario = excluded.preco_unitario,
        desconto = excluded.desconto,
        subtotal = excluded.subtotal,
        total = excluded.total,
        metadata = excluded.metadata,
        updated_at = now();
end $$;
