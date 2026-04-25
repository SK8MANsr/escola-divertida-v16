const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getClientConfig = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { ok: false, error: 'Supabase não configurado no ambiente Netlify.' };
  }
  return { ok: true, url, serviceRoleKey };
};

const requestSupabase = async (path, options = {}) => {
  const config = getClientConfig();
  if (!config.ok) {
    return { ok: false, error: config.error };
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    return { ok: false, error: typeof data === 'object' && data && data.message ? data.message : 'Erro ao falar com o Supabase.' };
  }

  return { ok: true, data };
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'GET') {
    const deviceId = event.queryStringParameters?.deviceId;
    if (!deviceId) {
      return json(400, { ok: false, error: 'deviceId é obrigatório.' });
    }

    const result = await requestSupabase(`parent_saves?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id,payload,updated_at&limit=1`);
    if (!result.ok) {
      return json(500, { ok: false, error: result.error });
    }

    const row = Array.isArray(result.data) ? result.data[0] : null;
    return json(200, { ok: true, payload: row?.payload || null, updatedAt: row?.updated_at || null });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { ok: false, error: 'JSON inválido.' });
    }

    const deviceId = body.deviceId;
    const payload = body.payload;
    if (!deviceId || !payload) {
      return json(400, { ok: false, error: 'deviceId e payload são obrigatórios.' });
    }

    const updatedAt = new Date().toISOString();
    const result = await requestSupabase('parent_saves?on_conflict=device_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ device_id: deviceId, payload, updated_at: updatedAt }]),
    });

    if (!result.ok) {
      return json(500, { ok: false, error: result.error });
    }

    return json(200, { ok: true, updatedAt });
  }

  return json(405, { ok: false, error: 'Método não suportado.' });
};
