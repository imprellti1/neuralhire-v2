export function createClientesRadarState() {
  return {
    loading: true,
    error: null,
    data: null,
    message: '',
    filters: {
      vendedor_id: '',
      cidade: '',
      estado: '',
      segmento: ''
    }
  };
}
