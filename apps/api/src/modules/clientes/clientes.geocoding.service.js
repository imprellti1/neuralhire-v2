function normalizePart(value) {
  return String(value || '').trim();
}

export function montarEnderecoCliente(cliente = {}) {
  const parts = [
    normalizePart(cliente.logradouro),
    normalizePart(cliente.numero),
    normalizePart(cliente.bairro),
    normalizePart(cliente.cidade),
    normalizePart(cliente.estado),
    normalizePart(cliente.cep),
    'Brasil'
  ].filter(Boolean);
  return parts.join(', ');
}

function parseLatitudeLongitude(item = {}) {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function geocodificarEndereco(endereco, options = {}) {
  const target = normalizePart(endereco);
  if (!target || target.length < 8) {
    return { status: 'nao_encontrado', erro: 'Endereco insuficiente para geolocalizacao.' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', target);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'br');

  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': 'NeuralHire/2.0 contato: igorpreell@gmail.com',
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { status: 'erro', erro: `Nominatim retornou status ${response.status}.`, details: body || null };
    }

    const data = await response.json();
    const item = Array.isArray(data) ? data[0] : null;
    const coords = item ? parseLatitudeLongitude(item) : null;
    if (!coords) {
      return { status: 'nao_encontrado', erro: 'Endereco nao encontrado no Nominatim.' };
    }

    const google_maps_url = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
    return {
      status: 'sucesso',
      latitude: coords.latitude,
      longitude: coords.longitude,
      google_maps_url,
      google_place_id: null,
      fonte: 'nominatim',
      erro: null,
      raw: item
    };
  } catch (error) {
    return { status: 'erro', erro: error?.message || 'Falha ao consultar geolocalizacao.' };
  }
}
