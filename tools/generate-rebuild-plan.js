const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Meu Computador/Meu Drive/PROGRAMAÇÃO/NEURAL HIRE';
const INVENTORY_PATH = path.join(ROOT, 'docs', 'arquitetura-legado', 'inventario-geral.json');
const OUT_DIR = path.join(ROOT, 'docs', 'plano-reconstrucao-v2');

const DOMAIN_DEFS = {
  'core-platform': ['core', 'router', 'state', 'store', 'utils', 'helper', 'api', 'client', 'supabase', 'middleware', 'server', 'app', 'bootstrap', 'env', 'health', 'config-base'],
  'autenticacao-contas': ['auth', 'login', 'session', 'senha', 'password', 'token', 'jwt', 'account', 'conta', 'tenant', 'cadastro', 'register'],
  'usuarios-permissoes': ['user', 'usuario', 'usuarios', 'role', 'roles', 'permissao', 'permissoes', 'permission', 'admin', 'superadmin', 'vendedor'],
  'clientes-crm': ['cliente', 'clientes', 'customer', 'customers', 'lead', 'leads', 'crm', 'contato', 'contatos', 'carteira', 'prospect'],
  'pedidos-comercial': ['pedido', 'pedidos', 'order', 'orders', 'venda', 'vendas', 'comercial', 'checkout', 'carrinho', 'orcamento', 'orçamento'],
  'produtos-catalogo': ['produto', 'produtos', 'product', 'products', 'catalogo', 'catálogo', 'sku', 'estoque', 'price', 'preco', 'preço', 'item', 'itens'],
  'whatsapp-ia': ['whatsapp', 'evolution', 'message', 'mensagem', 'mensagens', 'queue', 'fila', 'worker', 'webhook-whatsapp', 'wa'],
  'followup-ia': ['followup', 'follow-up', 'follow_up', 'memoria', 'memória', 'dossie', 'dossiê', 'abordagem', 'objeção', 'objecao', 'retomada'],
  'pipeline-comercial': ['pipeline', 'kanban', 'etapa', 'oportunidade', 'funil', 'status-comercial'],
  'inteligencia-externa': ['enriquecimento', 'descoberta', 'serp', 'google', 'maps', 'place', 'website', 'site', 'instagram', 'externo', 'externa', 'digital', 'inteligencia', 'inteligência'],
  'importacoes': ['importacao', 'importações', 'importacoes', 'import', 'csv', 'xlsx', 'excel', 'planilha', 'upload', 'arquivo'],
  'dashboard-bi': ['dashboard', 'metricas', 'métricas', 'bi', 'grafico', 'gráfico', 'chart', 'cards', 'visao-geral', 'visão-geral', 'resumo'],
  'billing-assinaturas': ['billing', 'asaas', 'assinatura', 'assinaturas', 'plano', 'planos', 'pagamento', 'pagamentos', 'cobrança', 'cobranca', 'invoice', 'subscription'],
  'configuracoes': ['configuracao', 'configurações', 'configuracoes', 'settings', 'preferences', 'preferencia', 'parametro', 'parametros'],
  'integracoes': ['integracao', 'integrações', 'integracoes', 'webhook', 'webhooks', 'api-externa', 'external', 'n8n', 'sync'],
  'auditoria-logs': ['log', 'logs', 'auditoria', 'audit', 'events', 'evento', 'eventos', 'tracking', 'historico', 'histórico']
};

const DOMAIN_PRIORITY = [
  'whatsapp-ia', 'followup-ia', 'inteligencia-externa', 'pipeline-comercial', 'clientes-crm', 'pedidos-comercial',
  'produtos-catalogo', 'importacoes', 'billing-assinaturas', 'dashboard-bi', 'autenticacao-contas', 'usuarios-permissoes',
  'integracoes', 'auditoria-logs', 'configuracoes', 'core-platform'
];

