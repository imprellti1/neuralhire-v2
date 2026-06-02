import { renderRetentionPage } from './retention.page.js';
import { assert, assertEqual } from '../../testing/frontend-test-helpers.js';

function createApiClient(result, fail=false){ return { get: async ()=>{ if(fail) throw new Error('fail'); return result; } }; }

export async function run(){
  const c=document.createElement('div');
  await renderRetentionPage(c,{apiClient:createApiClient({item:{renovacao:{classificacao:'atencao',diasRestantes:10},expansaoScore:84,expansaoFaixa:'Excelente',churnPreventivo:'Baixo',acoes:[{tipo:'expansao',descricao:'Oferecer plano superior.'}]}})});
  assert(c.textContent.includes('Renovacoes & Expansao'));
  assert(c.querySelector('table'));
  assert(c.textContent.includes('Score de Expansao'));
  const c2=document.createElement('div');
  await renderRetentionPage(c2,{apiClient:createApiClient(null,true)});
  assert(c2.textContent.includes('Erro ao carregar'));
  c2.querySelector('#ret-retry')?.click();
  assertEqual(typeof c2.innerHTML,'string');
}
