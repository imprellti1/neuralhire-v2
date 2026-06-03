const styles = `
  .nh-landing{font-family:Inter,Segoe UI,Arial,sans-serif;background:
    radial-gradient(circle at top left,rgba(99,102,241,.22),transparent 28%),
    radial-gradient(circle at top right,rgba(59,130,246,.16),transparent 24%),
    linear-gradient(180deg,#07101f 0%,#091528 22%,#eef4ff 22.1%,#eef4ff 100%);min-height:100vh;color:#dbe6ff;overflow-x:hidden}
  .nh-landing *{box-sizing:border-box}
  .nh-wrap{max-width:1240px;margin:0 auto;padding:20px}
  .nh-topbar{position:sticky;top:0;z-index:20;backdrop-filter:blur(16px);background:linear-gradient(180deg,rgba(7,16,31,.92),rgba(7,16,31,.72));border:1px solid rgba(148,163,184,.16);border-radius:24px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 18px 60px rgba(2,8,23,.35)}
  .nh-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:-.03em}
  .nh-mark{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 12px 30px rgba(37,99,235,.35),inset 0 1px 0 rgba(255,255,255,.25)}
  .nh-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:18px;color:#b8c7e6;font-size:14px}
  .nh-nav a{color:inherit;text-decoration:none}
  .nh-cta{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;color:#fff;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 16px 30px rgba(37,99,235,.28)}
  .nh-btns{display:flex;flex-wrap:wrap;gap:12px}
  .nh-btn-secondary{background:rgba(255,255,255,.08);border:1px solid rgba(191,219,254,.24);box-shadow:none}
  .nh-hero{padding:34px 0 24px}
  .nh-hero-grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(420px,.98fr);gap:30px;align-items:center}
  .nh-kicker{margin:0 0 14px;text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:#8ab4ff;font-weight:800}
  .nh-title{margin:0;font-size:clamp(40px,5.9vw,74px);line-height:.94;letter-spacing:-.05em;color:#fff;max-width:12ch}
  .nh-title strong{color:transparent;background:linear-gradient(135deg,#b69cff,#61b3ff);-webkit-background-clip:text;background-clip:text}
  .nh-sub{margin:20px 0 24px;color:#bdd0f2;font-size:18px;line-height:1.7;max-width:58ch}
  .nh-badges,.nh-metrics{display:flex;flex-wrap:wrap;gap:10px}
  .nh-pill,.nh-metric{background:rgba(9,19,37,.72);border:1px solid rgba(148,163,184,.18);border-radius:999px;color:#e8f0ff;padding:10px 14px;font-size:13px;box-shadow:0 10px 30px rgba(2,8,23,.14)}
  .nh-metric{border-radius:18px;background:#fff;color:#183153}
  .nh-metric strong{display:block;font-size:18px;margin-bottom:4px;color:#0f172a}
  .nh-panel{background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(17,24,39,.82));border:1px solid rgba(148,163,184,.2);border-radius:28px;padding:18px;box-shadow:0 24px 80px rgba(2,8,23,.48)}
  .nh-dashboard{display:grid;grid-template-columns:170px minmax(0,1fr);min-height:620px;background:#0b1220;border-radius:22px;overflow:hidden;border:1px solid rgba(148,163,184,.14)}
  .nh-sidebar{background:linear-gradient(180deg,#0b1220,#101a2f);padding:18px 14px;border-right:1px solid rgba(148,163,184,.12)}
  .nh-sidebar h3{margin:4px 0 14px;font-size:13px;color:#9fb4dc;text-transform:uppercase;letter-spacing:.12em}
  .nh-side-item{padding:10px 12px;border-radius:12px;color:#dce7fa;font-size:13px;margin-bottom:8px;background:rgba(255,255,255,.03)}
  .nh-main{padding:18px;background:linear-gradient(180deg,#111b30,#0e1728)}
  .nh-main-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
  .nh-main-head h3{margin:0;color:#fff;font-size:20px}
  .nh-main-head span{color:#8fb0e6;font-size:13px}
  .nh-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
  .nh-kpi{background:linear-gradient(180deg,rgba(15,23,42,.95),rgba(15,23,42,.72));border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:14px}
  .nh-kpi .label{font-size:12px;color:#8ba4cf;margin-bottom:8px}
  .nh-kpi .value{font-size:24px;color:#fff;font-weight:800;letter-spacing:-.04em}
  .nh-kpi .delta{margin-top:6px;font-size:12px;color:#7dd3fc}
  .nh-funnel-wrap{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:12px}
  .nh-card{background:linear-gradient(180deg,rgba(15,23,42,.95),rgba(15,23,42,.72));border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:14px}
  .nh-card h4{margin:0 0 10px;color:#fff;font-size:14px}
  .nh-funnel{width:100%;height:220px;display:block}
  .nh-agents-list{display:grid;gap:10px}
  .nh-agent-item{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:rgba(255,255,255,.03)}
  .nh-dot{width:28px;height:28px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,var(--c1),var(--c2))}
  .nh-agent-item strong,.nh-module strong{display:block;color:#fff;font-size:14px;margin-bottom:4px}
  .nh-agent-item span,.nh-module span,.nh-flow-msg{color:#b6c7e5;font-size:13px;line-height:1.55}
  .nh-statbar{margin-top:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .nh-section{padding:68px 0 0;color:#10203b}
  .nh-section h2{margin:0 0 14px;font-size:clamp(28px,3.2vw,48px);line-height:1.05;letter-spacing:-.04em;color:#081225}
  .nh-section p.lead{margin:0 0 28px;color:#4d5f7c;font-size:18px;line-height:1.7;max-width:62ch}
  .nh-grid-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .nh-agent-card,.nh-module{background:#fff;border:1px solid #dde7f7;border-radius:22px;padding:18px;box-shadow:0 16px 40px rgba(16,32,59,.08)}
  .nh-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
  .nh-flow{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
  .nh-flow .bubble{border-radius:18px;padding:16px;border:1px solid rgba(34,197,94,.2);background:rgba(220,252,231,.72)}
  .nh-flow .bubble.alt{background:rgba(255,255,255,.9)}
  .nh-flow .bubble small{display:block;color:#1f7a41;font-weight:800;margin-bottom:8px}
  .nh-cta-band{margin:72px 0 0;border-radius:32px;padding:34px;background:linear-gradient(135deg,#0b1220 0%,#182342 55%,#1f1f5a 100%);color:#fff;box-shadow:0 28px 90px rgba(11,18,32,.42)}
  .nh-cta-band h2,.nh-cta-band p{color:#fff}
  .nh-cta-band .benefits{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 24px}
  .nh-footer{padding:26px 0 40px;color:#42526f}
  .nh-footer-grid{display:grid;grid-template-columns:1.15fr .85fr .85fr .85fr 1fr;gap:18px}
  .nh-footer h4{margin:0 0 12px;color:#081225}
  .nh-footer a,.nh-footer li{color:#51627e;text-decoration:none;list-style:none;margin:0 0 10px}
  .nh-mailbox{display:flex;gap:8px}
  .nh-mailbox input{flex:1;border:1px solid #d7e1f1;border-radius:12px;padding:12px 14px;font:inherit}
  .nh-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;background:#fff;border:1px solid #dde7f7;border-radius:28px;padding:22px;box-shadow:0 18px 44px rgba(16,32,59,.08)}
  .nh-form input{border:1px solid #d7e1f1;border-radius:14px;padding:14px 16px;font:inherit}
  .nh-form .full{grid-column:1/-1}
  .nh-form button,.nh-mailbox button{border:0}
  @media (max-width: 1100px){
    .nh-hero-grid,.nh-dashboard,.nh-funnel-wrap,.nh-footer-grid{grid-template-columns:1fr}
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media (max-width: 720px){
    .nh-topbar{padding:14px}
    .nh-nav{display:none}
    .nh-hero{padding-top:22px}
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow,.nh-form{grid-template-columns:1fr}
    .nh-dashboard{min-height:auto}
    .nh-sidebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .nh-main{padding:14px}
    .nh-panel{padding:12px}
  }
`;

