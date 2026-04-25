const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getConfig = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminToken = process.env.CONTENT_ADMIN_TOKEN;

  return {
    url,
    serviceRoleKey,
    adminToken,
    supabaseConfigured: Boolean(url && serviceRoleKey),
    adminTokenConfigured: Boolean(adminToken),
  };
};

const probeSupabase = async (url, serviceRoleKey, table) => {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
};

const probeFunction = async (baseUrl, pathname, headers = {}) => {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { method: 'GET', headers });
    return response.ok;
  } catch {
    return false;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Método não suportado.' });

  const config = getConfig();
  const warnings = [];
  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const protocol = event.headers['x-forwarded-proto'] || 'https';
  const baseUrl = host ? `${protocol}://${host}` : null;

  if (!config.supabaseConfigured) warnings.push('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ainda não estão completos no Netlify.');
  if (!config.adminTokenConfigured) warnings.push('CONTENT_ADMIN_TOKEN ainda não foi configurado.');

  const [parentSavesReachable, contentPacksReachable, publicationsReachable, cloudSaveReachable, catalogReachable] = await Promise.all([
    config.supabaseConfigured ? probeSupabase(config.url, config.serviceRoleKey, 'parent_saves') : Promise.resolve(false),
    config.supabaseConfigured ? probeSupabase(config.url, config.serviceRoleKey, 'content_packs') : Promise.resolve(false),
    config.supabaseConfigured ? probeSupabase(config.url, config.serviceRoleKey, 'catalog_publications') : Promise.resolve(false),
    baseUrl ? probeFunction(baseUrl, '/.netlify/functions/cloud-save?deviceId=health-check') : Promise.resolve(false),
    baseUrl ? probeFunction(baseUrl, '/.netlify/functions/content-catalog') : Promise.resolve(false),
  ]);

  const supabaseReachable = config.supabaseConfigured ? (parentSavesReachable && contentPacksReachable) : null;
  const catalogPublicationsReady = config.supabaseConfigured ? publicationsReachable : null;

  if (config.supabaseConfigured && !supabaseReachable) warnings.push('Supabase configurado, mas as tabelas essenciais não responderam como esperado.');
  if (config.supabaseConfigured && !publicationsReachable) warnings.push('A tabela catalog_publications ainda não respondeu; rode o schema mais recente.');
  if (!cloudSaveReachable) warnings.push('A função cloud-save não respondeu no health check.');
  if (!catalogReachable) warnings.push('A função content-catalog não respondeu no health check.');

  return json(200, {
    ok: true,
    payload: {
      netlifyFunctions: cloudSaveReachable && catalogReachable,
      supabaseConfigured: config.supabaseConfigured,
      adminTokenConfigured: config.adminTokenConfigured,
      cloudSyncEnabled: String(process.env.VITE_ENABLE_CLOUD_SYNC || '').toLowerCase() === 'true',
      dynamicContentEnabled: String(process.env.VITE_ENABLE_DYNAMIC_CONTENT || '').toLowerCase() === 'true',
      supabaseReachable,
      catalogPublicationsReady,
      checkedAt: new Date().toISOString(),
      warnings,
    },
  });
};
