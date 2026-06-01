# NeuralHire v2

NeuralHire v2 e uma reconstrucao modular e limpa do sistema, mantendo o legado somente leitura para consulta arquitetural.

## Premissa critica
- O projeto legado permanece intacto e em modo somente leitura.
- Nao ha copia cega de logica do legado nesta etapa.

## Monorepo
- `apps/api`: API Node modular (bootstrap inicial)
- `apps/web`: app web placeholder (bootstrap inicial)
- `apps/workers`: workers e filas placeholder
- `packages/shared`: constantes e utilitarios compartilhados
- `packages/database`: estrutura Supabase (migrations/seeds)

## Comandos basicos
- `npm install`
- `npm run dev:api`
- `npm run dev:web`
- `npm run dev:workers`
- `npm run check`
- `npm run docs:scan`
- `npm run docs:plan`

## Status atual
Bootstrap arquitetural inicial concluido.
