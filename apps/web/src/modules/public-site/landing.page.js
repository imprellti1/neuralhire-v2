export function renderPublicLandingPage(container, { apiClient } = {}) {
  container.innerHTML = `<div><h1>A nova geração da representação comercial chegou.</h1><p>Agentes Comerciais de IA</p><p>15 dias grátis</p><a href="#lista">Entrar na Lista de Interesse</a><section id="lista"><form id="interest-form"><input name="nome"><input name="empresa"><input name="whatsapp"><input name="email"><input name="segmento"><input name="vendedores"><input name="cidadeUf"><button id="interest-submit" type="submit">Quero entrar na lista de interesse</button><div id="interest-feedback" aria-live="polite"></div></form></section><p>Pré-lançamento sem contratação direta, sem checkout e com 15 dias grátis no lançamento.</p></div>`;
  let submitting = false;
  container.querySelector('#interest-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget; const feedback = container.querySelector('#interest-feedback'); const submitButton = container.querySelector('#interest-submit');
    const nome = String(form.querySelector('input[name="nome"]')?.value || '').trim(); const empresa = String(form.querySelector('input[name="empresa"]')?.value || '').trim(); const whatsapp = String(form.querySelector('input[name="whatsapp"]')?.value || '').trim(); const email = String(form.querySelector('input[name="email"]')?.value || '').trim();
    if (!nome || !empresa || (!whatsapp && !email)) { feedback.textContent = 'Preencha Nome, Empresa e pelo menos WhatsApp ou E-mail.'; return; }
    try { submitting = true; submitButton.disabled = true; feedback.textContent = 'Enviando seu interesse...'; await apiClient.post('/interest-leads', { nome, empresa, whatsapp, email }); feedback.textContent = 'Interesse registrado com sucesso. Avisaremos quando o acesso antecipado estiver disponível.'; form.reset(); } catch (error) { feedback.textContent = error?.message || 'Nao foi possivel registrar agora. Tente novamente em instantes.'; } finally { submitting = false; submitButton.disabled = false; }
  });
}
