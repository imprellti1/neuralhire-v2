import { spawn } from 'node:child_process';

const groups = [
  [
    'node',
    '--test',
    'src/modules/produtos-catalogo/produto-details.page.dom.test.js',
    'src/modules/promocoes/promocoes.page.dom.test.js',
    'src/modules/produtos-catalogo/produtos-import.page.dom.test.js',
    'src/modules/produtos-catalogo/produtos.routes.smoke.test.js',
    'src/modules/clientes-crm/clientes.routes.smoke.test.js',
    'src/modules/clientes-crm/clientes.routes.vendor.test.js',
    'src/modules/pedidos-comercial/pedidos.routes.smoke.test.js',
    'src/modules/public-site/landing.routes.smoke.test.js',
    'src/modules/interest-leads/interest-leads.routes.smoke.test.js',
    'src/modules/interest-leads/interest-leads.page.dom.test.js',
    'src/modules/interest-leads/interest-leads-launch.page.dom.test.js',
    'src/modules/launch-templates/launch-templates.routes.smoke.test.js',
    'src/modules/launch-templates/launch-templates.page.dom.test.js',
    'src/modules/ai-director/ai-director.routes.smoke.test.js',
    'src/modules/ai-director/ai-director.page.dom.test.js'
  ],
  [
    'node',
    '--test',
    'src/modules/interest-leads/interest-leads-convert.page.dom.test.js',
    'src/modules/onboarding/onboarding.routes.smoke.test.js',
    'src/modules/onboarding/onboarding.page.dom.test.js',
    'src/modules/portfolio-dashboard/portfolio-dashboard.page.dom.test.js',
    'src/modules/portfolio-dashboard/portfolio-dashboard.routes.smoke.test.js',
    'src/modules/legacy-import/legacy-import.page.dom.test.js',
    'src/modules/clientes-import/clientes-import.page.dom.test.js',
    'src/modules/legacy-import/legacy-import-audit.dom.test.js',
    'src/modules/legacy-import/legacy-import-audit-report.dom.test.js',
    'src/modules/legacy-import/legacy-import-approval.dom.test.js',
    'src/modules/legacy-import/legacy-import-promotion.dom.test.js'
  ],
  [
    'node',
    '--test',
    'src/modules/legacy-import/legacy-import.routes.smoke.test.js',
    'src/modules/legacy-import/legacy-import.service.test.js',
    'src/modules/auditoria/auditoria.page.dom.test.js',
    'src/modules/customer-memory/customer-memory.page.dom.test.js',
    'src/modules/customer-memory/customer-memory.routes.smoke.test.js',
    'src/modules/fabricantes/fabricantes.page.dom.test.js',
    'src/modules/fabricantes/fabricantes.routes.smoke.test.js',
    'src/modules/vendedores/vendedores.routes.smoke.test.js',
    'src/modules/product-audit/product-audit.page.dom.test.js',
    'src/modules/product-audit/product-audit.routes.smoke.test.js',
    'src/modules/product-editor/product-editor.page.dom.test.js',
    'src/modules/product-editor/product-editor.routes.smoke.test.js'
  ],
  [
    'node',
    '--test',
    'src/modules/whatsapp-conversations/whatsapp-conversations.page.dom.test.js',
    'src/modules/whatsapp-conversations/message-drafts.dom.test.js',
    'src/modules/whatsapp-conversations/action-aware-drafts.dom.test.js',
    'src/modules/whatsapp-conversations/whatsapp-context.dom.test.js',
    'src/modules/whatsapp-conversations/whatsapp-delivery.dom.test.js',
    'src/modules/whatsapp-conversations/commercial-agent.dom.test.js',
    'src/modules/whatsapp-conversations/whatsapp-conversations.routes.smoke.test.js',
    'src/modules/message-approvals/message-approvals.page.dom.test.js',
    'src/modules/message-approvals/message-approvals.routes.smoke.test.js',
    'src/modules/approval-intelligence/approval-intelligence.page.dom.test.js',
    'src/modules/approval-intelligence/approval-intelligence.routes.smoke.test.js',
    'src/modules/public-site/landing-to-lead.integration.test.js',
    'src/modules/interest-leads/interest-lead-conversion.integration.test.js',
    'src/modules/onboarding/onboarding.integration.test.js',
    'src/testing/jornada-comercial.routes.smoke.test.js'
  ]
];

function run(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command[0], command.slice(1), {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      env: process.env
    });

    proc.on('error', reject);
    proc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${signal || code}): ${command.join(' ')}`));
    });
  });
}

async function main() {
  const active = groups.map((command) => run(command));
  const results = await Promise.allSettled(active);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    console.error(failed.reason?.message || failed.reason);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
