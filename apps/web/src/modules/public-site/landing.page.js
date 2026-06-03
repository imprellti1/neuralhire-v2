const styles = `
  .nh-landing{font-family:Inter,Segoe UI,Arial,sans-serif;background:
    radial-gradient(circle at 18% 8%,rgba(139,92,246,.22),transparent 24%),
    radial-gradient(circle at 86% 10%,rgba(34,195,255,.18),transparent 22%),
    linear-gradient(180deg,#07111f 0%,#091528 19%,#ffffff 19.1%,#ffffff 100%);min-height:100vh;color:#0f172a;overflow-x:hidden}
  .nh-landing *{box-sizing:border-box}
  .nh-wrap{max-width:1240px;margin:0 auto;padding:20px}
  .nh-topbar{position:sticky;top:0;z-index:20;backdrop-filter:blur(18px);background:linear-gradient(180deg,rgba(7,17,31,.94),rgba(7,17,31,.74));border:1px solid rgba(148,163,184,.18);border-radius:26px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 18px 60px rgba(2,8,23,.34)}
  .nh-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:-.03em}
  .nh-brand img{display:block;height:32px;width:auto}
  .nh-brand-compact img{height:30px}
  .nh-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:18px;color:#c3d0eb;font-size:14px}
  .nh-nav a{color:inherit;text-decoration:none}
  .nh-cta{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;color:#fff;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 16px 30px rgba(37,99,235,.28),0 0 0 1px rgba(255,255,255,.08) inset}
  .nh-btns{display:flex;flex-wrap:wrap;gap:12px}
  .nh-btn-secondary{background:rgba(255,255,255,.08);border:1px solid rgba(191,219,254,.24);box-shadow:none}
  .nh-hero{padding:34px 0 24px}
  .nh-hero-grid{display:grid;grid-template-columns:minmax(0,.96fr) minmax(440px,1.04fr);gap:30px;align-items:center}
  .nh-kicker{margin:0 0 14px;text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:#8ab4ff;font-weight:800}
  .nh-title{margin:0;font-size:clamp(36px,5.1vw,64px);line-height:.96;letter-spacing:-.055em;color:#fff;max-width:13ch}
  .nh-title strong{color:transparent;background:linear-gradient(135deg,#b69cff,#61b3ff);-webkit-background-clip:text;background-clip:text}
  .nh-sub{margin:20px 0 24px;color:#bdd0f2;font-size:18px;line-height:1.7;max-width:58ch}
  .nh-badges,.nh-metrics{display:flex;flex-wrap:wrap;gap:10px}
  .nh-pill,.nh-metric{background:rgba(9,19,37,.72);border:1px solid rgba(148,163,184,.18);border-radius:999px;color:#e8f0ff;padding:10px 14px;font-size:13px;box-shadow:0 10px 30px rgba(2,8,23,.14)}
  .nh-metric{border-radius:18px;background:#fff;color:#183153}
  .nh-metric strong{display:block;font-size:18px;margin-bottom:4px;color:#0f172a}
  .nh-panel{background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(17,24,39,.82));border:1px solid rgba(148,163,184,.2);border-radius:30px;padding:18px;box-shadow:0 24px 80px rgba(2,8,23,.48),0 0 0 1px rgba(255,255,255,.04) inset}
  .nh-dashboard{display:grid;grid-template-columns:176px minmax(0,1fr);min-height:640px;background:linear-gradient(180deg,#0b1220,#0d1628 55%,#0b1322);border-radius:24px;overflow:hidden;border:1px solid rgba(148,163,184,.14)}
  .nh-sidebar{background:linear-gradient(180deg,#0b1220,#101a2f);padding:18px 14px;border-right:1px solid rgba(148,163,184,.12)}
  .nh-sidebar h3{margin:4px 0 14px;font-size:13px;color:#9fb4dc;text-transform:uppercase;letter-spacing:.12em}
  .nh-side-item{padding:10px 12px;border-radius:12px;color:#dce7fa;font-size:13px;margin-bottom:8px;background:rgba(255,255,255,.03)}
  .nh-main{padding:18px;background:
    radial-gradient(circle at 20% 0,rgba(34,195,255,.08),transparent 34%),
    radial-gradient(circle at 100% 20%,rgba(139,92,246,.14),transparent 30%),
    linear-gradient(180deg,#111b30,#0e1728)}
  .nh-main-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
  .nh-main-head h3{margin:0;color:#fff;font-size:20px}
  .nh-main-head span{color:#8fb0e6;font-size:13px}
  .nh-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
  .nh-kpi{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(15,23,42,.8));border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:14px}
  .nh-kpi::after{content:'';position:absolute;inset:-1px;background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(34,195,255,.04));pointer-events:none}
  .nh-kpi .label{position:relative;font-size:12px;color:#8ba4cf;margin-bottom:8px}
  .nh-kpi .value{position:relative;font-size:24px;color:#fff;font-weight:800;letter-spacing:-.04em}
  .nh-kpi .delta{position:relative;margin-top:6px;font-size:12px;color:#7dd3fc}
  .nh-funnel-wrap{display:grid;grid-template-columns:minmax(0,1fr) 242px;gap:12px}
  .nh-card{background:linear-gradient(180deg,rgba(15,23,42,.95),rgba(15,23,42,.72));border:1px solid rgba(148,163,184,.12);border-radius:20px;padding:16px;box-shadow:0 14px 40px rgba(2,8,23,.18)}
  .nh-card h4{margin:0 0 12px;color:#fff;font-size:14px}
  .nh-funnel{width:100%;height:232px;display:block}
  .nh-agents-list{display:grid;gap:10px}
  .nh-agent-item{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.08)}
  .nh-dot{width:28px;height:28px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 0 0 6px rgba(255,255,255,.03),0 0 24px color-mix(in srgb, var(--c2) 28%, transparent)}
  .nh-agent-item strong,.nh-module strong{display:block;color:#fff;font-size:14px;margin-bottom:4px}
  .nh-agent-item span,.nh-module span,.nh-flow-msg{color:#b6c7e5;font-size:13px;line-height:1.55}
  .nh-statbar{margin-top:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .nh-section{padding:68px 0 0;color:#10203b}
  .nh-section h2{margin:0 0 14px;font-size:clamp(28px,3.2vw,48px);line-height:1.05;letter-spacing:-.04em;color:#081225}
  .nh-section p.lead{margin:0 0 28px;color:#4d5f7c;font-size:18px;line-height:1.7;max-width:62ch}
  .nh-grid-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .nh-agent-card,.nh-module{background:#fff;border:1px solid #dde7f7;border-radius:22px;padding:18px;box-shadow:0 16px 40px rgba(16,32,59,.08)}
  .nh-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
  .nh-card-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .nh-module-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
  .nh-icon{width:48px;height:48px;border-radius:16px;flex:0 0 auto;display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.34),rgba(255,255,255,.12) 30%,rgba(255,255,255,0) 72%),linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 14px 30px rgba(37,99,235,.16),0 0 0 1px rgba(255,255,255,.45) inset}
  .nh-icon svg{width:30px;height:30px;display:block}
  .nh-icon circle,.nh-icon path,.nh-icon rect,.nh-icon line,.nh-icon polyline,.nh-icon polygon{stroke:#fff;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2.2}
  .nh-icon .fill{fill:rgba(255,255,255,.2);stroke:none}
  .nh-flow-shell{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .nh-flow-card{border-radius:18px;padding:18px;border:1px solid rgba(59,130,246,.12);background:linear-gradient(180deg,#f8fdfb,#eef8f2);box-shadow:0 16px 40px rgba(16,32,59,.08)}
  .nh-flow-card.alt{background:linear-gradient(180deg,#eff5ff,#f8fbff)}
  .nh-flow-card .step{display:flex;align-items:center;gap:10px;font-weight:800;color:#123157;margin-bottom:10px}
  .nh-flow-card .step span{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2563eb}
  .nh-flow-card .body{color:#34506f;line-height:1.65;font-size:14px}
  .nh-cta-band{margin:72px 0 0;border-radius:32px;padding:34px;background:linear-gradient(135deg,#07111f 0%,#12214a 52%,#1a1f63 100%);color:#fff;box-shadow:0 28px 90px rgba(11,18,32,.42);position:relative;overflow:hidden}
  .nh-cta-band::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 10% 50%,rgba(34,195,255,.18),transparent 24%),radial-gradient(circle at 88% 40%,rgba(139,92,246,.22),transparent 24%)}
  .nh-cta-band > *{position:relative}
  .nh-cta-band h2,.nh-cta-band p{color:#fff}
  .nh-cta-band .benefits{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 24px}
  .nh-footer{padding:30px 0 40px;color:#42526f}
  .nh-footer-grid{display:grid;grid-template-columns:1.2fr .85fr .85fr .85fr 1fr;gap:18px}
  .nh-footer h4{margin:0 0 12px;color:#081225}
  .nh-footer a,.nh-footer li{color:#51627e;text-decoration:none;list-style:none;margin:0 0 10px}
  .nh-mailbox{display:flex;gap:8px}
  .nh-mailbox input{flex:1;border:1px solid #d7e1f1;border-radius:12px;padding:12px 14px;font:inherit}
  .nh-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;background:#fff;border:1px solid #dde7f7;border-radius:28px;padding:22px;box-shadow:0 18px 44px rgba(16,32,59,.08)}
  .nh-form input{border:1px solid #d7e1f1;border-radius:14px;padding:14px 16px;font:inherit}
  .nh-form .full{grid-column:1/-1}
  .nh-form button,.nh-mailbox button{border:0}
  .nh-whatsapp-band{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;align-items:stretch}
  .nh-whatsapp-panel{background:linear-gradient(180deg,#e8fbef,#effaf2);border:1px solid #cdebd8;border-radius:22px;padding:18px}
  .nh-whatsapp-meta{display:flex;gap:12px;align-items:center;margin-bottom:12px}
  .nh-whatsapp-meta .nh-icon{width:42px;height:42px;border-radius:14px}
  @media (max-width: 1100px){
    .nh-hero-grid,.nh-dashboard,.nh-funnel-wrap,.nh-footer-grid,.nh-whatsapp-band{grid-template-columns:1fr}
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow-shell,.nh-card-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media (max-width: 720px){
    .nh-topbar{padding:14px}
    .nh-nav{display:none}
    .nh-hero{padding-top:22px}
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow-shell,.nh-form,.nh-card-grid-2{grid-template-columns:1fr}
    .nh-dashboard{min-height:auto}
    .nh-sidebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .nh-main{padding:14px}
    .nh-panel{padding:12px}
  }
`;

