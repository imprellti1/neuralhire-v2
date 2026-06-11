export function mapIaMemoria(item = {}) {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    prioridade: Number(item.prioridade || 0)
  };
}

