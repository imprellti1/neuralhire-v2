export function renderPublicLandingPage(container) {
  container.innerHTML = `
  <style>
    .nhl{font-family:"Segoe UI",Tahoma,sans-serif;color:#14213d;background:#f6f9ff}
    .nhl-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
    .nhl-header{position:sticky;top:0;background:rgba(246,249,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid #dce6ff;z-index:20}
    .nhl-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0}
    .nhl-logo{font-weight:800;color:#1e40af}.nhl-nav{display:flex;gap:14px;flex-wrap:wrap}.nhl-nav a{color:#334155;text-decoration:none;font-weight:600}
    .nhl-btn{border:0;border-radius:12px;padding:11px 16px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}.nhl-btn-main{background:linear-gradient(135deg,#2563eb,#6d28d9);color:#fff}.nhl-btn-sub{background:#e3ecff;color:#1d4ed8}
    .nhl-hero{padding:64px 0 30px}.nhl-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:28px}.nhl-card{background:#fff;border:1px solid #dbe5ff;border-radius:20px;box-shadow:0 12px 30px rgba(30,64,175,.08)}
    .nhl-h1{font-size:41px;line-height:1.1;margin:0 0 14px}.nhl-p{color:#475569;line-height:1.6}.nhl-badge{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:8px 12px;font-weight:700;font-size:13px}
    .nhl-kpi{padding:18px}.nhl-sec{padding:44px 0}.nhl-title{font-size:30px;margin:0 0 10px}.nhl-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .nhl-mini{padding:16px}.nhl-mini h4{margin:0 0 8px}.nhl-mini p,.nhl-mini li{margin:0;color:#475569;line-height:1.5}
    .nhl-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.nhl-step{padding:16px;border-radius:14px;background:#eff4ff;border:1px solid #cedcff}
    .nhl-form{padding:18px}.nhl-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .nhl-input{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:10px}.nhl-feedback{margin-top:10px;font-weight:700}.nhl-footer{padding:34px 0;background:#eef3ff;border-top:1px solid #dbe5ff}
    details{background:#fff;border:1px solid #dbe5ff;padding:12px;border-radius:12px} details+details{margin-top:10px}
    @media(max-width:980px){.nhl-grid{grid-template-columns:1fr}.nhl-h1{font-size:30px}.nhl-fields{grid-template-columns:1fr}}
  </style>
  <div class="nhl">
    <header class="nhl-header"><div class="nhl-wrap nhl-row"><div class="nhl-logo">NeuralHire v2</div><nav class="nhl-nav"><a href="#inicio">Início</a><a href="#recursos">Recursos</a><a href="#modulos">Módulos</a><a href="#agentes">Agentes IA</a><a href="#seguranca">Segurança</a><a href="#lista">Lista de interesse</a></nav><div><a class="nhl-btn nhl-btn-sub" href="#/dashboard-comercial">Entrar no sistema</a> <a class="nhl-btn nhl-btn-main" href="#lista">Entrar na Lista de Interesse</a></div></div></header>
    <section id="inicio" class="nhl-hero"><div class="nhl-wrap nhl-grid"><div><h1 class="nhl-h1">A nova geração da representação comercial chegou.</h1><p class="nhl-p">CRM, pedidos, catálogo inteligente e Agentes Comerciais de IA trabalhando no WhatsApp para ajudar representantes, distribuidores e equipes comerciais a vender mais.</p><div class="nhl-badge">Pré-lançamento • 15 dias grátis • Sem contratação liberada neste momento</div><p style="margin-top:14px"><a class="nhl-btn nhl-btn-main" href="#lista">Entrar na Lista de Interesse</a> <a class="nhl-btn nhl-btn-sub" href="#recursos">Conhecer os Recursos</a></p></div><div class="nhl-card nhl-kpi"><h3>Visão Comercial Unificada</h3><p>Clientes, pedidos, catálogo e indicadores reunidos com apoio de agentes de IA em fase de preparação para o lançamento.</p></div></div></section>
    <section id="recursos" class="nhl-sec"><div class="nhl-wrap"><h2 class="nhl-title">Problemas comerciais que o NeuralHire ajuda a resolver</h2><div class="nhl-cards">${simpleCard('Clientes esquecidos','Reativa relacionamento e reduz carteira parada.')}${simpleCard('Follow-ups manuais','Padroniza rotina comercial e reduz retrabalho.')}${simpleCard('Pedidos espalhados','Centraliza informações e status em um fluxo único.')}${simpleCard('Falta de indicadores','Mostra faturamento, desempenho e prioridades.')}${simpleCard('Vendedores sem processo','Cria operação com método e previsibilidade.')}${simpleCard('Oportunidades perdidas','Aumenta frequência de contato e conversão.')}</div></div></section>
    <section id="modulos" class="nhl-sec"><div class="nhl-wrap"><h2 class="nhl-title">Módulos da plataforma</h2><div class="nhl-cards">${simpleCard('CRM Comercial','Organize a carteira e avance negociações com mais contexto.')}${simpleCard('Clientes 360°','Tenha histórico completo para decisões mais rápidas.')}${simpleCard('Pedidos Comerciais','Gere e acompanhe pedidos com menos ruído operacional.')}${simpleCard('Catálogo de Produtos','Apresente produtos certos no momento certo.')}${simpleCard('Dashboard Executivo','Monitore metas, gaps e evolução por período.')}${simpleCard('Inteligência Comercial','Priorize contas com maior potencial de resultado.')}</div></div></section>
    <section id="agentes" class="nhl-sec"><div class="nhl-wrap"><h2 class="nhl-title">Agentes Comerciais de IA que trabalham como uma extensão da sua equipe.</h2><p class="nhl-p">Os agentes do NeuralHire poderão atuar via WhatsApp para apoiar atendimento, follow-up, reativação de clientes e recuperação de oportunidades. Recursos em desenvolvimento e previstos para o lançamento.</p><div class="nhl-cards">${simpleCard('Atendimento via WhatsApp','Primeiro suporte comercial em fase de preparação.')}${simpleCard('Follow-up automático','Lembretes e retomadas previstos para o lançamento.')}${simpleCard('Reativação de clientes inativos','Campanhas para reduzir inatividade.')}${simpleCard('Sugestão de produtos','Recomendações com base no perfil de compra.')}${simpleCard('Recuperação de oportunidades','Alertas de negociação em risco.')}${simpleCard('Apoio na geração de pedidos','Assistência operacional para o vendedor.')}${simpleCard('Priorização de clientes','Foco em contas de maior potencial.')}${simpleCard('Análise de comportamento comercial','Insights para aumentar frequência e conversão.')}</div></div></section>
    <section class="nhl-sec"><div class="nhl-wrap"><h2 class="nhl-title">Como vai funcionar</h2><div class="nhl-flow"><div class="nhl-step"><strong>1.</strong> O cliente entra em contato</div><div class="nhl-step"><strong>2.</strong> O agente entende a necessidade</div><div class="nhl-step"><strong>3.</strong> Sugere produtos ou próximos passos</div><div class="nhl-step"><strong>4.</strong> Apoia o representante</div><div class="nhl-step"><strong>5.</strong> Pedido e dados alimentam o dashboard</div></div></div></section>
    <section class="nhl-sec"><div class="nhl-wrap nhl-card nhl-form"><h2 class="nhl-title">15 dias grátis no lançamento</h2><p class="nhl-p">Quem entrar na lista de interesse poderá ser convidado para testar o NeuralHire por 15 dias, com acesso completo aos recursos liberados no período de lançamento.</p><p class="nhl-p"><strong>Sem cartão de crédito neste momento • Acesso antecipado por convite • Ideal para representantes, distribuidores e equipes comerciais</strong></p></div></section>
    <section id="lista" class="nhl-sec"><div class="nhl-wrap nhl-card nhl-form"><h2 class="nhl-title">Quero participar do lançamento</h2><form id="interest-form"><div class="nhl-fields"><input class="nhl-input" name="nome" placeholder="Nome"><input class="nhl-input" name="empresa" placeholder="Empresa"><input class="nhl-input" name="whatsapp" placeholder="WhatsApp"><input class="nhl-input" name="email" placeholder="E-mail"><input class="nhl-input" name="segmento" placeholder="Segmento"><input class="nhl-input" name="vendedores" placeholder="Quantidade de vendedores"><input class="nhl-input" name="cidadeUf" placeholder="Cidade/UF"></div><button class="nhl-btn nhl-btn-main" type="submit">Quero entrar na lista de interesse</button><div id="interest-feedback" class="nhl-feedback" aria-live="polite"></div></form></div></section>
    <section class="nhl-sec"><div class="nhl-wrap"><h2 class="nhl-title">FAQ</h2>
      <details><summary>O NeuralHire já está disponível para contratação?</summary><p>Não. O NeuralHire v2 está em pré-lançamento e sem contratação direta neste momento.</p></details>
      <details><summary>O teste de 15 dias será gratuito?</summary><p>Sim, para convidados no lançamento, conforme disponibilidade do programa inicial.</p></details>
      <details><summary>Preciso informar cartão de crédito?</summary><p>Não nesta etapa de pré-lançamento.</p></details>
      <details><summary>Os agentes de IA via WhatsApp estarão inclusos?</summary><p>Estão previstos para o lançamento, em fase de preparação.</p></details>
      <details><summary>Posso usar com mais de um vendedor?</summary><p>Sim, a proposta é suportar equipes comerciais multiusuário.</p></details>
      <details><summary>O sistema separa dados por empresa e por vendedor?</summary><p>Sim, a estrutura é preparada para multiempresa e organização por equipe/carteira.</p></details>
      <details><summary>Quando o acesso será liberado?</summary><p>Os interessados da lista serão avisados quando o acesso antecipado por convite estiver disponível.</p></details>
    </div></section>
    <footer class="nhl-footer"><div class="nhl-wrap"><h3>NeuralHire v2</h3><p>Plataforma de inteligência comercial para representação, distribuição e vendas B2B.</p><p><a class="nhl-btn nhl-btn-main" href="#lista">Entrar na Lista de Interesse</a></p><small>Pré-lançamento — funcionalidades podem evoluir até a liberação oficial.</small></div></footer>
  </div>`;

  container.querySelector('#interest-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nome = String(form.querySelector('input[name="nome"]')?.value || '').trim();
    const empresa = String(form.querySelector('input[name="empresa"]')?.value || '').trim();
    const whatsapp = String(form.querySelector('input[name="whatsapp"]')?.value || '').trim();
    const email = String(form.querySelector('input[name="email"]')?.value || '').trim();
    const feedback = container.querySelector('#interest-feedback');
    if (!nome || !empresa || (!whatsapp && !email)) {
      feedback.textContent = 'Preencha Nome, Empresa e pelo menos WhatsApp ou E-mail.';
      feedback.style.color = '#b45309';
      return;
    }
    feedback.textContent = 'Interesse registrado nesta prévia. Em breve entraremos em contato quando o acesso antecipado estiver disponível.';
    feedback.style.color = '#047857';
    form.reset();
  });
}

function simpleCard(title, text) {
  return `<article class="nhl-card nhl-mini"><h4>${title}</h4><p>${text}</p></article>`;
}
