export function createClientesRadarState() {
  return {
    loading: true,
    error: null,
    data: null,
    filters: {
      vendedor_id: '',
      cidade: '',
      estado: '',
      segmento: ''
    }
  };
}
