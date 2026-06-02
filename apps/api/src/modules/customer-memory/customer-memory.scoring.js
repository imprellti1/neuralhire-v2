export function scoreCustomerMemory(memory) {
  const diasSemCompra = Number(memory?.commercial?.diasSemCompra ?? 0);
  const totalPedidos = Number(memory?.commercial?.totalPedidos ?? 0);
  const totalComprado = Number(memory?.commercial?.totalComprado ?? 0);
  const ticketMedio = Number(memory?.commercial?.ticketMedio ?? 0);

  let risk = 'baixo';
  if (diasSemCompra >= 180) risk = 'alto';
  else if (diasSemCompra >= 90) risk = 'medio';

  let frequenciaCompra = 'baixa';
  if (totalPedidos >= 12) frequenciaCompra = 'alta';
  else if (totalPedidos >= 4) frequenciaCompra = 'média';

  const potentialScore = Math.min(100, Math.round((Math.min(ticketMedio / 100, 40) + Math.min(totalComprado / 1000, 35) + Math.min(totalPedidos * 3, 25))));
  let potencial = 'baixo';
  if (potentialScore >= 70) potencial = 'alto';
  else if (potentialScore >= 40) potencial = 'medio';

  return {
    risk,
    riskScore: risk === 'alto' ? 85 : risk === 'medio' ? 55 : 20,
    frequenciaCompra,
    potencial,
    potentialScore
  };
}
