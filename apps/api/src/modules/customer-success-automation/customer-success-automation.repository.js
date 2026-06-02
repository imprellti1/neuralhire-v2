import { getCustomerSuccess } from '../customer-success/customer-success.repository.js';
function daysBetween(a,b){return Math.floor((new Date(b)-new Date(a))/86400000);}
function mk(id,tipo,titulo,descricao,severidade,playbook){return {id,tipo,titulo,descricao,severidade,playbook};}
export async function getCustomerSuccessAutomation(accountId){
  const cs = await getCustomerSuccess(accountId);
  const now='2026-06-01';
  const milestones=[{nome:'Kickoff',ultimaEvolucao:'2026-05-10'}];
  const semPedidos = cs?.adocaoModulos?.pedidos===false;
  const alertas=[]; const playbooks=[];
  if((cs.healthScore<50)||cs.riscoChurn==='Alto'||cs.riscoChurn==='Critico'){ alertas.push(mk('a1','risco','Conta em risco','Health score baixo ou churn elevado.','alta','PB-001')); playbooks.push('PB-001'); }
  if(milestones.some((m)=>daysBetween(m.ultimaEvolucao,now)>15)){ alertas.push(mk('a2','risco','Implantacao parada','Milestone sem evolucao ha mais de 15 dias.','media','PB-002')); playbooks.push('PB-002'); }
  if((cs.engajamento||0)<30){ alertas.push(mk('a3','risco','Baixo engajamento','Engajamento abaixo de 30%.','alta','PB-003')); playbooks.push('PB-003'); }
  if(semPedidos){ alertas.push(mk('a4','risco','Sem pedidos','Nenhum pedido criado.','media','PB-004')); playbooks.push('PB-004'); }
  if((cs.healthScore||0)>80 && cs.riscoChurn==='Baixo'){ alertas.push(mk('a5','oportunidade','Conta saudavel','Sugerir expansao comercial.','baixa','PB-005')); playbooks.push('PB-005'); }
  const count=(sev)=>alertas.filter((x)=>x.severidade===sev).length;
  return {accountId,totalAlertas:alertas.length,criticos:count('critica'),altos:count('alta'),medios:count('media'),baixos:count('baixa'),playbooks:[...new Set(playbooks)],alertas};
}
