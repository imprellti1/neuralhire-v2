export function mapVendedoresData(response = {}) {
  const items = Array.isArray(response?.items) ? response.items : [];
  return { items: items.map((item) => ({ ...item, fabricantesText: Array.isArray(item.fabricantes) ? item.fabricantes.map((f) => f.nome || f.fabricante?.nome).filter(Boolean).join(', ') : '' })) };
}
