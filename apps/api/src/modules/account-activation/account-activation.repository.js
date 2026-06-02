import { listClientes } from '../clientes/clientes.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { getOnboarding } from '../onboarding/onboarding.repository.js';
const steps=['empresaConfigurada','vendedoresCadastrados','clientesImportados','produtosImportados','pedidosImportados','dashboardDisponivel'];
const pct=(s)=>Math.round((steps.filter((k)=>Boolean(s[k])).length/steps.length)*100);
export async function getActivationStatus(accountId){
  const onboarding=getOnboarding(accountId)||null;
  const [clientes,produtos,pedidos]=await Promise.all([listClientes({}, { accountId }),listProdutos({}, { accountId }),listPedidos({}, { accountId })]);
  const status={empresaConfigurada:Boolean(onboarding?.company_profile&&Object.keys(onboarding.company_profile).length),vendedoresCadastrados:Array.isArray(onboarding?.team_profile?.vendedores)?onboarding.team_profile.vendedores.length>0:Boolean(onboarding?.team_profile&&Object.keys(onboarding.team_profile).length),clientesImportados:(clientes?.items||[]).length>0,produtosImportados:(produtos?.items||[]).length>0,pedidosImportados:(pedidos?.items||[]).length>0,dashboardDisponivel:Boolean(onboarding?.status==='completed'||(pedidos?.items||[]).length>0)};
  return { ...status, percentual:pct(status) };
}
