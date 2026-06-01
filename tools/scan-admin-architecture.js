const fs = require('fs');
const path = require('path');

const LEGACY_ROOT = 'C:/Users/Meu Computador/Meu Drive/PROGRAMAÇÃO/Projeto Representantes';
const NEW_ROOT = 'C:/Users/Meu Computador/Meu Drive/PROGRAMAÇÃO/NEURAL HIRE';
const OUTPUT_DIR = path.join(NEW_ROOT, 'docs', 'arquitetura-legado');
const CONFIG_PATH = path.join(NEW_ROOT, 'tools', 'scan-admin-architecture.config.json');

const DEFAULT_CONFIG = {
  weights: {
    lines: 10, imports: 8, exports: 3, routes: 12, consoleLogs: 5, intervals: 10, cron: 12,
    windowGlobals: 8, documentQueries: 5, envVars: 4, supabaseTables: 8, jobsWorkers: 12, fileCriticality: 20
  },
  thresholds: {
    largeFileLines: 1000, hugeFileLines: 3000, tooManyConsoleLogs: 20, tooManyRoutes: 20, tooManyImports: 15
  },
  criticalPatterns: ['server.js', 'followup', 'whatsapp', 'pipeline', 'worker', 'job', 'scheduler', 'webhook'],
  preservePatterns: ['src/clientes/enriquecimento', 'src/clientes/repositorios', 'tools/scan-admin-architecture.js']
};

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'imagens', 'uploads']);
const IGNORE_FILES = new Set(['package-lock.json', '.env', '.env.local']);
const TEXT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.html', '.css', '.scss', '.sass', '.less', '.sql', '.yml', '.yaml', '.txt', '.sh', '.ps1', '.bat', '.cmd', '.xml']);

function mergeDeep(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    const bv = out[key];
    const ov = override[key];
    if (bv && ov && typeof bv === 'object' && typeof ov === 'object' && !Array.isArray(bv) && !Array.isArray(ov)) out[key] = mergeDeep(bv, ov);
    else out[key] = ov;
  }
  return out;
}
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  try { return mergeDeep(DEFAULT_CONFIG, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))); }
  catch { return DEFAULT_CONFIG; }
}
function clamp100(v) { return Math.max(0, Math.min(100, Math.round(v))); }
function shouldIgnore(name, isDirectory) { return (isDirectory && (IGNORE_DIRS.has(name) || (name.startsWith('.') && name !== '.gitignore'))) || (!isDirectory && IGNORE_FILES.has(name)); }
function readTextSafe(filePath) { try { const b = fs.readFileSync(filePath); if (b.subarray(0, Math.min(2000, b.length)).includes(0)) return null; return b.toString('utf8'); } catch { return null; } }
function uniqueMatches(content, regex, group = 1) { const s = new Set(); let m; while ((m = regex.exec(content)) !== null) if (m[group]) s.add(m[group]); return Array.from(s); }
function countMatches(content, regex) { const m = content.match(regex); return m ? m.length : 0; }

function classifyRiskLevel(scores) {
  const avg = (scores.complexidade + scores.acoplamento + scores.riscoOperacional) / 3;
  if (avg >= 80 || scores.riscoOperacional >= 85) return 'critico';
  if (avg >= 60) return 'alto';
  if (avg >= 35) return 'medio';
  return 'baixo';
}

