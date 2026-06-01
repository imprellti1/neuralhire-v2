# decisoes-arquiteturais

- Estrutura preferencial: app modular (ou monorepo modular) com fronteiras claras por dominio.
- Backend separado do frontend para desacoplamento operacional.
- Frontend separado com contratos de API versionados.
- Dominio isolado por responsabilidade de negocio.
- Evitar server.js monolitico; usar bootstrap + modulos.
- Modules por responsabilidade, sem mistura de UI, regra e infraestrutura.
- Migrations com GRANT explicito para authenticated e service_role.
- Legado como fonte de consulta, nao como base cega.
- IA comercial como dominio proprio.
- WhatsApp/worker/fila como dominio proprio.
- Scanner como ferramenta permanente.
