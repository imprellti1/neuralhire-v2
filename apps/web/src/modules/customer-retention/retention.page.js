import { getRetention } from './retention.service.js';
import { mapRetention } from './retention.mapper.js';
import { createRetentionState } from './retention.state.js';

export async function renderRetentionPage(container,{apiClient}){
  const state=createRetentionState(); const acct='acc-demo';
  const render=()=>{
    if(state.loading){container.innerHTML='<section><h1>Renovacoes & Expansao</h1><p>Carregando...</p></section>'; return;}
    if(state.error){container.innerHTML='<section><h1>Renovacoes & Expansao</h1><p>Erro ao carregar</p><button id="ret-retry">Tentar novamente</button></section>'; container.querySelector('#ret-retry')?.addEventListener('click',load); return;}
    const d=state.data||{}; const acoes=(d.acoes||[]).map((a)=>`<li>${a.tipo}: ${a.descricao}</li>`).join('');
    container.innerHTML=`<section><h1>Renovacoes & Expansao</h1><div>Renovacao: ${d.renovacao?.classificacao||'-'} (${d.renovacao?.diasRestantes??'-'} dias)</div><div>Score de Expansao: ${d.expansaoScore??'-'} (${d.expansaoFaixa||'-'})</div><div>Churn Preventivo: ${d.churnPreventivo||'-'}</div><div>Proximas Acoes</div><ul>${acoes}</ul><table><thead><tr><th>Conta</th><th>Renovacao</th><th>Oportunidade</th><th>Acoes</th></tr></thead><tbody><tr><td>${acct}</td><td>${d.renovacao?.classificacao||'-'}</td><td>${d.expansaoFaixa||'-'}</td><td>${(d.acoes||[]).length}</td></tr></tbody></table></section>`;
  };
  const load=async()=>{state.loading=true;state.error=null;render(); try{state.data=mapRetention(await getRetention(apiClient,acct));}catch(e){state.error=e;} finally{state.loading=false;render();}};
  await load();
}