const ICONS = {
  crm: ['M6 9h12M6 14h12M6 19h8', 'M4 5h16v16H4z', 'M8 5v16'],
  pedidos: ['M6 7h10l4 4v10H6zM16 7v4h4', 'M9 11h5M9 15h7', 'M8 18h8'],
  produtos: ['M6 9l6-4 6 4-6 4zM6 9v6l6 4 6-4V9', 'M12 5v8'],
  fabricas: ['M5 19V9l7-4 7 4v10', 'M8 19v-5h3v5M13 19v-7h2v7', 'M7 12h2M11 12h2M15 12h2'],
  relatorios: ['M5 19h14M7 16V9M11 16V6M15 16v-4', 'M6 7l4 2 4-3 4 2'],
  whatsapp: ['M7 6h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H12l-4 3v-3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z', 'M9 10c.4 1.7 1.9 3.6 3.6 4l1.4-1.2 1.8.8-.4 2c-.1.5-.6.8-1.1.8-3.9-.2-7-3.3-7.2-7.2 0-.5.3-1 .8-1.1l2-.4.8 1.8L9 10z'],
  followup: ['M6 8h12v8H9l-3 3z', 'M8 11h6M8 14h4', 'M15 6l2 2-2 2'],
  reativacao: ['M6 12a6 6 0 1 1 2 4.5', 'M6 12h4M6 12l2-2M6 12l2 2', 'M16 7v3h-3'],
  cobranca: ['M7 8h8v8H7z', 'M9 10h4M9 13h4', 'M12 6v2M12 16v2', 'M6 12h2M16 12h2'],
  catalogo: ['M7 7h8l2 3v7H7z', 'M9 10h6M9 13h4', 'M12 7v6'],
  cs: ['M7 11a5 5 0 0 1 10 0c0 3.2-2.3 5.6-5 7-2.7-1.4-5-3.8-5-7z', 'M12 8v3l2 2'],
  interesse: ['M6 7h12v10H6z', 'M6 10h12M10 14h4', 'M8 5v4M16 5v4'],
  nocard: ['M6 8h12v8H6z', 'M8 10h3', 'M13 10h3', 'M8 13h8'],
  noloyal: ['M7 8h10v8H7z', 'M9 10h2M12 10h2M9 13h5', 'M6 6l12 12'],
  onboarding: ['M6 19V8l6-3 6 3v11', 'M9 19v-5h6v5', 'M9 11h6'],
  dashboard: ['M6 6h5v5H6zM13 6h5v8h-5zM6 13h5v5H6zM13 16h5v2h-5z'],
};

