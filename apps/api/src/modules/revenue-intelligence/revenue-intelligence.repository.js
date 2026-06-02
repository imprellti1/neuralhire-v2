import { getExecutiveDashboard } from '../executive-dashboard/executive-dashboard.repository.js';
import { getCustomerRetention } from '../customer-retention/customer-retention.repository.js';
import { getCustomerSuccess } from '../customer-success/customer-success.repository.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const scoreBand=(s)=>s<=25?'Critico':s<=50?'Atencao':s<=75?'Saudavel':'Excelente';
export async function getRevenueIntelligence(accountId){
  const exec=await getExecutiveDashboard(accountId); const ret=await getCustomerRetention(accountId); const cs=await getCustomerSuccess(accountId);
  const baseMRR=9900; const mrr=baseMRR + (ret.expansaoScore||0)*25;
  const receita30=Math.round(mrr*1.2); const receita60=Math.round(receita30*2); const receita90=Math.round(receita30*3);
  const riskFactor=(exec.billing?.contasVencidas?0.18:0.06)+(cs.riscoChurn==='Alto'?0.1:0.02)+(ret.churnPreventivo==='Critico'?0.15:ret.churnPreventivo==='Alto'?0.1:0.04);
  const receitaEmRisco=Math.round(mrr*clamp(riskFactor,0,0.55));
  const expansaoPotencial=Math.round(mrr*clamp((ret.expansaoScore||0)/200,0.05,0.45));
  const churnProjetado=Number(clamp((100-(cs.healthScore||0))/8 + (ret.churnPreventivo==='Critico'?2.5:ret.churnPreventivo==='Alto'?1.5:0.6),0.5,18).toFixed(1));
  const growthScore=clamp(Math.round((clamp(mrr/220,0,100)+clamp(expansaoPotencial/120,0,100)+clamp(receita90/450,0,100)+(100-churnProjetado*4))/4),0,100);
  return { accountId,mrr,receita30,receita60,receita90,receitaEmRisco,expansaoPotencial,churnProjetado,growthScore,classificacao:scoreBand(growthScore) };
}
