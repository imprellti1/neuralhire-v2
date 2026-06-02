# Importacao Legado

Esta etapa prepara a base da v2 com dados reais antes do agente WhatsApp, porque o agente precisa de contexto comercial confiavel para operar com clientes, produtos, pedidos e relacionamento.

## Entidades suportadas

- clientes
- produtos
- pedidos
- pedidoItens
- fabricantes
- vendedores

## Formato esperado

```json
{
  "source": "legacy-admin",
  "dryRun": true,
  "data": {
    "clientes": [],
    "produtos": [],
    "pedidos": [],
    "pedidoItens": [],
    "fabricantes": [],
    "vendedores": []
  }
}
```

## Endpoints

- `GET /legacy-import/status`
- `GET /legacy-import/batches`
- `GET /legacy-import/batches/:batchId`
- `GET /legacy-import/batches/:batchId/records`
- `GET /legacy-import/batches/:batchId/issues`
- `POST /legacy-import/batches/:batchId/promote`
- `POST /legacy-import/preview`
- `POST /legacy-import/validate`
- `POST /legacy-import/execute`

## Validacoes

- bloqueia em producao
- exige role `admin`, `manager` ou `super_admin`
- exige `accountId` no contexto autenticado
- ignora `account_id` vindo do payload
- normaliza CNPJ, UF, status, datas e numeros
- detecta duplicados por chave natural
- nao apaga dados existentes
- nao sobrescreve campos preenchidos sem necessidade
- persiste batches, records e issues apenas no staging

## Auditoria

- cada execucao cria um batch auditavel
- records guardam payload bruto e payload normalizado
- issues guardam severidade e mensagem por registro
- a visualizacao de auditoria permite consultar lotes sem promover dados para as tabelas finais

## Promocao

- veja os detalhes em [legacy-import-promocao.md](./legacy-import-promocao.md)

## Limites atuais

- apenas payload JSON estruturado
- sem leitura de CSV ou XLSX nesta etapa
- persistencia segue o padrao memory/Supabase ja usado no projeto
- nenhuma escrita chega a clientes, produtos, pedidos ou itens finais

## Proximos passos

- aprovar batches com auditoria visual
- adicionar importacao CSV/XLSX
- enriquecer relacoes entre pedidos, itens e clientes