function iconSvg(name) {
  const [a, b, c, d] = ICONS[name];
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle class="fill" cx="12" cy="12" r="11" />
      ${a ? `<path d="${a}" />` : ''}
      ${b ? `<path d="${b}" />` : ''}
      ${c ? `<path d="${c}" />` : ''}
      ${d ? `<path d="${d}" />` : ''}
    </svg>
  `;
}

function premiumIcon(name, c1, c2) {
  return `<span class="nh-icon" style="--c1:${c1};--c2:${c2}">${iconSvg(name)}</span>`;
}

function agentCardStyle(c1, c2) {
  return `style="--c1:${c1};--c2:${c2}"`;
}

const moduleCards = [
  ['CRM Comercial', 'Pipeline, clientes, histórico e visão de oportunidades.', 'crm', '#8b5cf6', '#2563eb'],
  ['Pedidos', 'Captação, acompanhamento e status operacional.', 'pedidos', '#06b6d4', '#3b82f6'],
  ['Produtos', 'Catálogo, tabelas e oferta comercial atualizada.', 'produtos', '#22c55e', '#14b8a6'],
  ['Fábricas', 'Relacionamento com produção, disponibilidade e suporte.', 'fabricas', '#f59e0b', '#f97316'],
  ['Relatórios', 'Indicadores para orientar decisão e priorização comercial.', 'relatorios', '#ec4899', '#8b5cf6'],
  ['WhatsApp', 'Fluxo nativo de mensagens e interação com clientes.', 'whatsapp', '#25d366', '#16a34a'],
  ['Customer Success', 'Risco, saúde, retenção e expansão em uma camada única.', 'cs', '#6366f1', '#06b6d4'],
  ['Lista de Interesse', 'Captura de demanda e follow-up automatizado.', 'interesse', '#8b5cf6', '#22c3ff'],
  ['Sem cartão', 'Entrada facilitada sem fricção financeira.', 'nocard', '#0ea5e9', '#2563eb'],
  ['Sem fidelidade', 'Liberdade comercial para os primeiros assinantes.', 'noloyal', '#22c55e', '#16a34a'],
  ['Implantação assistida', 'Onboarding guiado para acelerar o go-live.', 'onboarding', '#f59e0b', '#f97316'],
];

const agentCards = [
  ['Agente de Follow-up', 'Reativa negociações e acompanha retorno dos clientes.', 'followup', '#8b5cf6', '#60a5fa'],
  ['Agente de Reativação', 'Busca contas inativas e sugere novas oportunidades.', 'reativacao', '#06b6d4', '#2563eb'],
  ['Agente de Cobrança', 'Monitora pendências e envia lembretes no momento certo.', 'cobranca', '#22c55e', '#14b8a6'],
  ['Agente de Catálogo', 'Apresenta produtos e acelera pedidos no WhatsApp.', 'catalogo', '#f59e0b', '#ef4444'],
  ['Agente de Customer Success', 'Detecta sinais de risco, reduz churn e apoia expansão.', 'cs', '#ec4899', '#8b5cf6'],
];

function renderIconCard([title, text, icon, c1, c2]) {
  return `<article class="nh-module"><div class="nh-module-head">${premiumIcon(icon, c1, c2)}<div><strong>${title}</strong><span>${text}</span></div></div></article>`;
}

function buildDashboardHtml() {
  return `
    <div class="nh-panel">
      <div class="nh-dashboard">
        <aside class="nh-sidebar">
          <img src="/brand/neuralhire-logo-compact-dark.svg" alt="NeuralHire" style="height:28px;width:auto;margin-bottom:16px">
          <h3>Suite comercial</h3>
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
                <path d="M72 54 H568 L506 96 H134 Z" fill="url(#funnelGradient)" opacity=".95"/>
                <path d="M120 98 H520 L456 138 H184 Z" fill="url(#funnelGradient)" opacity=".8"/>
                <path d="M172 140 H468 L414 176 H226 Z" fill="url(#funnelGradient)" opacity=".64"/>
                <path d="M226 180 H414 L370 208 H270 Z" fill="url(#funnelGradient)" opacity=".48"/>
                <path d="M278 212 H362 L330 228 H310 Z" fill="url(#funnelGradient)" opacity=".38"/>
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
                ${agentCards.slice(0, 4).map(([title, text, icon, c1, c2]) => `<div class="nh-agent-item">${premiumIcon(icon, c1, c2)}<div><strong>${title}</strong><span>${text}</span></div></div>`).join('')}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function buildLandingHtml() {
  return `
    <main class="nh-landing">
      <div class="nh-wrap">
        <header class="nh-topbar">
          <a class="nh-brand" href="#/">
            <img src="/brand/neuralhire-logo-horizontal-dark.svg" alt="NeuralHire">
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

            ${buildDashboardHtml()}
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
            ${agentCards.map(renderIconCard).join('')}
          </div>
        </section>

        <section class="nh-section" id="modulos">
          <h2>Tudo que sua equipe comercial precisa, em uma única plataforma.</h2>
          <p class="lead">Uma base única para operar CRM, pedidos, produtos, fábricas, aprovações e inteligência de receita sem sair do fluxo comercial.</p>
          <div class="nh-module-grid">
            ${moduleCards.map(renderIconCard).join('')}
          </div>
        </section>

        <section class="nh-section" id="como-funciona">
          <h2>WhatsApp nativo, com fluxo visual e aprovação humana quando precisa.</h2>
          <p class="lead">O agente acompanha a conversa, prepara a retomada e só envia quando o fluxo exige validação. Tudo fica registrado para a operação comercial.</p>
          <div class="nh-whatsapp-band">
            <div class="nh-whatsapp-panel">
              <div class="nh-whatsapp-meta">
                ${premiumIcon('whatsapp', '#25d366', '#16a34a')}
                <div>
                  <strong style="display:block;color:#0f172a">Fluxo premium de WhatsApp</strong>
                  <span style="color:#36506e">Mensagem assistida com aprovação humana</span>
                </div>
              </div>
              <div class="nh-card-grid-2">
                <div class="nh-flow-card alt">
                  <div class="step">${premiumIcon('followup', '#8b5cf6', '#2563eb')}<span>1</span>Cliente envia mensagem</div>
                  <div class="body">“Me chama mês que vem para fecharmos o pedido.”</div>
                </div>
                <div class="nh-flow-card">
                  <div class="step">${premiumIcon('cs', '#06b6d4', '#3b82f6')}<span>2</span>Agente IA interpreta</div>
                  <div class="body">O agente reconhece intenção, contexto e sugere a melhor retomada.</div>
                </div>
                <div class="nh-flow-card">
                  <div class="step">${premiumIcon('dashboard', '#22c55e', '#14b8a6')}<span>3</span>Igor aprova</div>
                  <div class="body">Igor valida a mensagem, ajusta o tom e libera o envio com governança.</div>
                </div>
                <div class="nh-flow-card alt">
                  <div class="step">${premiumIcon('whatsapp', '#25d366', '#16a34a')}<span>4</span>Mensagem enviada</div>
                  <div class="body">“Oi! Passando para retomar nossa conversa sobre o pedido. Podemos seguir?”</div>
                </div>
              </div>
            </div>
            <div class="nh-card" style="background:linear-gradient(180deg,#daf7e4,#ecfbf1);border-color:#c7ebd5">
              <h4 style="color:#0b3d21">Resumo do fluxo</h4>
              <div class="nh-agents-list">
                <div class="nh-agent-item" style="background:rgba(255,255,255,.52)">${premiumIcon('whatsapp', '#25d366', '#16a34a')}<div><strong style="color:#0b3d21">WhatsApp nativo</strong><span style="color:#2f6344">Centraliza a conversa comercial sem blocos secos de texto.</span></div></div>
                <div class="nh-agent-item" style="background:rgba(255,255,255,.52)">${premiumIcon('followup', '#8b5cf6', '#2563eb')}<div><strong style="color:#0b3d21">IA com contexto</strong><span style="color:#2f6344">Entende o momento da conversa e acelera a próxima ação.</span></div></div>
                <div class="nh-agent-item" style="background:rgba(255,255,255,.52)">${premiumIcon('dashboard', '#22c55e', '#14b8a6')}<div><strong style="color:#0b3d21">Aprovação humana</strong><span style="color:#2f6344">Mantém controle e qualidade antes do disparo.</span></div></div>
              </div>
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
          <div style="display:grid;grid-template-columns:72px 1fr;gap:18px;align-items:center">
            <div class="nh-icon" style="width:72px;height:72px;border-radius:24px;--c1:#8b5cf6;--c2:#22c3ff">${iconSvg('dashboard')}</div>
            <div>
              <h2>Estamos selecionando os primeiros assinantes.</h2>
              <p class="lead" style="color:#d9e6ff">Garanta condições especiais, implantação assistida e acesso completo a todos os módulos e agentes de IA.</p>
            </div>
          </div>
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
              <a class="nh-brand nh-brand-compact" href="#/" style="margin-bottom:12px;color:#081225">
                <img src="/brand/neuralhire-logo-compact-dark.svg" alt="NeuralHire">
              </a>
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