function agentCardStyle(c1, c2) {
  return `style="--c1:${c1};--c2:${c2}"`;
}

function buildLandingHtml() {
  return `
    <main class="nh-landing">
      <div class="nh-wrap">
        <header class="nh-topbar">
          <a class="nh-brand" href="#/">
            <span class="nh-mark">N</span>
            <span>NeuralHire</span>
          </a>
          <nav class="nh-nav" aria-label="Seções">
            <a href="#recursos">Recursos</a>
            <a href="#modulos">Módulos</a>
            <a href="#agentes">Agentes IA</a>
            <a href="#beneficios">Benefícios</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#precos">Preços</a>
          </nav>
          <a class="nh-cta" href="#lista">Entrar na Lista de Interesse</a>
        </header>

        <section class="nh-hero">
          <div class="nh-hero-grid">
            <div>
              <p style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">A nova geração da representação comercial chegou.</p>
              <p style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">Agentes Comerciais de IA</p>
              <p class="nh-kicker">Plataforma SaaS premium para representação comercial</p>
              <h1 class="nh-title">A primeira plataforma de representação comercial com <strong>agentes de IA</strong> operando pelo WhatsApp.</h1>
              <p class="nh-sub">CRM, pedidos, produtos, fábricas e agentes inteligentes que acompanham clientes, identificam oportunidades e preparam negociações. Tudo integrado ao WhatsApp.</p>
              <div class="nh-btns">
                <a class="nh-cta" href="#lista">Entrar na Lista de Interesse</a>
                <a class="nh-cta nh-btn-secondary" href="#como-funciona">Ver como funciona</a>
              </div>
              <div class="nh-badges" style="margin-top:18px">
                <span class="nh-pill">15 dias grátis no lançamento</span>
                <span class="nh-pill">Sem cartão de crédito</span>
                <span class="nh-pill">Sem fidelidade</span>
                <span class="nh-pill">Implantação assistida</span>
              </div>
            </div>

            <div class="nh-panel">
              <div class="nh-dashboard">
                <aside class="nh-sidebar">
                  <h3>NeuralHire</h3>
                  <div class="nh-side-item">Dashboard</div>
                  <div class="nh-side-item">Clientes</div>
                  <div class="nh-side-item">Oportunidades</div>
                  <div class="nh-side-item">Pedidos</div>
                  <div class="nh-side-item">Produtos</div>
                  <div class="nh-side-item">Fábricas</div>
                  <div class="nh-side-item">WhatsApp</div>
                  <div class="nh-side-item">Aprovações</div>
                  <div class="nh-side-item">Agentes IA</div>
                  <div class="nh-side-item">Relatórios</div>
                </aside>
                <section class="nh-main">
                  <div class="nh-main-head">
                    <div>
                      <h3>Dashboard</h3>
                      <span>Visão operacional em tempo real</span>
                    </div>
                    <span style="color:#7dd3fc;font-weight:700">Online</span>
                  </div>
                  <div class="nh-kpi-grid">
                    <div class="nh-kpi"><div class="label">Oportunidades</div><div class="value">128</div><div class="delta">+32%</div></div>
                    <div class="nh-kpi"><div class="label">Pedidos</div><div class="value">56</div><div class="delta">+18%</div></div>
                    <div class="nh-kpi"><div class="label">Faturamento</div><div class="value">R$ 248.760</div><div class="delta">No período</div></div>
                    <div class="nh-kpi"><div class="label">Clientes ativos</div><div class="value">342</div><div class="delta">+12%</div></div>
                  </div>
                  <div class="nh-funnel-wrap">
                    <div class="nh-card">
                      <h4>Funil comercial</h4>
                      <svg class="nh-funnel" viewBox="0 0 640 260" role="img" aria-label="Funil com etapas de descoberta, qualificação, proposta, negociação e fechado">
                        <defs>
                          <linearGradient id="funnelGradient" x1="0" x2="1">
                            <stop offset="0%" stop-color="#8b5cf6"/>
                            <stop offset="100%" stop-color="#2563eb"/>
                          </linearGradient>
                        </defs>
                        <rect x="24" y="24" width="592" height="212" rx="24" fill="rgba(255,255,255,0.02)" stroke="rgba(148,163,184,0.16)"/>
                        <path d="M72 54 H568 L506 96 H134 Z" fill="url(#funnelGradient)" opacity=".9"/>
                        <path d="M120 98 H520 L456 138 H184 Z" fill="url(#funnelGradient)" opacity=".75"/>
                        <path d="M172 140 H468 L414 176 H226 Z" fill="url(#funnelGradient)" opacity=".6"/>
                        <path d="M226 180 H414 L370 208 H270 Z" fill="url(#funnelGradient)" opacity=".45"/>
                        <path d="M278 212 H362 L330 228 H310 Z" fill="url(#funnelGradient)" opacity=".35"/>
                        <g fill="#dbeafe" font-size="12" font-family="Inter,Segoe UI,Arial,sans-serif">
                          <text x="304" y="74" text-anchor="middle">Descoberta</text>
                          <text x="304" y="118" text-anchor="middle">Qualificação</text>
                          <text x="304" y="160" text-anchor="middle">Proposta</text>
                          <text x="304" y="196" text-anchor="middle">Negociação</text>
                          <text x="304" y="224" text-anchor="middle">Fechado</text>
                        </g>
                      </svg>
                    </div>
                    <div class="nh-card">
                      <h4>Atividades dos Agentes</h4>
                      <div class="nh-agents-list">
                        <div class="nh-agent-item"><span class="nh-dot" style="--c1:#a855f7;--c2:#60a5fa"></span><div><strong>Agente de Follow-up</strong><span>Reativa negociações e acompanha retorno dos clientes.</span></div></div>
                        <div class="nh-agent-item"><span class="nh-dot" style="--c1:#06b6d4;--c2:#2563eb"></span><div><strong>Agente de Reativação</strong><span>Busca contas inativas e sugere novas oportunidades.</span></div></div>
                        <div class="nh-agent-item"><span class="nh-dot" style="--c1:#22c55e;--c2:#14b8a6"></span><div><strong>Agente de Cobrança</strong><span>Monitora pendências e envia lembretes no momento certo.</span></div></div>
                        <div class="nh-agent-item"><span class="nh-dot" style="--c1:#f59e0b;--c2:#ef4444"></span><div><strong>Agente de Catálogo</strong><span>Apresenta produtos e acelera pedidos no WhatsApp.</span></div></div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
          <div class="nh-statbar">
            <div class="nh-metric"><strong>+50%</strong>mais oportunidades identificadas</div>
            <div class="nh-metric"><strong>24h</strong>monitoramento dos clientes</div>
            <div class="nh-metric"><strong>100%</strong>WhatsApp integrado</div>
            <div class="nh-metric"><strong>15 dias</strong>gratuitos no lançamento</div>
          </div>
        </section>

        <section class="nh-section" id="agentes">
          <h2>Seu vendedor continua vendendo. Os agentes cuidam do resto.</h2>
          <p class="lead">Agentes inteligentes que trabalham 24 horas por dia para prospectar, atender, recuperar e fidelizar seus clientes.</p>
          <div class="nh-grid-cards">
            <article class="nh-agent-card" ${agentCardStyle('#8b5cf6', '#2563eb')}><span class="nh-dot" style="width:42px;height:42px;margin-bottom:14px"></span><strong>Agente de Reativação</strong><span>Identifica oportunidades frias e cria retoma de contato no timing certo.</span></article>
            <article class="nh-agent-card" ${agentCardStyle('#06b6d4', '#3b82f6')}><span class="nh-dot" style="width:42px;height:42px;margin-bottom:14px"></span><strong>Agente de Follow-up</strong><span>Acompanha conversas, negociações e pendências sem deixar leads escaparem.</span></article>
            <article class="nh-agent-card" ${agentCardStyle('#22c55e', '#14b8a6')}><span class="nh-dot" style="width:42px;height:42px;margin-bottom:14px"></span><strong>Agente de Catálogo</strong><span>Distribui produtos, variações e argumentos comerciais para acelerar pedidos.</span></article>
            <article class="nh-agent-card" ${agentCardStyle('#f59e0b', '#f97316')}><span class="nh-dot" style="width:42px;height:42px;margin-bottom:14px"></span><strong>Agente de Cobrança</strong><span>Recupera valores e organiza comunicações de cobrança com contexto comercial.</span></article>
            <article class="nh-agent-card" ${agentCardStyle('#ec4899', '#8b5cf6')}><span class="nh-dot" style="width:42px;height:42px;margin-bottom:14px"></span><strong>Agente de Customer Success</strong><span>Detecta sinais de risco, reduz churn e apoia renovação e expansão.</span></article>
          </div>
        </section>

        <section class="nh-section" id="modulos">
          <h2>Tudo que sua equipe comercial precisa, em uma única plataforma.</h2>
          <p class="lead">Uma base única para operar CRM, pedidos, produtos, fábricas, aprovações e inteligência de receita sem sair do fluxo comercial.</p>
          <div class="nh-module-grid">
            <article class="nh-module"><strong>CRM Comercial</strong><span>Pipeline, clientes, histórico e visão de oportunidades.</span></article>
            <article class="nh-module"><strong>Pedidos</strong><span>Captação, acompanhamento e status operacional.</span></article>
            <article class="nh-module"><strong>Produtos</strong><span>Catálogo, tabelas e oferta comercial atualizada.</span></article>
            <article class="nh-module"><strong>Fábricas</strong><span>Relacionamento com produção, disponibilidade e suporte.</span></article>
            <article class="nh-module"><strong>WhatsApp Integrado</strong><span>Fluxo nativo de mensagens e interação com clientes.</span></article>
            <article class="nh-module"><strong>Aprovações Inteligentes</strong><span>Travas, validações e envio assistido com governança.</span></article>
            <article class="nh-module"><strong>Customer Success</strong><span>Risco, saúde, retenção e expansão em uma camada única.</span></article>
            <article class="nh-module"><strong>Revenue Intelligence</strong><span>Indicadores para orientar decisão e priorização comercial.</span></article>
          </div>
        </section>

        <section class="nh-section" id="como-funciona">
          <h2>WhatsApp nativo, com fluxo visual e aprovação humana quando precisa.</h2>
          <p class="lead">O agente acompanha a conversa, prepara a retomada e só envia quando o fluxo exige validação. Tudo fica registrado para a operação comercial.</p>
          <div class="nh-card" style="background:linear-gradient(180deg,#dff7e7,#eafaf0);border-color:#c6efd4">
            <div class="nh-flow">
              <div class="bubble alt"><small>Cliente</small><div class="nh-flow-msg">"Me chama mês que vem para fecharmos o pedido."</div></div>
              <div class="bubble"><small>IA - Agente de Follow-up</small><div class="nh-flow-msg">"Perfeito! Vou criar uma retomada para 03/07 e te aviso na data certa."</div></div>
              <div class="bubble alt"><small>Igor - Aprovação</small><div class="nh-flow-msg">"Mensagem aprovada. Pode enviar."</div></div>
              <div class="bubble"><small>Mensagem enviada</small><div class="nh-flow-msg">"Oi! Passando para retomar nossa conversa sobre o pedido. Podemos seguir?"</div></div>
            </div>
          </div>
        </section>

        <section class="nh-section" id="beneficios">
          <h2>Lista de métricas e benefícios prontos para a operação comercial.</h2>
          <p class="lead">Os primeiros assinantes terão implantação assistida, acesso completo e condições especiais no lançamento.</p>
          <div class="nh-badges">
            <span class="nh-pill">+50% mais oportunidades identificadas</span>
            <span class="nh-pill">24h monitoramento dos clientes</span>
            <span class="nh-pill">100% WhatsApp integrado</span>
            <span class="nh-pill">15 dias gratuitos no lançamento</span>
          </div>
        </section>

        <section class="nh-cta-band" id="precos">
          <h2>Estamos selecionando os primeiros assinantes.</h2>
          <p class="lead" style="color:#d9e6ff">Garanta condições especiais, implantação assistida e acesso completo a todos os módulos e agentes de IA.</p>
          <div class="benefits">
            <span class="nh-pill">15 dias grátis</span>
            <span class="nh-pill">Acesso a todos os módulos</span>
            <span class="nh-pill">Implantação assistida</span>
            <span class="nh-pill">Sem fidelidade sem complicação</span>
          </div>
          <a class="nh-cta" href="#lista">Entrar na Lista de Interesse</a>
        </section>

        <section class="nh-section" id="lista">
          <h2>Entre na lista de interesse</h2>
          <p class="lead">Preencha os dados e a equipe retorna quando a abertura dos primeiros assinantes estiver disponível.</p>
          <form id="interest-form" class="nh-form">
            <input name="nome" placeholder="Nome" required>
            <input name="empresa" placeholder="Empresa" required>
            <input name="whatsapp" placeholder="WhatsApp">
            <input name="email" placeholder="E-mail" type="email">
            <input name="segmento" placeholder="Segmento">
            <input name="vendedores" placeholder="Qtd. vendedores">
            <input name="cidadeUf" placeholder="Cidade/UF" class="full">
            <button id="interest-submit" type="submit" class="nh-cta full">Quero entrar na lista de interesse</button>
            <div id="interest-feedback" aria-live="polite" class="full" style="min-height:22px;color:#b42318"></div>
          </form>
        </section>

        <footer class="nh-footer">
          <div class="nh-footer-grid">
            <div>
              <div class="nh-brand" style="margin-bottom:12px;color:#081225"><span class="nh-mark">N</span><span>NeuralHire</span></div>
              <p style="margin:0;line-height:1.7">Plataforma de representação comercial com agentes de IA, WhatsApp nativo, módulos integrados e implantação assistida para times que querem operar com velocidade e clareza.</p>
            </div>
            <div>
              <h4>Produto</h4>
              <ul style="padding:0;margin:0"><li>Recursos</li><li>Módulos</li><li>Agentes IA</li><li>Como funciona</li></ul>
            </div>
            <div>
              <h4>Empresa</h4>
              <ul style="padding:0;margin:0"><li>Sobre nós</li><li>Blog</li><li>Contato</li><li>Carreiras</li></ul>
            </div>
            <div>
              <h4>Suporte</h4>
              <ul style="padding:0;margin:0"><li>Central de ajuda</li><li>Documentação</li><li>Política de privacidade</li><li>Termos de uso</li></ul>
            </div>
            <div>
              <h4>Receba novidades</h4>
              <div class="nh-mailbox">
                <input type="email" placeholder="Seu e-mail">
                <button class="nh-cta" type="button">Cadastrar</button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  `;
}

