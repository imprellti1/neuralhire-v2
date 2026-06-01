# Contrato de Modulos

## defineModule
Use `defineModule({ name, domain, version, routes, dependencies })` para declarar metadata oficial de cada modulo.

## Registro de modulo
- Declarar modulo em `modules/index.js` dentro de `registeredModules`.
- Cada modulo deve expor nome, dominio e rotas.

## Registro de rotas
- Preferir `router.registerRoute({...})` para incluir dominio, schema e middlewares.
- Compatibilidade mantida com `router.get` e `router.post`.

## Schema por rota
- Rotas com body podem declarar `schema`.
- `context.body` recebe payload validado.

## Domain por rota
- Toda rota registrada deve informar `domain` para rastreabilidade.

## Padrao para modulos futuros
- Pasta propria por modulo em `modules/<nome>`.
- Separar `*.routes.js` de `*.controller.js`.
- Declarar modulo em `registeredModules` antes de expor rotas.
