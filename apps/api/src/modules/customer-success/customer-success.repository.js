function pct(part,total){ if(!total||total<=0) return 0; return Math.round((part/total)*100); }
export async function getCustomerSuccess(accountId){
  const usuariosTotal=5, usuariosAtivos=3, engajamento=pct(usuariosAtivos,usuariosTotal);
  const score=Math.round((80*25 + 85*20 + 60*20 + 70*10 + engajamento*15 + engajamento*10)/100);
  const classificacao=score<=25?'Critico':score<=50?'Atencao':score<=75?'Saudavel':'Excelente';
  const riscoChurn=score<50?'Alto':'Baixo';
  const adocaoModulos={clientes:true,produtos:true,pedidos:false,onboarding:true,ativacao:true,ttv:true};
  const adocao=Math.round((Object.values(adocaoModulos).filter(Boolean).length/Object.keys(adocaoModulos).length)*100);
  const alertas=[]; if(!adocaoModulos.pedidos) alertas.push({tipo:'risco',mensagem:'Nenhum pedido criado.'});
  return { accountId, healthScore:score, classificacao, riscoChurn, engajamento, usuariosAtivos, usuariosTotal, adocao, adocaoModulos, alertas };
}