function recommendationFor(rec) {
  if (rec.riskLevel === 'critico') return 'reescrever_do_zero';
  if (rec.status === 'nao_mexer') return 'apenas_consultar';
  if (rec.scores.reaproveitamento >= 70 && rec.riskLevel !== 'alto') return 'copiar_para_novo_modulo';
  if (rec.scores.reaproveitamento >= 45) return 'reaproveitar_com_revisao';
  if (rec.status === 'possivelmente_orfao' || rec.riskLevel === 'alto') return 'nao_usar';
  return 'reaproveitar_com_revisao';
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldIgnore(entry.name, entry.isDirectory())) continue;
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function resolveRelativeImport(currentRelPath, importPath) {
  if (!importPath.startsWith('.')) return null;
  const baseDir = path.dirname(currentRelPath);
  const raw = path.normalize(path.join(baseDir, importPath)).replace(/\\/g, '/');
  const candidates = [raw, `${raw}.js`, `${raw}.ts`, `${raw}.jsx`, `${raw}.tsx`, `${raw}.mjs`, `${raw}.cjs`, `${raw}/index.js`, `${raw}/index.ts`];
  return candidates;
}

function scoreFile(record, cfg) {
  const w = cfg.weights; const t = cfg.thresholds;
  const importCount = record.staticImports.length + record.dynamicImports.length + record.requires.length;
  const exportCount = record.exports.length + record.moduleExportsCount;
  const routeCount = record.expressRoutes.length;
  const consoleCount = record.consoleLogCount + record.consoleWarnCount + record.consoleErrorCount;
  const intervalCount = record.setIntervalCount + record.setTimeoutCount;
  const patternHit = cfg.criticalPatterns.some((p) => record.relativePath.toLowerCase().includes(p.toLowerCase()));
  const preserveHit = cfg.preservePatterns.some((p) => record.relativePath.toLowerCase().includes(p.toLowerCase()));
  const fnCount = countMatches(record.content || '', /function\s+[A-Za-z0-9_$]*\s*\(|=>\s*\{|\basync\s+function\b/g);
  const bigFnHints = countMatches(record.content || '', /function[\s\S]{2000,}?\{/g);

  const complexidade = clamp100(
    (record.lines / t.largeFileLines) * w.lines +
    (importCount / t.tooManyImports) * w.imports +
    (exportCount / 10) * w.exports +
    (routeCount / t.tooManyRoutes) * w.routes +
    (bigFnHints * 8) +
    (fnCount > 20 ? 10 : 0)
  );

  const acoplamento = clamp100(
    (importCount / t.tooManyImports) * w.imports +
    (record.windowUsageCount > 0 ? w.windowGlobals : 0) +
    (record.supabaseTables.length / 6) * w.supabaseTables +
    (record.querySelectorCount > 0 ? w.documentQueries : 0) +
    (record.processEnvVars.length / 8) * w.envVars
  );

  const riskKeywords = /(webhook|whatsapp|pipeline|followup|billing|auth|session|login)/i.test(record.relativePath + ' ' + (record.content || ''));
  const riscoOperacional = clamp100(
    (patternHit ? w.fileCriticality : 0) +
    (routeCount / t.tooManyRoutes) * w.routes +
    (record.hasWorkerJobHints ? w.jobsWorkers : 0) +
    (record.cronScheduleCount > 0 ? w.cron : 0) +
    (intervalCount > 0 ? w.intervals : 0) +
    (riskKeywords ? 20 : 0)
  );

  let reaproveitamento = 100 - clamp100(
    complexidade * 0.35 + acoplamento * 0.35 + riscoOperacional * 0.30 +
    (consoleCount / t.tooManyConsoleLogs) * w.consoleLogs +
    (record.lines > t.hugeFileLines ? 20 : 0)
  );
  if (preserveHit) reaproveitamento = clamp100(reaproveitamento + 15);
  if (record.cronScheduleCount > 0 || intervalCount > 0 || /server\.js$/i.test(record.relativePath)) reaproveitamento = clamp100(reaproveitamento - 25);

  return { complexidade, acoplamento, riscoOperacional, reaproveitamento };
}

function scanFile(filePath, cfg) {
  const stat = fs.statSync(filePath);
  const rel = path.relative(LEGACY_ROOT, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase() || '(sem_ext)';
  const record = { absolutePath: filePath, relativePath: rel, extension: ext, sizeKB: Number((stat.size / 1024).toFixed(2)), lines: 0, staticImports: [], dynamicImports: [], requires: [], exports: [], moduleExportsCount: 0, expressRoutes: [], consoleLogCount: 0, consoleWarnCount: 0, consoleErrorCount: 0, setIntervalCount: 0, setTimeoutCount: 0, cronScheduleCount: 0, hasWorkerJobHints: false, windowUsageCount: 0, querySelectorCount: 0, addEventListenerCount: 0, fetchCount: 0, supabaseTables: [], processEnvVars: [], htmlScriptRefs: [], isLargeFile: false, possibleOrphan: false, status: 'legado_em_uso', reasons: [], scores: { complexidade: 0, acoplamento: 0, riscoOperacional: 0, reaproveitamento: 0 }, riskLevel: 'baixo', recommendation: 'apenas_consultar', content: '' };
  if (!TEXT_EXTENSIONS.has(ext)) { record.reasons.push('arquivo_binario_ignorado_analise_textual'); return record; }
  const content = readTextSafe(filePath); if (content === null) { record.reasons.push('falha_leitura_texto'); return record; }
  record.content = content;
  record.lines = content ? content.split(/\r?\n/).length : 0;
  record.staticImports = uniqueMatches(content, /import\s+[^\n;]*?from\s+['"]([^'"]+)['"]/g);
  record.dynamicImports = uniqueMatches(content, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  record.requires = uniqueMatches(content, /require\(\s*['"]([^'"]+)['"]\s*\)/g);
  record.exports = uniqueMatches(content, /export\s+(?:default\s+)?(?:const|let|var|function|class)?\s*([A-Za-z0-9_$]+)?/g);
  record.moduleExportsCount = countMatches(content, /module\.exports\s*=|exports\.[A-Za-z0-9_$]+\s*=/g);
  let rm; const routeRegex = /\b(?:app|router)\.(get|post|put|patch|delete|options|head|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((rm = routeRegex.exec(content)) !== null) record.expressRoutes.push({ method: rm[1].toUpperCase(), path: rm[2] });
  record.consoleLogCount = countMatches(content, /console\.log\s*\(/g); record.consoleWarnCount = countMatches(content, /console\.warn\s*\(/g); record.consoleErrorCount = countMatches(content, /console\.error\s*\(/g);
  record.setIntervalCount = countMatches(content, /setInterval\s*\(/g); record.setTimeoutCount = countMatches(content, /setTimeout\s*\(/g); record.cronScheduleCount = countMatches(content, /cron\.schedule\s*\(/g);
  record.hasWorkerJobHints = /(worker|workers|job|queue|bull|agenda|followup|pipeline|whatsapp|scheduler)/i.test(content) || /(worker|workers|job|jobs)/i.test(rel);
  record.windowUsageCount = countMatches(content, /\bwindow\.[A-Za-z0-9_$]+/g); record.querySelectorCount = countMatches(content, /document\.querySelector\s*\(/g); record.addEventListenerCount = countMatches(content, /addEventListener\s*\(/g); record.fetchCount = countMatches(content, /\bfetch\s*\(/g);
  record.supabaseTables = uniqueMatches(content, /\.from\(\s*['"]([A-Za-z0-9_\-]+)['"]\s*\)/g);
  record.processEnvVars = uniqueMatches(content, /process\.env\.([A-Za-z0-9_]+)/g);
  if (ext === '.html') record.htmlScriptRefs = uniqueMatches(content, /<script[^>]*src=["']([^"']+)["'][^>]*>/g);
  const importCount = record.staticImports.length + record.dynamicImports.length + record.requires.length;
  record.possibleOrphan = importCount === 0 && record.expressRoutes.length === 0 && record.lines < 120 && /(?:tmp|temp|old|backup|copy|rascunho)/i.test(rel);
  record.scores = scoreFile(record, cfg);
  record.riskLevel = classifyRiskLevel(record.scores);
  if (/server\.js$/i.test(rel) || record.cronScheduleCount > 0 || record.setIntervalCount > 0) record.status = 'nao_mexer';
  else if (record.riskLevel === 'critico') record.status = 'legado_critico';
  else if (record.possibleOrphan) record.status = 'possivelmente_orfao';
  else if (record.scores.reaproveitamento >= 60) record.status = 'candidato_reaproveitamento';
  else if (record.riskLevel === 'alto') record.status = 'candidato_reescrita';
  else record.status = 'legado_em_uso';
  record.recommendation = recommendationFor(record);
  if (record.riskLevel === 'critico') record.reasons.push('score_risco_critico');
  if (record.possibleOrphan) record.reasons.push('possivelmente_orfao');
  if (record.scores.reaproveitamento >= 70) record.reasons.push('bom_candidato_reaproveitamento');
  delete record.content;
  return record;
}

function toMarkdownTable(rows, headers) { const h = `| ${headers.join(' | ')} |`; const s = `|${headers.map(() => '---').join('|')}|`; const b = rows.map((r) => `| ${r.join(' | ')} |`).join('\n'); return [h, s, b].filter(Boolean).join('\n'); }

function detectCycles(graph) {
  const visited = new Set(); const stack = new Set(); const cycles = [];
  function dfs(node, trail) {
    visited.add(node); stack.add(node); trail.push(node);
    for (const n of (graph[node] || [])) {
      if (!graph[n]) continue;
      if (!visited.has(n)) dfs(n, trail);
      else if (stack.has(n)) { const idx = trail.indexOf(n); if (idx >= 0) cycles.push(trail.slice(idx).concat(n)); }
    }
    trail.pop(); stack.delete(node);
  }
  for (const n of Object.keys(graph)) if (!visited.has(n)) dfs(n, []);
  return cycles;
}

function generateReports(inventory, cfg) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const totalsByExt = {}; const totalsByRisk = { baixo: 0, medio: 0, alto: 0, critico: 0 };
  let totalRoutes = 0, totalConsole = 0, totalTimers = 0;
  const relSet = new Set(inventory.map((f) => f.relativePath));
  const graph = {};

  for (const f of inventory) {
    totalsByExt[f.extension] = (totalsByExt[f.extension] || 0) + 1;
    totalsByRisk[f.riskLevel] = (totalsByRisk[f.riskLevel] || 0) + 1;
    totalRoutes += f.expressRoutes.length;
    totalConsole += f.consoleLogCount;
    totalTimers += f.setIntervalCount + f.cronScheduleCount;
    const deps = [...f.staticImports, ...f.dynamicImports, ...f.requires];
    const relDeps = [];
    deps.forEach((d) => { const cands = resolveRelativeImport(f.relativePath, d) || []; const hit = cands.find((c) => relSet.has(c)); if (hit) relDeps.push(hit); });
    graph[f.relativePath] = Array.from(new Set(relDeps));
  }

  const riskRank = [...inventory].sort((a, b) => (b.scores.riscoOperacional + b.scores.complexidade) - (a.scores.riscoOperacional + a.scores.complexidade));
  const reuseRank = [...inventory].sort((a, b) => b.scores.reaproveitamento - a.scores.reaproveitamento);
  const rewriteRank = [...inventory].filter((f) => f.recommendation === 'reescrever_do_zero').sort((a, b) => b.scores.riscoOperacional - a.scores.riscoOperacional);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'inventario-geral.json'), JSON.stringify({ generatedAt: new Date().toISOString(), legacyRoot: LEGACY_ROOT, configUsed: cfg, totals: { files: inventory.length, byExtension: totalsByExt, byRisk: totalsByRisk }, files: inventory }, null, 2));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'ranking-risco.md'), ['# ranking-risco', '', toMarkdownTable(riskRank.slice(0, 50).map((f, i) => [String(i + 1), f.relativePath, f.riskLevel, String(f.scores.riscoOperacional), String(f.scores.complexidade), f.recommendation]), ['Posicao', 'Arquivo', 'Risco', 'Score Operacional', 'Score Complexidade', 'Recomendacao'])].join('\n'));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'ranking-reaproveitamento.md'), ['# ranking-reaproveitamento', '', toMarkdownTable(reuseRank.slice(0, 50).map((f, i) => [String(i + 1), f.relativePath, String(f.scores.reaproveitamento), f.riskLevel, f.recommendation]), ['Posicao', 'Arquivo', 'Score Reaproveitamento', 'Risco', 'Recomendacao'])].join('\n'));

  const graphLines = ['# grafo-dependencias', '', 'Formato: Arquivo -> dependencias relativas diretas', ''];
  Object.keys(graph).sort().forEach((k) => graphLines.push(`- ${k} -> ${graph[k].length ? graph[k].join(', ') : '(sem dependencias relativas detectadas)'}`));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'grafo-dependencias.md'), graphLines.join('\n'));

  const cycles = detectCycles(graph);
  const cycleLines = ['# dependencias-circulares', '', 'Deteccao limitada a imports relativos diretos.', ''];
  if (!cycles.length) cycleLines.push('Nenhuma dependencia circular simples detectada.');
  else cycles.slice(0, 50).forEach((c, i) => cycleLines.push(`${i + 1}. ${c.join(' -> ')}`));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'dependencias-circulares.md'), cycleLines.join('\n'));

  const execMd = [
    '# resumo-executivo', '',
    `- Total de arquivos analisados: ${inventory.length}`,
    `- Total de rotas detectadas: ${totalRoutes}`,
    `- Total de console.log: ${totalConsole}`,
    `- Total de setInterval/cron: ${totalTimers}`,
    '', '## Totais por extensao', '',
    ...Object.keys(totalsByExt).sort().map((e) => `- ${e}: ${totalsByExt[e]}`),
    '', '## Totais por risco', '',
    ...Object.keys(totalsByRisk).map((r) => `- ${r}: ${totalsByRisk[r]}`),
    '', '## Top 10 arquivos mais criticos', '',
    ...riskRank.slice(0, 10).map((f, i) => `${i + 1}. ${f.relativePath} (${f.riskLevel} | op:${f.scores.riscoOperacional} comp:${f.scores.complexidade})`),
    '', '## Top 10 candidatos a reaproveitamento', '',
    ...reuseRank.slice(0, 10).map((f, i) => `${i + 1}. ${f.relativePath} (reap:${f.scores.reaproveitamento} | ${f.recommendation})`),
    '', '## Top 10 para reescrever do zero', '',
    ...(rewriteRank.length ? rewriteRank.slice(0, 10).map((f, i) => `${i + 1}. ${f.relativePath} (op:${f.scores.riscoOperacional})`) : ['Nenhum arquivo marcado com reescrever_do_zero']),
    '', '## Recomendacoes objetivas NEURAL HIRE', '',
    '- Priorizar reescrita dos itens criticos com rotas/jobs em modulos isolados.',
    '- Reaproveitar apenas candidatos com score alto e baixo acoplamento.',
    '- Evitar copiar server.js e schedulers; migrar apenas regras de negocio validadas.',
    '- Implantar testes de equivalencia para rotas e fluxos pipeline/followup antes de ativacao gradual.'
  ].join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'resumo-executivo.md'), execMd);
}

function main() {
  if (!fs.existsSync(LEGACY_ROOT)) throw new Error(`Pasta legado nao encontrada: ${LEGACY_ROOT}`);
  const cfg = loadConfig();
  const inventory = walk(LEGACY_ROOT).map((f) => scanFile(f, cfg));
  generateReports(inventory, cfg);
  console.log(`Scanner v2 finalizado. Arquivos analisados: ${inventory.length}`);
  console.log(`Relatorios em: ${OUTPUT_DIR}`);
  console.log('Modo: somente leitura no legado.');
}

main();
