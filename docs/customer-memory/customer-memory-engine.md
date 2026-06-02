# Customer Memory Engine

## Validação em runners padrão

O módulo `customer-memory` é protegido pelos runners padrão do monorepo para evitar regressão silenciosa antes de iniciar o WhatsApp Conversation Store.

### `test:web`

O runner web agora inclui:

- `apps/web/src/modules/customer-memory/customer-memory.page.dom.test.js`
- `apps/web/src/modules/customer-memory/customer-memory.routes.smoke.test.js`

Esses testes protegem:

- render da rota `#/customer-memory/:clienteId`
- render dos cards da memória
- render do resumo
- estado `loading`
- estado `error`
- estado `empty`
- rota smoke
- ausência de envio de `account_id`
- ausência de envio de `tenant_id`
- ausência de envio de `owner_user_id`

### `test:api`

O runner API agora inclui:

- `apps/api/src/testing/tests/customer-memory.test.js`
- índice padrão em `apps/api/src/testing/tests/index.js`

Cobertura mínima protegida:

- build memória
- scoring
- rebuild
- tenant isolation
- cliente sem pedidos
- cliente com histórico

### `test:all`

Como `test:all` executa `test:api` e `test:web`, o módulo passa a ser coberto pelos dois conjuntos de testes sem depender de descoberta implícita.

### `quality`

O runner `quality` cobre o módulo via:

- `check`
- `test:web`
- `test:api`
- `test:all`

### `check`

O `check` foi atualizado para incluir os arquivos novos do módulo:

- `apps/api/src/modules/customer-memory/*.js`
- `apps/web/src/modules/customer-memory/*.js`

Arquivos explicitamente protegidos:

- `apps/web/src/modules/customer-memory/customer-memory.page.js`
- `apps/web/src/modules/customer-memory/customer-memory.service.js`
- `apps/web/src/modules/customer-memory/customer-memory.mapper.js`
- `apps/web/src/modules/customer-memory/customer-memory.state.js`
- `apps/web/src/modules/customer-memory/customer-memory.page.dom.test.js`
- `apps/web/src/modules/customer-memory/customer-memory.routes.smoke.test.js`
- `apps/api/src/modules/customer-memory/customer-memory.routes.js`
- `apps/api/src/modules/customer-memory/customer-memory.controller.js`
- `apps/api/src/modules/customer-memory/customer-memory.builder.js`
- `apps/api/src/modules/customer-memory/customer-memory.repository.js`
- `apps/api/src/modules/customer-memory/customer-memory.scoring.js`
- `apps/api/src/modules/customer-memory/customer-memory.module.js`