export function renderPublicLandingPage(container, { apiClient } = {}) {
  container.innerHTML = `<style>${styles}</style>${buildLandingHtml()}`;
  let submitting = false;
  const form = container.querySelector('#interest-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const feedback = container.querySelector('#interest-feedback');
    const submitButton = container.querySelector('#interest-submit');
    const nome = String(form.querySelector('input[name="nome"]')?.value || '').trim();
    const empresa = String(form.querySelector('input[name="empresa"]')?.value || '').trim();
    const whatsapp = String(form.querySelector('input[name="whatsapp"]')?.value || '').trim();
    const email = String(form.querySelector('input[name="email"]')?.value || '').trim();
    if (!nome || !empresa || (!whatsapp && !email)) {
      feedback.textContent = 'Preencha Nome, Empresa e pelo menos WhatsApp ou E-mail.';
      return;
    }
    try {
      submitting = true;
      submitButton.disabled = true;
      feedback.textContent = 'Enviando seu interesse...';
      await apiClient.post('/interest-leads', { nome, empresa, whatsapp, email });
      feedback.textContent = 'Interesse registrado com sucesso. Avisaremos quando o acesso antecipado estiver disponível.';
      form.reset();
    } catch (error) {
      feedback.textContent = error?.message || 'Nao foi possivel registrar agora. Tente novamente em instantes.';
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  });
}
