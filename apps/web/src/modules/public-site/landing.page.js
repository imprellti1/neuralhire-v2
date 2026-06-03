const styles = `
  .nh-landing{font-family:Inter,Segoe UI,Arial,sans-serif;background:
    radial-gradient(circle at 18% 8%,rgba(139,92,246,.22),transparent 24%),
    radial-gradient(circle at 86% 10%,rgba(34,195,255,.18),transparent 22%),
    linear-gradient(180deg,#07111f 0%,#091528 18.7%,#ffffff 18.8%,#ffffff 100%);min-height:100vh;color:#0f172a;overflow-x:hidden}
  .nh-landing *{box-sizing:border-box}
  .nh-wrap{max-width:1280px;margin:0 auto;padding:0 32px}
  .nh-topbar{position:sticky;top:0;z-index:20;backdrop-filter:blur(18px);background:linear-gradient(180deg,rgba(7,17,31,.94),rgba(7,17,31,.74));border:1px solid rgba(148,163,184,.18);border-radius:28px;height:84px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 18px 60px rgba(2,8,23,.34);width:100%;margin-top:24px}
  .nh-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:-.03em;background:none;box-shadow:none}
  .nh-brand-mark{display:block;height:42px;width:auto;filter:none}
  .nh-brand-wordmark{display:flex;flex-direction:column;line-height:1}
  .nh-brand-name{display:flex;align-items:baseline;gap:0;font-size:22px;font-weight:900;letter-spacing:-.05em}
  .nh-brand-inline .nh-brand-name{white-space:nowrap}
  .nh-brand-inline .nh-brand-name .neural{color:#ffffff}
  .nh-brand-inline .nh-brand-name .hire{background:linear-gradient(135deg,#8b5cf6,#22c3ff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .nh-brand-tagline{font-size:11px;color:#97a8c5;margin-top:4px;letter-spacing:.12em;text-transform:uppercase}
  .nh-brand-compact .nh-brand-mark{height:40px}
  .nh-brand-compact .nh-brand-name{font-size:18px}
  .nh-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:18px;color:#c3d0eb;font-size:14px}
  .nh-nav a{color:inherit;text-decoration:none}
  .nh-cta{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;color:#fff;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 16px 30px rgba(37,99,235,.28),0 0 0 1px rgba(255,255,255,.08) inset}
  .nh-btns{display:flex;flex-wrap:wrap;gap:12px}
  .nh-btn-secondary{background:rgba(255,255,255,.08);border:1px solid rgba(191,219,254,.24);box-shadow:none}
  .nh-hero{min-height:calc(100vh - 120px);padding:18px 0 56px;display:block}
  .nh-hero-grid{display:grid;grid-template-columns:minmax(0,.48fr) minmax(0,.52fr);gap:32px;align-items:start}
  .nh-kicker{margin:2px 0 8px;text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:#8ab4ff;font-weight:800}
  .nh-title{margin:0;font-size:clamp(42px,4.45vw,68px);line-height:.98;letter-spacing:-.055em;color:#fff;max-width:12ch}
  .nh-title strong{color:transparent;background:linear-gradient(135deg,#b69cff,#61b3ff);-webkit-background-clip:text;background-clip:text}
  .nh-sub{margin:14px 0 18px;color:#bdd0f2;font-size:18px;line-height:1.7;max-width:500px}
  .nh-hero-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 8px}
  .nh-hero-card{padding:16px 18px;border-radius:18px;background:linear-gradient(180deg,rgba(12,20,38,.84),rgba(15,23,42,.72));border:1px solid rgba(148,163,184,.16);color:#edf4ff;font-size:14px;font-weight:700;box-shadow:0 14px 34px rgba(2,8,23,.18)}
  .nh-badges,.nh-metrics{display:flex;flex-wrap:wrap;gap:10px}
  .nh-pill,.nh-metric{background:rgba(9,19,37,.72);border:1px solid rgba(148,163,184,.18);border-radius:999px;color:#e8f0ff;padding:10px 14px;font-size:13px;box-shadow:0 10px 30px rgba(2,8,23,.14)}
  .nh-metric{border-radius:18px;background:#fff;color:#183153}
  .nh-metric strong{display:block;font-size:18px;margin-bottom:4px;color:#0f172a}
  .nh-panel{position:relative;background:
    radial-gradient(circle at 20% 0%,rgba(139,92,246,.16),transparent 28%),
    radial-gradient(circle at 88% 12%,rgba(34,195,255,.18),transparent 24%),
    linear-gradient(180deg,rgba(8,14,27,.96),rgba(10,17,32,.94));border:1px solid rgba(148,163,184,.18);border-radius:34px;padding:18px;box-shadow:0 30px 90px rgba(2,8,23,.5),0 0 0 1px rgba(255,255,255,.03) inset;align-self:start;overflow:hidden;transform:none;transform-origin:center}
  .nh-panel::before{content:'';position:absolute;inset:auto -12% -24% auto;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(34,195,255,.24),rgba(34,195,255,0) 68%);pointer-events:none;filter:blur(6px)}
  .nh-panel::after{content:'';position:absolute;inset:-1px;background:linear-gradient(135deg,rgba(139,92,246,.14),rgba(34,195,255,.05),rgba(37,211,102,.06));pointer-events:none;mask:linear-gradient(#000,transparent 88%)}
  .nh-dashboard{display:grid;grid-template-columns:minmax(420px,1fr) minmax(190px,220px);gap:14px;width:100%;max-width:100%;align-items:start}
  .nh-flow-stage{background:linear-gradient(180deg,rgba(13,20,37,.98),rgba(9,15,29,.94));border:1px solid rgba(148,163,184,.16);border-radius:28px;padding:20px;box-shadow:0 18px 44px rgba(2,8,23,.18);min-width:0}
  .nh-main-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}
  .nh-main-head h3{margin:0;color:#fff;font-size:20px;letter-spacing:-.03em}
  .nh-main-head span{color:#8fb0e6;font-size:12px}
  .nh-flow-list{display:grid;gap:12px}
  .nh-flow-bubble{position:relative;padding:16px 18px;border-radius:22px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.04));box-shadow:0 16px 32px rgba(2,8,23,.18),0 0 0 1px rgba(255,255,255,.03) inset;max-width:100%;overflow-wrap:anywhere}
  .nh-flow-bubble.client{border-top-left-radius:10px;background:linear-gradient(180deg,rgba(16,24,40,.98),rgba(18,28,47,.92))}
  .nh-flow-bubble.ai{border-top-right-radius:10px;background:linear-gradient(180deg,rgba(12,30,48,.96),rgba(10,24,40,.92))}
  .nh-flow-bubble.approval{border-top-left-radius:10px;background:linear-gradient(180deg,rgba(20,27,48,.98),rgba(15,23,42,.93))}
  .nh-flow-bubble.sent{border-top-right-radius:10px;background:linear-gradient(180deg,rgba(12,36,24,.96),rgba(10,28,20,.92))}
  .nh-flow-label{display:flex;align-items:center;gap:10px;margin-bottom:8px;color:#d8e5fb;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .nh-flow-label .dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#22c3ff);box-shadow:0 0 0 6px rgba(139,92,246,.12)}
  .nh-flow-text{color:#f4f7ff;font-size:15px;line-height:1.65;letter-spacing:-.01em}
  .nh-flow-text strong{font-weight:800}
  .nh-flow-checks{display:grid;gap:6px;margin:10px 0 12px;padding-left:2px}
  .nh-flow-check{display:flex;gap:8px;align-items:flex-start;color:#dbebff;font-size:13px;line-height:1.4}
  .nh-flow-check::before{content:'✓';color:#38d39f;font-weight:900;flex:0 0 auto}
  .nh-checklist{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));padding:22px 24px;border-radius:26px;background:linear-gradient(180deg,#ffffff,#f6f9ff);border:1px solid #dce7f6;box-shadow:0 18px 42px rgba(16,32,59,.08)}
  .nh-checklist-item{display:flex;gap:12px;align-items:flex-start;color:#17304f;font-size:15px;line-height:1.55;font-weight:700}
  .nh-checklist-item::before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:linear-gradient(135deg,#8b5cf6,#22c3ff);color:#fff;font-size:13px;flex:0 0 auto;box-shadow:0 8px 20px rgba(139,92,246,.18)}
  .nh-flow-suggest{margin-top:10px}
  .nh-flow-suggest-label{color:#67b8ff;font-size:12px;font-weight:700;margin-bottom:8px}
  .nh-flow-suggest-box{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.04);border-radius:14px;padding:12px 14px;color:#f5f8ff;line-height:1.55;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
  .nh-flow-action{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .nh-flow-button{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:12px 16px;font-weight:800;color:#fff;text-decoration:none;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 14px 28px rgba(37,99,235,.32),0 0 0 1px rgba(255,255,255,.08) inset}
  .nh-flow-time{color:#98b4db;font-size:12px}
  .nh-arrow-stack{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 0}
  .nh-arrow-stack span{display:block;color:#7aa6da;font-size:18px;line-height:1;opacity:.85;text-shadow:0 0 16px rgba(34,195,255,.35)}
  .nh-hero-preview-band{margin-top:20px;padding:18px;border-radius:28px;background:linear-gradient(180deg,rgba(10,16,30,.95),rgba(10,16,30,.86));border:1px solid rgba(148,163,184,.16);box-shadow:0 24px 70px rgba(2,8,23,.36);overflow:hidden}
  .nh-hero-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
  .nh-hero-preview-head h2{margin:0;color:#fff;font-size:20px;letter-spacing:-.03em}
  .nh-hero-preview-head p{margin:6px 0 0;color:#9eb6db;font-size:13px;line-height:1.5;max-width:68ch}
  .nh-hero-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .nh-hero-preview-card{position:relative;min-height:340px;border-radius:26px;padding:18px;overflow:hidden;border:1px solid rgba(148,163,184,.16);box-shadow:0 18px 44px rgba(2,8,23,.18)}
  .nh-hero-preview-card::before{content:'';position:absolute;inset:auto -10% -18% auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,195,255,.2),rgba(34,195,255,0) 68%);pointer-events:none;filter:blur(4px)}
  .nh-hero-preview-card::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.03),transparent 40%,rgba(255,255,255,.02));pointer-events:none}
  .nh-hero-preview-tag{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px}
  .nh-hero-preview-title{margin:0;color:#fff;font-size:24px;line-height:1.02;letter-spacing:-.05em}
  .nh-hero-preview-sub{margin:8px 0 0;color:#bbcff0;font-size:13px;line-height:1.55;max-width:32ch}
  .nh-hero-preview-list{display:grid;gap:10px;margin-top:18px}
  .nh-hero-preview-item{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.14);color:#ecf4ff;font-size:13px;line-height:1.45}
  .nh-hero-preview-item::before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:linear-gradient(135deg,#8b5cf6,#22c3ff);color:#fff;font-size:12px;font-weight:900;flex:0 0 auto;box-shadow:0 0 0 6px rgba(139,92,246,.12)}
  .nh-hero-preview-item strong{display:block;color:#fff}
  .nh-hero-preview-flow{display:grid;gap:12px;margin-top:18px}
  .nh-hero-preview-bubble{padding:14px 15px;border-radius:20px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.05);color:#f6f8ff;box-shadow:0 14px 24px rgba(2,8,23,.14)}
  .nh-hero-preview-bubble.client{background:linear-gradient(180deg,rgba(18,28,47,.96),rgba(12,20,34,.92))}
  .nh-hero-preview-bubble.ai{background:linear-gradient(180deg,rgba(11,28,44,.96),rgba(9,22,36,.92))}
  .nh-hero-preview-bubble.team{background:linear-gradient(180deg,rgba(22,28,50,.96),rgba(15,22,38,.92))}
  .nh-hero-preview-bubble.sent{background:linear-gradient(180deg,rgba(12,34,25,.96),rgba(10,26,19,.92))}
  .nh-hero-preview-label{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#d7e4fb;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
  .nh-hero-preview-label .dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#22c3ff);box-shadow:0 0 0 6px rgba(139,92,246,.1)}
  .nh-hero-preview-quote{font-size:13px;line-height:1.55;color:#f5f8ff}
  .nh-hero-preview-chiprow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .nh-hero-preview-chip{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(148,163,184,.14);color:#dfeaff;font-size:11px;font-weight:700}
  .nh-hero-preview-entity{display:flex;align-items:center;gap:10px}
  .nh-hero-preview-avatar{width:48px;height:48px;border-radius:16px;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.35),rgba(255,255,255,.08) 30%,rgba(255,255,255,0) 72%),linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 14px 30px rgba(37,99,235,.16),0 0 0 1px rgba(255,255,255,.18) inset;display:grid;place-items:center}
  .nh-hero-preview-avatar svg{width:28px;height:28px;display:block}
  .nh-hero-preview-entity strong{display:block;color:#fff;font-size:15px}
  .nh-hero-preview-entity span{display:block;color:#bdd0f2;font-size:12px;line-height:1.45}
  .nh-hero-preview-card.a{background:linear-gradient(180deg,rgba(9,15,27,.98),rgba(11,18,33,.94));box-shadow:0 24px 60px rgba(10,18,34,.32),0 0 0 1px rgba(255,255,255,.03) inset}
  .nh-hero-preview-card.b{background:linear-gradient(180deg,rgba(8,29,20,.96),rgba(7,20,15,.94));border-color:rgba(67,181,129,.16);box-shadow:0 24px 60px rgba(6,44,30,.24),0 0 0 1px rgba(255,255,255,.03) inset}
  .nh-hero-preview-card.c{background:linear-gradient(180deg,rgba(10,16,30,.98),rgba(8,14,26,.94));box-shadow:0 24px 60px rgba(8,16,33,.3),0 0 0 1px rgba(255,255,255,.03) inset}
  .nh-live-demo{position:relative;min-height:388px;border-radius:30px;padding:18px;overflow:hidden;border:1px solid rgba(148,163,184,.16);background:
    radial-gradient(circle at 18% 14%,rgba(139,92,246,.18),transparent 28%),
    radial-gradient(circle at 84% 10%,rgba(34,195,255,.16),transparent 24%),
    linear-gradient(180deg,rgba(7,12,24,.98),rgba(7,13,24,.9));box-shadow:0 28px 72px rgba(2,8,23,.34),0 0 0 1px rgba(255,255,255,.03) inset}
  .nh-live-demo::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent 28%,rgba(255,255,255,.02));pointer-events:none}
  .nh-live-demo::after{content:'';position:absolute;inset:auto 10% -22% 8%;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(37,211,102,.16),rgba(37,211,102,0) 68%);filter:blur(10px);pointer-events:none}
  .nh-live-demo__frame{position:relative;z-index:1;display:grid;grid-template-rows:auto auto 1fr;gap:14px;min-height:100%}
  .nh-live-demo__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .nh-live-demo__badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.2);color:#9cf1be;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .nh-live-demo__status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.14);color:#cfe0fb;font-size:12px;font-weight:700}
  .nh-live-demo__status-dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#22c3ff);box-shadow:0 0 0 6px rgba(139,92,246,.12)}
  .nh-live-demo__track{position:relative;display:grid;gap:12px;padding:6px 0 0}
  .nh-live-demo__rail{position:absolute;left:22px;top:12px;bottom:10px;width:2px;background:linear-gradient(180deg,rgba(34,195,255,.3),rgba(139,92,246,.24),rgba(37,211,102,.08));opacity:.9}
  .nh-live-demo__rail::after{content:'';position:absolute;left:-5px;top:0;width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#22c3ff,#8b5cf6);box-shadow:0 0 0 0 rgba(34,195,255,.3);animation:nh-live-pulse 2.4s ease-in-out infinite}
  .nh-live-demo__message{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:flex-start;padding:12px 14px 12px 10px;border-radius:22px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.045);box-shadow:0 16px 28px rgba(2,8,23,.14);opacity:.34;transform:translateY(10px) scale(.985);transition:opacity .55s ease,transform .55s ease,box-shadow .55s ease,border-color .55s ease}
  .nh-live-demo__message::before{content:'';width:12px;height:12px;border-radius:50%;margin:7px 0 0 10px;background:linear-gradient(135deg,#8b5cf6,#22c3ff);box-shadow:0 0 0 6px rgba(139,92,246,.12)}
  .nh-live-demo__message.is-active{opacity:1;transform:translateY(0) scale(1);border-color:rgba(148,163,184,.22)}
  .nh-live-demo__message.is-active .nh-live-demo__bubble{box-shadow:0 22px 36px rgba(2,8,23,.2)}
  .nh-live-demo__message.is-complete{opacity:1;transform:none}
  .nh-live-demo__message.is-complete::before{background:linear-gradient(135deg,#22c55e,#25d366);box-shadow:0 0 0 6px rgba(34,197,94,.12)}
  .nh-live-demo__message.is-hidden{display:none}
  .nh-live-demo__label{color:#cfe0fb;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}
  .nh-live-demo__bubble{display:inline-block;padding:13px 14px;border-radius:18px;color:#f6f8ff;line-height:1.5;font-size:13px;letter-spacing:-.01em;background:linear-gradient(180deg,rgba(16,24,40,.98),rgba(12,20,33,.94));border:1px solid rgba(148,163,184,.12);transition:box-shadow .55s ease,transform .55s ease}
  .nh-live-demo__bubble.client{background:linear-gradient(180deg,rgba(17,27,45,.98),rgba(13,21,36,.94))}
  .nh-live-demo__bubble.ai{background:linear-gradient(180deg,rgba(10,29,46,.98),rgba(8,22,37,.94))}
  .nh-live-demo__bubble.team{background:linear-gradient(180deg,rgba(21,28,50,.98),rgba(15,23,41,.94))}
  .nh-live-demo__bubble.sent{background:linear-gradient(180deg,rgba(11,38,27,.98),rgba(9,25,18,.94))}
  .nh-live-demo__bubble strong{font-weight:800}
  .nh-live-demo__checks{display:grid;gap:6px;margin-top:12px}
  .nh-live-demo__check{display:flex;gap:8px;align-items:flex-start;color:#d9e7fb;font-size:12px;line-height:1.45;opacity:.3;transform:translateX(-4px);transition:opacity .45s ease,transform .45s ease}
  .nh-live-demo__check::before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:rgba(34,197,94,.14);color:#53e3a6;font-size:11px;font-weight:900;flex:0 0 auto}
  .nh-live-demo__check.is-on{opacity:1;transform:translateX(0)}
  .nh-live-demo__suggest{margin-top:12px;padding:12px 13px;border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(148,163,184,.12);opacity:0;transform:translateY(8px);transition:opacity .45s ease,transform .45s ease}
  .nh-live-demo__suggest.is-visible{opacity:1;transform:translateY(0)}
  .nh-live-demo__suggest-label{color:#8db8ff;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}
  .nh-live-demo__suggest-text{color:#eff6ff;font-size:13px;line-height:1.55}
  .nh-live-demo__actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}
  .nh-live-demo__button{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:11px 14px;font-weight:800;font-size:13px;color:#fff;text-decoration:none;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 14px 28px rgba(37,99,235,.3),0 0 0 1px rgba(255,255,255,.08) inset;opacity:0;transform:translateY(6px) scale(.98);transition:opacity .45s ease,transform .45s ease}
  .nh-live-demo__button.is-visible{opacity:1;transform:translateY(0) scale(1)}
  .nh-live-demo__time{color:#9eb6db;font-size:12px}
  .nh-live-demo__approval{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:18px;background:linear-gradient(180deg,rgba(25,31,54,.96),rgba(15,22,38,.94));border:1px solid rgba(148,163,184,.12);margin-top:12px;opacity:0;transform:translateY(8px);transition:opacity .45s ease,transform .45s ease}
  .nh-live-demo__approval.is-visible{opacity:1;transform:translateY(0)}
  .nh-live-demo__approval strong{display:block;color:#fff;font-size:14px}
  .nh-live-demo__approval span{display:block;color:#a8bedf;font-size:12px;line-height:1.45}
  .nh-live-demo__approval-pill{padding:8px 12px;border-radius:999px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.2);color:#95edba;font-size:12px;font-weight:800}
  .nh-live-demo__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:2px;color:#8ea8d0;font-size:12px}
  .nh-live-demo__footer strong{color:#fff}
  .nh-live-demo__progress{position:relative;flex:1;height:8px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden}
  .nh-live-demo__progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#8b5cf6,#22c3ff,#25d366);box-shadow:0 0 24px rgba(34,195,255,.28);transition:width .45s ease}
  .nh-live-demo__tag{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.12);color:#cfe0fb;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .nh-live-demo__tag .dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#25d366,#16a34a);box-shadow:0 0 0 6px rgba(37,211,102,.1)}
  @keyframes nh-live-pulse{0%,100%{transform:translateY(0) scale(1);box-shadow:0 0 0 0 rgba(34,195,255,.25)}50%{transform:translateY(2px) scale(1.12);box-shadow:0 0 0 12px rgba(34,195,255,0)}}
  .nh-metrics-stack{display:grid;grid-template-columns:1fr;gap:12px;align-content:start;min-width:0}
  .nh-metric{position:relative;overflow:hidden;border-radius:22px;background:linear-gradient(180deg,rgba(17,24,39,.88),rgba(12,19,32,.94));border:1px solid rgba(148,163,184,.14);color:#e8f0ff;padding:18px;box-shadow:0 18px 44px rgba(2,8,23,.16);min-height:132px;display:flex;flex-direction:column;justify-content:center}
  .nh-metric::before{content:'';position:absolute;inset:auto -10% -18% auto;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(34,195,255,.16),rgba(34,195,255,0) 66%);pointer-events:none}
  .nh-metric strong{display:block;font-size:25px;line-height:1;color:#fff;letter-spacing:-.05em;margin-bottom:8px}
  .nh-metric span{display:block;font-size:13px;color:#a9bedf;line-height:1.45}
  .nh-kpi-grid,.nh-funnel-wrap{display:none}
  .nh-card{display:none}
  .nh-agents-list{display:grid;gap:10px}
  .nh-agent-item{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.08);min-width:0}
  .nh-dot{width:28px;height:28px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 0 0 6px rgba(255,255,255,.03),0 0 24px color-mix(in srgb, var(--c2) 28%, transparent)}
  .nh-agent-item strong,.nh-module strong{display:block;color:#fff;font-size:14px;margin-bottom:4px}
  .nh-agent-item span,.nh-module span,.nh-flow-msg{color:#b6c7e5;font-size:13px;line-height:1.55}
  .nh-statbar{margin-top:20px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
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
  @media (max-width: 1180px){
    .nh-hero-grid,.nh-dashboard,.nh-funnel-wrap,.nh-footer-grid,.nh-whatsapp-band{grid-template-columns:1fr}
    .nh-dashboard{max-width:100%}
    .nh-metrics-stack{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media (max-width: 1100px){
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow-shell,.nh-card-grid-2,.nh-hero-cards,.nh-metrics-stack{grid-template-columns:repeat(2,minmax(0,1fr))}
    .nh-hero-preview-grid{grid-template-columns:1fr}
  }
  @media (max-width: 720px){
    .nh-wrap{padding:0 20px}
    .nh-topbar{padding:0 18px;height:auto;min-height:76px}
    .nh-nav{display:none}
    .nh-hero{min-height:auto;padding:28px 0 20px}
    .nh-hero-grid{gap:24px}
    .nh-title{font-size:clamp(38px,11vw,48px);max-width:100%}
    .nh-sub{font-size:16px}
    .nh-kpi-grid,.nh-statbar,.nh-module-grid,.nh-grid-cards,.nh-flow-shell,.nh-form,.nh-card-grid-2{grid-template-columns:1fr}
    .nh-dashboard{max-width:100%;height:auto;min-height:0;grid-template-columns:1fr}
    .nh-panel{padding:12px}
    .nh-flow-stage{padding:14px}
    .nh-metrics-stack{grid-template-columns:1fr}
    .nh-funnel{height:190px}
    .nh-hero-preview-band{padding:14px}
    .nh-hero-preview-head{flex-direction:column}
    .nh-hero-preview-card{min-height:unset}
    .nh-live-demo{min-height:340px;padding:14px;border-radius:24px}
    .nh-live-demo__footer{flex-direction:column;align-items:flex-start}
    .nh-live-demo__actions{flex-direction:column;align-items:flex-start}
    .nh-live-demo__approval{flex-direction:column;align-items:flex-start}
  }
  @media (prefers-reduced-motion: reduce){
    .nh-live-demo__rail::after,.nh-live-demo__message,.nh-live-demo__bubble,.nh-live-demo__suggest,.nh-live-demo__button,.nh-live-demo__approval,.nh-live-demo__progress span{animation:none !important;transition:none !important}
    .nh-live-demo__message{opacity:1;transform:none}
    .nh-live-demo__check{opacity:1;transform:none}
    .nh-live-demo__suggest,.nh-live-demo__button,.nh-live-demo__approval{opacity:1;transform:none}
    .nh-live-demo__progress span{width:100%}
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

function buildLiveDemoHtml() {
  return `
    <div class="nh-live-demo" aria-label="Demonstração animada do fluxo de IA no WhatsApp com aprovação humana" data-live-demo>
      <div class="nh-live-demo__frame">
        <div class="nh-live-demo__top">
          <div class="nh-live-demo__badge">${premiumIcon('whatsapp', '#25d366', '#16a34a')}WhatsApp vivo</div>
          <div class="nh-live-demo__status" data-demo-status><span class="nh-live-demo__status-dot"></span><span data-demo-status-text>analisando...</span></div>
        </div>
        <div class="nh-live-demo__track">
          <div class="nh-live-demo__rail" aria-hidden="true"></div>
          <div class="nh-live-demo__message is-active" data-step="0">
            <div>
              <div class="nh-live-demo__label">Cliente</div>
              <div class="nh-live-demo__bubble client">“Me chama em 30 dias.”</div>
            </div>
          </div>
          <div class="nh-live-demo__message" data-step="1">
            <div>
              <div class="nh-live-demo__label">IA NeuralHire</div>
              <div class="nh-live-demo__bubble ai">Pedido de retomada detectado.</div>
              <div class="nh-live-demo__checks">
                <div class="nh-live-demo__check" data-check="0">Pedido de retomada detectado.</div>
                <div class="nh-live-demo__check" data-check="1">Retomada agendada para 03/07.</div>
              </div>
            </div>
          </div>
          <div class="nh-live-demo__message" data-step="2">
            <div>
              <div class="nh-live-demo__label">IA NeuralHire</div>
              <div class="nh-live-demo__bubble ai">Mensagem sugerida pronta.</div>
              <div class="nh-live-demo__suggest" data-suggest>
                <div class="nh-live-demo__suggest-label">Mensagem sugerida</div>
                <div class="nh-live-demo__suggest-text">Olá! Conforme combinado, estou retomando nosso contato para te ajudar no próximo passo.</div>
                <div class="nh-live-demo__actions">
                  <button class="nh-live-demo__button" type="button" data-approve-btn>Aprovar mensagem</button>
                  <span class="nh-live-demo__time">10:32</span>
                </div>
              </div>
            </div>
          </div>
          <div class="nh-live-demo__approval" data-approval>
            <div>
              <strong>Equipe</strong>
              <span>Aprovado.</span>
            </div>
            <div class="nh-live-demo__approval-pill">Aprovação humana</div>
          </div>
          <div class="nh-live-demo__message" data-step="3">
            <div>
              <div class="nh-live-demo__label">WhatsApp</div>
              <div class="nh-live-demo__bubble sent">Mensagem enviada.</div>
              <div class="nh-live-demo__checks">
                <div class="nh-live-demo__check" data-check="2">WhatsApp entregue.</div>
                <div class="nh-live-demo__check" data-check="3">Cliente reativado.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="nh-live-demo__footer">
          <span><strong data-demo-caption>Fluxo em execução</strong></span>
          <div class="nh-live-demo__progress" aria-hidden="true"><span data-demo-progress></span></div>
          <span class="nh-live-demo__tag"><span class="dot"></span>Loop silencioso</span>
        </div>
      </div>
    </div>
  `;
}

function buildDashboardHtml() {
  return `
    <div class="nh-panel" aria-label="IA em ação">
      <div class="nh-dashboard">
        <section class="nh-flow-stage">
          <div class="nh-main-head">
            <div>
              <h3>IA em ação</h3>
              <span>NeuralHire acompanhando, retomando e vendendo pelo WhatsApp</span>
            </div>
            <span style="color:#7dd3fc;font-weight:700">Ao vivo</span>
          </div>
          <div class="nh-flow-list">
            <div class="nh-flow-bubble client">
              <div class="nh-flow-label">${premiumIcon('whatsapp', '#25d366', '#16a34a')}Cliente</div>
              <div class="nh-flow-text">“Me chama em 30 dias.”</div>
            </div>
            <div class="nh-arrow-stack" aria-hidden="true"><span>↓</span><span>↓</span><span>↓</span></div>
            <div class="nh-flow-bubble ai">
              <div class="nh-flow-label"><span class="dot"></span>IA NeuralHire</div>
              <div class="nh-flow-text">“Retomada criada para 03/07.”</div>
              <div class="nh-flow-checks">
                <div class="nh-flow-check">Cliente pausado identificado</div>
                <div class="nh-flow-check">Retomada agendada para 03/07</div>
                <div class="nh-flow-check">Canal: WhatsApp</div>
              </div>
              <div class="nh-flow-suggest">
                <div class="nh-flow-suggest-label">Mensagem sugerida:</div>
                <div class="nh-flow-suggest-box">Olá! Tudo bem? Conforme combinado, estou retornando para saber como posso ajudar.</div>
                <div class="nh-flow-action">
                  <a class="nh-flow-button" href="#lista">Aprovar mensagem</a>
                  <span class="nh-flow-time">10:32</span>
                </div>
              </div>
            </div>
            <div class="nh-arrow-stack" aria-hidden="true"><span>↓</span><span>↓</span><span>↓</span></div>
            <div class="nh-flow-bubble approval">
              <div class="nh-flow-label">${premiumIcon('dashboard', '#8b5cf6', '#22c3ff')}Equipe</div>
              <div class="nh-flow-text">“Aprovado.”</div>
            </div>
            <div class="nh-arrow-stack" aria-hidden="true"><span>↓</span><span>↓</span><span>↓</span></div>
            <div class="nh-flow-bubble sent">
              <div class="nh-flow-label">${premiumIcon('whatsapp', '#25d366', '#16a34a')}Mensagem enviada</div>
              <div class="nh-flow-checks">
                <div class="nh-flow-check">WhatsApp entregue</div>
                <div class="nh-flow-check">Lido pelo cliente</div>
              </div>
            </div>
          </div>
        </section>
        <aside class="nh-metrics-stack" aria-label="Métricas da IA">
          <div class="nh-metric"><strong>87</strong><span>oportunidades monitoradas</span></div>
          <div class="nh-metric"><strong>32</strong><span>clientes recuperados</span></div>
          <div class="nh-metric"><strong>14</strong><span>pedidos iniciados</span></div>
          <div class="nh-metric"><strong>R$ 18.700</strong><span>recuperados</span></div>
        </aside>
      </div>
    </div>
  `;
}

function buildPreviewCardA() {
  return `
    <article class="nh-hero-preview-card a">
      <div class="nh-hero-preview-tag" style="background:rgba(139,92,246,.14);color:#c9b7ff;border:1px solid rgba(139,92,246,.22)">Opção A · IA trabalhando</div>
      <h3 class="nh-hero-preview-title">NeuralHire acompanhando a operação em tempo real</h3>
      <p class="nh-hero-preview-sub">Um card dark premium com sensação de processamento inteligente, sem cair em dashboard ou gráfico.</p>
      <div class="nh-hero-preview-list">
        <div class="nh-hero-preview-item">Monitorando clientes...</div>
        <div class="nh-hero-preview-item">Analisando oportunidades...</div>
        <div class="nh-hero-preview-item">Detectando retomadas...</div>
        <div class="nh-hero-preview-item">Preparando mensagem...</div>
        <div class="nh-hero-preview-item">Aguardando aprovação...</div>
        <div class="nh-hero-preview-item">Mensagem enviada...</div>
      </div>
    </article>
  `;
}

function buildPreviewCardB() {
  return `
    <article class="nh-hero-preview-card b">
      <div class="nh-hero-preview-tag" style="background:rgba(37,211,102,.14);color:#7ff0b0;border:1px solid rgba(37,211,102,.24)">Opção B · WhatsApp vivo</div>
      <h3 class="nh-hero-preview-title">O produto em ação, com aprovação humana visível</h3>
      <p class="nh-hero-preview-sub">A leitura comercial mais direta: cliente pede retorno, IA prepara, equipe aprova e o WhatsApp entrega.</p>
      <div class="nh-hero-preview-flow">
        <div class="nh-hero-preview-bubble client">
          <div class="nh-hero-preview-label"><span class="dot"></span>Cliente</div>
          <div class="nh-hero-preview-quote">“Me chama em 30 dias.”</div>
        </div>
        <div class="nh-hero-preview-bubble ai">
          <div class="nh-hero-preview-label"><span class="dot"></span>IA NeuralHire</div>
          <div class="nh-hero-preview-quote">Pedido de retomada detectado. Mensagem preparada para aprovação.</div>
        </div>
        <div class="nh-hero-preview-bubble team">
          <div class="nh-hero-preview-label"><span class="dot"></span>Equipe</div>
          <div class="nh-hero-preview-quote">Aprovado.</div>
        </div>
        <div class="nh-hero-preview-bubble sent">
          <div class="nh-hero-preview-label"><span class="dot"></span>WhatsApp</div>
          <div class="nh-hero-preview-quote">Mensagem enviada e entregue.</div>
        </div>
      </div>
      <div class="nh-hero-preview-chiprow">
        <span class="nh-hero-preview-chip">Aprovação humana</span>
        <span class="nh-hero-preview-chip">Retomada comercial</span>
        <span class="nh-hero-preview-chip">WhatsApp nativo</span>
      </div>
    </article>
  `;
}

function buildPreviewCardC() {
  return `
    <article class="nh-hero-preview-card c">
      <div class="nh-hero-preview-tag" style="background:rgba(34,197,94,.12);color:#9ff4bf;border:1px solid rgba(34,197,94,.18)">Opção C · Agente comercial IA</div>
      <div class="nh-hero-preview-entity">
        <div class="nh-hero-preview-avatar" style="--c1:#8b5cf6;--c2:#22c3ff">${iconSvg('cs')}</div>
        <div>
          <strong>Agente comercial digital</strong>
          <span>Uma presença abstrata, moderna e B2B para humanizar a IA sem cartoon.</span>
        </div>
      </div>
      <div class="nh-hero-preview-list">
        <div class="nh-hero-preview-item">Reativando cliente</div>
        <div class="nh-hero-preview-item">Enviando catálogo</div>
        <div class="nh-hero-preview-item">Preparando follow-up</div>
        <div class="nh-hero-preview-item">Solicitando aprovação</div>
        <div class="nh-hero-preview-item">Recuperando oportunidade</div>
      </div>
      <div class="nh-hero-preview-chiprow">
        <span class="nh-hero-preview-chip">Premium</span>
        <span class="nh-hero-preview-chip">Moderno</span>
        <span class="nh-hero-preview-chip">B2B</span>
      </div>
    </article>
  `;
}

function buildHeroPreviewHtml(mode) {
  const previewMap = {
    a: buildPreviewCardA(),
    b: buildPreviewCardB(),
    c: buildPreviewCardC(),
  };
  if (mode && previewMap[mode]) {
    return `
      <div class="nh-hero-preview-band">
        <div class="nh-hero-preview-head">
          <div>
            <h2>Preview visual da primeira dobra</h2>
            <p>Modo local de comparação para escolher a melhor ocupação do espaço do hero sem alterar a landing principal.</p>
          </div>
        </div>
        <div class="nh-hero-preview-grid">
          ${previewMap[mode]}
        </div>
      </div>
    `;
  }
  return `
    <div class="nh-hero-preview-band">
      <div class="nh-hero-preview-head">
        <div>
          <h2>Preview visual da primeira dobra</h2>
          <p>Três leituras possíveis para ocupar o espaço vazio abaixo dos CTAs: IA trabalhando, WhatsApp vivo e agente comercial IA.</p>
        </div>
      </div>
      <div class="nh-hero-preview-grid">
        ${buildPreviewCardA()}
        ${buildPreviewCardB()}
        ${buildPreviewCardC()}
      </div>
    </div>
  `;
}

function buildLandingHtml() {
  return `
    <main class="nh-landing">
      <div class="nh-wrap">
        <header class="nh-topbar">
          <a class="nh-brand nh-brand-inline" href="#/" aria-label="NeuralHire">
            <img class="nh-brand-mark" src="/brand/neuralhire-mark-app-icon.svg" alt="" aria-hidden="true">
            <span class="nh-brand-wordmark">
              <span class="nh-brand-name"><span class="neural">Neural</span><span class="hire">Hire</span></span>
            </span>
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
              <h1 class="nh-title">Agentes de IA <strong>que vendem junto com sua equipe.</strong></h1>
              <p class="nh-sub">IA comercial operando clientes pelo WhatsApp com aprovação humana. A plataforma entra para sustentar a operação depois.</p>
              <div class="nh-hero-cards" aria-label="Diferenciais da primeira dobra">
                <div class="nh-hero-card">🧠 Follow-up Inteligente</div>
                <div class="nh-hero-card">📈 Reativação Automática</div>
                <div class="nh-hero-card">💬 WhatsApp Integrado</div>
                <div class="nh-hero-card">⚡ Aprovação Humana</div>
              </div>
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
              ${buildLiveDemoHtml()}
            </div>

            ${buildDashboardHtml()}
          </div>
          <div style="margin-top:22px">
            <h2 style="margin:0 0 18px;font-size:clamp(24px,2.4vw,36px);line-height:1.1;letter-spacing:-.04em;color:#081225">O que a IA faz sozinha?</h2>
            <div class="nh-checklist" aria-label="O que a IA faz sozinha">
              <div class="nh-checklist-item">Detecta clientes esquecidos</div>
              <div class="nh-checklist-item">Agenda retomadas</div>
              <div class="nh-checklist-item">Sugere mensagens</div>
              <div class="nh-checklist-item">Reativa oportunidades</div>
              <div class="nh-checklist-item">Solicita aprovação quando necessário</div>
              <div class="nh-checklist-item">Entrega tudo no WhatsApp</div>
            </div>
          </div>
          <div style="margin-top:22px">
            <h2 style="margin:0 0 14px;font-size:clamp(24px,2.4vw,36px);line-height:1.1;letter-spacing:-.04em;color:#081225">Resultados monitorados pela IA</h2>
          </div>
          <div class="nh-statbar">
            <div class="nh-metric"><strong>+50%</strong>mais oportunidades identificadas</div>
            <div class="nh-metric"><strong>24h</strong>monitoramento dos clientes</div>
            <div class="nh-metric"><strong>100%</strong>WhatsApp integrado</div>
            <div class="nh-metric"><strong>15 dias</strong>gratuitos no lançamento</div>
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
                  <div class="step">${premiumIcon('dashboard', '#22c55e', '#14b8a6')}<span>3</span>Equipe aprova</div>
                  <div class="body">Equipe valida a mensagem, ajusta o tom e libera o envio com governança.</div>
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

        <section class="nh-section" id="agentes">
          <h2>Seu vendedor continua vendendo. Os agentes cuidam do resto.</h2>
          <p class="lead">Agentes inteligentes executando trabalho comercial real para prospectar, retomar, acompanhar e manter a operação em movimento.</p>
          <div class="nh-grid-cards">
            ${agentCards.map(renderIconCard).join('')}
          </div>
        </section>

        <section class="nh-section" id="modulos">
          <h2>Uma operação comercial inteira, orquestrada por IA.</h2>
          <p class="lead">CRM, pedidos, catálogo, aprovação, WhatsApp e inteligência comercial trabalhando juntos para sua equipe.</p>
          <div class="nh-module-grid">
            ${moduleCards.map(renderIconCard).join('')}
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
          <a class="nh-brand nh-brand-compact nh-brand-inline" href="#/" aria-label="NeuralHire" style="margin-bottom:12px;color:#081225">
                <img class="nh-brand-mark" src="/brand/neuralhire-mark-app-icon.svg" alt="" aria-hidden="true">
                <span class="nh-brand-wordmark">
                  <span class="nh-brand-name"><span class="neural">Neural</span><span class="hire">Hire</span></span>
                </span>
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
  const liveDemo = container.querySelector('[data-live-demo]');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
  if (liveDemo) {
    const statusText = liveDemo.querySelector('[data-demo-status-text]');
    const caption = liveDemo.querySelector('[data-demo-caption]');
    const progress = liveDemo.querySelector('[data-demo-progress]');
    const approval = liveDemo.querySelector('[data-approval]');
    const suggest = liveDemo.querySelector('[data-suggest]');
    const approveBtn = liveDemo.querySelector('[data-approve-btn]');
    const steps = Array.from(liveDemo.querySelectorAll('.nh-live-demo__message'));
    const checks = Array.from(liveDemo.querySelectorAll('.nh-live-demo__check'));
    const sequence = [
      { active: [0], completed: [], visibleChecks: [], status: 'analisando...', caption: 'Cliente iniciou o fluxo', progress: 18 },
      { active: [1], completed: [0], visibleChecks: [0], status: 'detectando intenção...', caption: 'IA detectou retomada', progress: 38 },
      { active: [2], completed: [0, 1], visibleChecks: [0, 1], status: 'pronto para aprovação', caption: 'Mensagem pronta para aprovação', progress: 62, showSuggest: true },
      { active: [], completed: [0, 1, 2], visibleChecks: [0, 1], status: 'aguardando aprovação', caption: 'Equipe revisando', progress: 76, showApproval: true, showBtn: true },
      { active: [3], completed: [0, 1, 2, 3], visibleChecks: [0, 1, 2, 3], status: 'enviado', caption: 'WhatsApp entregue', progress: 100, showSent: true },
    ];
    const applyState = (state) => {
      steps.forEach((step, index) => {
        step.classList.toggle('is-active', state.active.includes(index));
        step.classList.toggle('is-complete', state.completed.includes(index));
        step.classList.toggle('is-hidden', state.active.length > 0 ? !state.active.includes(index) && !state.completed.includes(index) : index !== 3);
      });
      checks.forEach((check, index) => check.classList.toggle('is-on', state.visibleChecks.includes(index)));
      approval?.classList.toggle('is-visible', !!state.showApproval);
      suggest?.classList.toggle('is-visible', !!state.showSuggest);
      approveBtn?.classList.toggle('is-visible', !!state.showBtn);
      if (statusText) statusText.textContent = state.status;
      if (caption) caption.textContent = state.caption;
      if (progress) progress.style.width = `${state.progress}%`;
      if (state.showApproval && approveBtn) approveBtn.focus?.({ preventScroll: true });
    };
    if (reducedMotion) {
      applyState({ active: [0, 1, 2, 3], completed: [0, 1, 2, 3], visibleChecks: [0, 1, 2, 3], status: 'enviado', caption: 'WhatsApp entregue', progress: 100, showApproval: true, showSuggest: true, showBtn: true });
    } else {
      let timer = 0;
      const run = (index = 0) => {
        applyState(sequence[index]);
        const delays = [1400, 1400, 1400, 1600, 2000];
        if (index < sequence.length - 1) {
          timer = window.setTimeout(() => run(index + 1), delays[index]);
        } else {
          timer = window.setTimeout(() => run(0), 1600);
        }
      };
      timer = window.setTimeout(() => run(0), 500);
      window.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          window.clearTimeout(timer);
        }
      }, { passive: true });
    }
  }
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