const DOMAIN_META = {
  'core-platform': ['Base técnica compartilhada', 'Infra comum, cliente Supabase, roteamento base, utilitarios'],
  'autenticacao-contas': ['Acesso seguro e contas', 'Login, sessao, identidade e ciclo de conta'],
  'usuarios-permissoes': ['Governanca de acesso', 'Perfis, papeis, permissoes e politicas'],
  'clientes-crm': ['Gestao central de clientes', 'Cadastro, perfil e relacionamento CRM'],
  'pedidos-comercial': ['Gestao de pedidos', 'Fluxo comercial de pedidos e status'],
  'produtos-catalogo': ['Catalogo comercial', 'Produtos, atributos e organizacao de oferta'],
  'whatsapp-ia': ['Canal conversacional', 'Integracao WhatsApp, filas e automacoes IA'],
  'followup-ia': ['Orquestracao de follow-up', 'Memoria comercial, lembretes e cadencias IA'],
  'pipeline-comercial': ['Pipeline de vendas', 'Etapas, oportunidades e progressao comercial'],
  'inteligencia-externa': ['Enriquecimento externo', 'SERP, enriquecimento e dados externos'],
  'importacoes': ['Entrada de dados em lote', 'Importacao de CSV/XLSX e validacoes'],
  'dashboard-bi': ['Camada analitica', 'Metricas, indicadores e visualizacao executiva'],
  'billing-assinaturas': ['Monetizacao', 'Planos, assinatura e cobranca'],
  'configuracoes': ['Administracao operacional', 'Parametros, settings e ajustes de sistema'],
  'integracoes': ['Conectividade externa', 'Webhooks e integracoes com servicos terceiros'],
  'auditoria-logs': ['Rastreabilidade e conformidade', 'Logs, trilhas de auditoria e eventos']
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}
function safeReadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function avg(nums) { return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0; }
function esc(v) { return String(v).replace(/\|/g, '/'); }
function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return [head, sep, body].filter(Boolean).join('\n');
}

function mapDomainWithScore(file) {
  const normalizedPath = normalizeText(file.relativePath);
  const fileName = normalizeText(path.basename(file.relativePath || ''));
  const ext = normalizeText(file.extension || '');
  const tags = normalizeText((file.reasons || []).join(' '));
  const rec = normalizeText(file.recommendation || '');
  const source = `${normalizedPath} ${fileName} ${ext} ${tags} ${rec}`;

  const domainScores = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_DEFS)) {
    let score = 0;
    for (const kw of keywords) {
      if (source.includes(normalizeText(kw))) score += 1;
    }
    domainScores[domain] = score;
  }

  let best = null;
  let bestScore = 0;
  for (const d of DOMAIN_PRIORITY) {
    const sc = domainScores[d] || 0;
    if (sc > bestScore) {
      bestScore = sc;
      best = d;
    } else if (sc === bestScore && sc > 0 && best !== d) {
      if (DOMAIN_PRIORITY.indexOf(d) < DOMAIN_PRIORITY.indexOf(best)) best = d;
    }
  }

  return { domain: bestScore > 0 ? best : null, domainScore: bestScore, domainScores };
}

function dominantRecommendation(files) {
  if (!files.length) return 'apenas_consultar';
  const c = {};
  files.forEach((f) => { c[f.recommendation || 'apenas_consultar'] = (c[f.recommendation || 'apenas_consultar'] || 0) + 1; });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
}

function decisionFromAggregate(riskAvg, reuseAvg, dominantRec) {
  if (riskAvg >= 75) return 'reescrever_do_zero';
  if (dominantRec === 'apenas_consultar') return 'apenas_consultar';
  if (reuseAvg >= 70 && riskAvg < 50) return 'copiar_para_novo_modulo';
  if (reuseAvg >= 45) return 'reaproveitar_com_revisao';
  if (riskAvg >= 60) return 'nao_usar';
  return dominantRec || 'apenas_consultar';
}

