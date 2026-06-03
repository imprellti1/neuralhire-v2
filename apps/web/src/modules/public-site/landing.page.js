export function renderPublicLandingPage(container, { apiClient } = {}) {
  container.innerHTML = `<main style="font-family:Inter,Segoe UI,Arial,sans-serif;background:linear-gradient(180deg,#f7fbff 0%,#eef4ff 100%);min-height:100vh;color:#10203b"><section style="max-width:1120px;margin:0 auto;padding:72px 20px 40px"><div style="display:grid;grid-template-columns:1.2fr .8fr;gap:28px;align-items:start"><div><p style="letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:#3357b8;font-weight:700;margin:0 0 14px">NeuralHire</p><h1 style="font-size:clamp(38px,7vw,72px);line-height:.95;margin:0 0 18px;max-width:12ch">A nova geração da representação comercial chegou.</h1><p style="font-size:20px;line-height:1.6;color:#425470;max-width:52ch;margin:0 0 24px">Agentes Comerciais de IA. Site institucional da NeuralHire com lista de interesse, lançamento com 15 dias grátis e agentes comerciais via WhatsApp, sem contratação direta neste momento.</p><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px"><a href="#lista" style="padding:14px 18px;border-radius:999px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700">Entrar na lista de interesse</a><a href="https://wa.me/" target="_blank" rel="noreferrer" style="padding:14px 18px;border-radius:999px;background:#fff;color:#1d4ed8;text-decoration:none;font-weight:700;border:1px solid #bfd0ff">Falar no WhatsApp</a></div><ul style="display:grid;gap:10px;padding:0;margin:0;list-style:none;color:#33415f"><li>Lista de interesse registrada na API real</li><li>15 dias grátis no lançamento</li><li>Módulos prontos para CRM, Produtos, Fábricas e WhatsApp</li><li>Sem demo mode, sem memory mode e sem contratação direta</li></ul></div><aside style="background:#fff;border-radius:28px;padding:24px;box-shadow:0 18px 44px rgba(16,32,59,.12);border:1px solid #d8e4fb"><h2 style="margin-top:0">Módulos da v2</h2><div style="display:grid;gap:10px;font-size:14px;color:#40506e"><span>Lista de Interesse</span><span>Clientes CRM</span><span>Fábricas</span><span>Produtos</span><span>Pedido Comercial</span><span>WhatsApp e Aprovações</span><span>Customer Success</span></div></aside></div><section id="lista" style="margin-top:36px;background:#fff;border-radius:28px;padding:24px;box-shadow:0 18px 44px rgba(16,32,59,.08)"><h2 style="margin-top:0">Entrar na lista de interesse</h2><p style="color:#566583">Deixe seus dados para receber o acesso antecipado quando o lançamento estiver pronto.</p><form id="interest-form" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><input name="nome" placeholder="Nome" required><input name="empresa" placeholder="Empresa" required><input name="whatsapp" placeholder="WhatsApp"><input name="email" placeholder="E-mail" type="email"><input name="segmento" placeholder="Segmento"><input name="vendedores" placeholder="Qtd. vendedores"><input name="cidadeUf" placeholder="Cidade/UF" style="grid-column:1/-1"><button id="interest-submit" type="submit" style="grid-column:1/-1;padding:14px 18px;border:0;border-radius:16px;background:#102a5b;color:#fff;font-weight:700">Quero entrar na lista de interesse</button><div id="interest-feedback" aria-live="polite" style="grid-column:1/-1;min-height:22px;color:#b42318"></div></form></section><p style="margin:18px 0 0;color:#62708d">Pré-lançamento sem checkout, sem contratação direta e com operação migrada para a API real.</p></section></main>`;
  let submitting = false;
  container.querySelector('#interest-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
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