function generate() {
  if (!fs.existsSync(INVENTORY_PATH)) throw new Error(`Inventario nao encontrado: ${INVENTORY_PATH}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const inv = safeReadJson(INVENTORY_PATH);
  const files = inv.files || [];

  const mapped = files.map((f) => {
    const scores = f.scores || { complexidade: 0, acoplamento: 0, riscoOperacional: 0, reaproveitamento: 0 };
    const recommendation = f.recommendation || 'apenas_consultar';
    const riskLevel = f.riskLevel || 'baixo';
    const map = mapDomainWithScore({ ...f, recommendation });
    return { ...f, scores, recommendation, riskLevel, domain: map.domain, domainScore: map.domainScore, domainScores: map.domainScores };
  });

  const domainBuckets = {};
  Object.keys(DOMAIN_DEFS).forEach((d) => { domainBuckets[d] = []; });
  const noDomain = [];
  for (const f of mapped) {
    if (!f.domain) noDomain.push(f);
    else domainBuckets[f.domain].push(f);
  }

  const domainAgg = Object.keys(DOMAIN_DEFS).map((d) => {
    const list = domainBuckets[d];
    const riskAvg = avg(list.map((f) => f.scores.riscoOperacional));
    const reuseAvg = avg(list.map((f) => f.scores.reaproveitamento));
    const domRec = dominantRecommendation(list);
    return { domain: d, count: list.length, riskAvg: Number(riskAvg.toFixed(1)), reuseAvg: Number(reuseAvg.toFixed(1)), recommendation: domRec, decision: decisionFromAggregate(riskAvg, reuseAvg, domRec), files: list };
  });

  const domainList = domainAgg.filter((d) => d.count > 0).map((d) => d.domain);
  const mappedCount = mapped.length - noDomain.length;
  const coverage = mapped.length ? Number(((mappedCount / mapped.length) * 100).toFixed(2)) : 0;

  const planoGeral = `# plano-geral

## Visao geral da reconstrucao
Reconstrucao do NeuralHire v2 orientada por dominios, usando o legado apenas como referencia analitica para reduzir risco e aumentar previsibilidade.

## Premissas
- Legado em modo somente leitura.
- Sem copia cega de codigo.
- Decisoes guiadas por score (complexidade, acoplamento, risco operacional, reaproveitamento).
- Entregas incrementais por fase e dominio.

## Regra critica
Legado somente leitura: nenhum arquivo do Projeto Representantes deve ser alterado, movido ou removido.

## Estrategia de migracao gradual
1. Estabelecer fundacao tecnica e contratos.
2. Migrar dominios core e dados essenciais.
3. Adicionar IA comercial como dominio independente.
4. Consolidar BI, billing e governanca.
5. Escalar com multi-tenant e integracoes avancadas.

## Ordem recomendada de construcao
${DOMAIN_PRIORITY.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Riscos principais
- Modulos com alto acoplamento e baixa separacao de responsabilidades.
- Jobs/filas/cron misturados com fluxo HTTP.
- Dependencias cruzadas entre dominios comerciais e canais.

## Dominios oficiais da v2
${Object.keys(DOMAIN_DEFS).map((d) => `- ${d}`).join('\n')}
`;

  const dominiosMd = ['# dominios-v2', ''];
  for (const d of domainAgg) {
    const meta = DOMAIN_META[d.domain] || ['Objetivo nao definido', 'Responsabilidade nao definida'];
    dominiosMd.push(`## ${d.domain}`);
    dominiosMd.push(`- objetivo: ${meta[0]}`);
    dominiosMd.push(`- responsabilidade: ${meta[1]}`);
    dominiosMd.push(`- arquivos candidatos do legado: ${d.count}`);
    dominiosMd.push(`- recomendacao predominante: ${d.recommendation}`);
    dominiosMd.push(`- risco medio: ${d.riskAvg}`);
    dominiosMd.push(`- reaproveitamento medio: ${d.reuseAvg}`);
    dominiosMd.push(`- decisao sugerida: ${d.decision}`);
    dominiosMd.push(`- exemplos de arquivos: ${d.files.length ? d.files.slice(0, 8).map((f) => f.relativePath).join('; ') : 'nenhum mapeado'}`);
    dominiosMd.push('');
  }

  const matrizRows = [];
  for (const d of domainAgg) {
    for (const f of d.files) {
      matrizRows.push([d.domain, f.relativePath, f.scores.complexidade, f.scores.acoplamento, f.scores.riscoOperacional, f.scores.reaproveitamento, f.recommendation, f.riskLevel, d.decision]);
    }
  }

  const semDominioRows = noDomain.map((f) => [f.relativePath, f.extension, f.recommendation, f.riskLevel, 'sem correspondencia forte de palavras-chave']);

  const ordemMd = `# ordem-implementacao

## Fase 0 - Fundacao tecnica
- estrutura de pastas
- eslint/prettier
- variaveis de ambiente
- Supabase client
- logger
- camada de erro
- healthcheck

## Fase 1 - Core Platform
- autenticacao
- contas
- usuarios
- permissoes
- layout base
- roteamento

## Fase 2 - Dados comerciais essenciais
- clientes
- produtos
- pedidos
- importacoes

## Fase 3 - IA Comercial
- memoria comercial
- follow-up IA
- inteligencia externa
- pipeline IA
- WhatsApp IA

## Fase 4 - Gestao e BI
- dashboard
- metricas
- auditoria
- billing
- configuracoes

## Fase 5 - Produto escalavel
- multi-tenant avancado
- i18n
- marketplace/integrations
- agentes IA especializados
`;

  const decisoesMd = `# decisoes-arquiteturais

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
`;

  const topRiskDomains = [...domainAgg].sort((a, b) => b.riskAvg - a.riskAvg).slice(0, 10);
  const topReuseDomains = [...domainAgg].sort((a, b) => b.reuseAvg - a.reuseAvg).slice(0, 10);

  const coverageAlert = coverage < 70
    ? '- ALERTA: cobertura abaixo de 70%. Recomenda-se expandir palavras-chave e adicionar regras por pasta.'
    : '- Cobertura acima de 70%. Mapeamento apto para priorizacao inicial de backlog por dominio.';

  const resumoMd = [
    '# resumo-executivo-reconstrucao', '',
    `- total de arquivos mapeados: ${mappedCount}`,
    `- total sem dominio: ${noDomain.length}`,
    `- cobertura percentual: ${coverage}%`,
    `- dominios encontrados: ${domainList.length}`,
    coverageAlert,
    '', '## Top 10 dominios mais arriscados', '',
    ...topRiskDomains.map((d, i) => `${i + 1}. ${d.domain} (risco medio ${d.riskAvg}, arquivos ${d.count})`),
    '', '## Top 10 dominios com maior reaproveitamento', '',
    ...topReuseDomains.map((d, i) => `${i + 1}. ${d.domain} (reaproveitamento medio ${d.reuseAvg}, arquivos ${d.count})`),
    '', '## Recomendacao final objetiva', '',
    '- Implementar primeiro fundacao + dominios transversais (core/auth/permissoes).',
    '- Tratar dominios com maior risco operacional por contratos e testes de equivalencia.',
    '- Reaproveitar apenas blocos com baixo acoplamento e alto reaproveitamento.'
  ].join('\n');

  const dominiosJson = {
    generatedAt: new Date().toISOString(),
    totalArquivos: mapped.length,
    arquivosMapeados: mappedCount,
    arquivosSemDominio: noDomain.length,
    coberturaPercentual: coverage,
    dominios: {}
  };

  for (const d of domainAgg) {
    dominiosJson.dominios[d.domain] = {
      totalArquivos: d.count,
      riscoMedio: d.riskAvg,
      reaproveitamentoMedio: d.reuseAvg,
      recommendationPredominante: d.recommendation,
      arquivos: d.files.map((f) => ({
        path: f.relativePath,
        extension: f.extension,
        scores: f.scores,
        recommendation: f.recommendation,
        riskLevel: f.riskLevel,
        reasons: f.reasons || [],
        decisaoSugerida: d.decision,
        domainScore: f.domainScore
      }))
    };
  }

  fs.writeFileSync(path.join(OUT_DIR, 'plano-geral.md'), planoGeral);
  fs.writeFileSync(path.join(OUT_DIR, 'dominios-v2.md'), dominiosMd.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'matriz-arquivos-por-dominio.md'), ['# matriz-arquivos-por-dominio', '', table(['Dominio', 'Arquivo legado', 'Complexidade', 'Acoplamento', 'RiscoOperacional', 'Reaproveitamento', 'Recommendation', 'RiskLevel', 'Decisao sugerida'], matrizRows)].join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'ordem-implementacao.md'), ordemMd);
  fs.writeFileSync(path.join(OUT_DIR, 'decisoes-arquiteturais.md'), decisoesMd);
  fs.writeFileSync(path.join(OUT_DIR, 'resumo-executivo-reconstrucao.md'), resumoMd);
  fs.writeFileSync(path.join(OUT_DIR, 'dominios-v2.json'), JSON.stringify(dominiosJson, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'arquivos-sem-dominio.md'), ['# arquivos-sem-dominio', '', table(['Arquivo', 'Extensao', 'Recommendation', 'RiskLevel', 'Motivo provavel'], semDominioRows)].join('\n'));

  const top5 = [...domainAgg].sort((a, b) => b.count - a.count).slice(0, 5);

  console.log(`Total de arquivos processados: ${mapped.length}`);
  console.log(`Arquivos mapeados: ${mappedCount}`);
  console.log(`Arquivos sem dominio: ${noDomain.length}`);
  console.log(`Cobertura %: ${coverage}`);
  console.log(`Dominios encontrados: ${domainList.length}`);
  console.log('Top 5 dominios por quantidade de arquivos:');
  top5.forEach((d, i) => console.log(`${i + 1}. ${d.domain}: ${d.count}`));
  console.log(`Saida: ${OUT_DIR}`);
}

generate();
