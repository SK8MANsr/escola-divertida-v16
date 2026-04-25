const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
  if (!config.ok) return { ok: false, error: config.error };

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
    return {
      ok: false,
      error: typeof data === 'object' && data && data.message ? data.message : 'Erro ao falar com o Supabase.',
      status: response.status,
      data,
    };
  }

  return { ok: true, data, status: response.status };
};

const rangeAges = (minAge, maxAge, fallback = [4, 5, 6, 7]) => {
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge > maxAge) return fallback;
  return Array.from({ length: maxAge - minAge + 1 }, (_, index) => minAge + index);
};

const mapPack = (row, phaseRows) => {
  const metadata = row.metadata || {};
  const minAge = Number.isInteger(row.min_age) ? row.min_age : 4;
  const maxAge = Number.isInteger(row.max_age) ? row.max_age : 7;
  return {
    id: row.id,
    title: row.title,
    ageLabel: metadata.ageLabel || `${minAge}–${maxAge} anos`,
    recommendedAges: Array.isArray(metadata.recommendedAges) && metadata.recommendedAges.length ? metadata.recommendedAges : rangeAges(minAge, maxAge),
    themeLabel: metadata.themeLabel || 'Coleção dinâmica',
    description: row.description || '',
    accentClass: metadata.accentClass || 'from-indigo-300 to-sky-200',
    mascotTip: metadata.mascotTip || 'Conteúdo vindo do catálogo dinâmico.',
    phaseIds: phaseRows.filter((item) => item.pack_id === row.id).map((item) => item.phase_id),
    featureBullets: Array.isArray(metadata.featureBullets) ? metadata.featureBullets : [],
  };
};

const mapEvent = (row) => {
  const metadata = row.metadata || {};
  const monthRange = metadata.monthRange || (row.starts_at || row.ends_at ? `${row.starts_at ? new Date(row.starts_at).toLocaleDateString('pt-BR') : 'agora'} → ${row.ends_at ? new Date(row.ends_at).toLocaleDateString('pt-BR') : 'aberto'}` : 'evento temático');
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    emoji: row.emoji || '🎉',
    world: row.world_key,
    targetCompletions: row.target_completions || 1,
    rewardLabel: row.reward_label || 'Selo especial',
    rewardStars: row.reward_stars || 0,
    monthRange,
    palette: metadata.palette || 'from-indigo-500 to-fuchsia-500',
  };
};

const mapTrack = (row) => {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    title: row.title,
    description: metadata.description || row.title,
    ageMin: Number.isInteger(row.age_min) ? row.age_min : 4,
    ageMax: Number.isInteger(row.age_max) ? row.age_max : 7,
    world: row.world_key || undefined,
    isActive: row.is_active !== false,
    accentClass: metadata.accentClass || 'from-indigo-300 to-sky-200',
    days: Array.isArray(row.days) ? row.days : [],
  };
};


const fetchLatestPublication = async () => requestSupabase('catalog_publications?select=manifest_version,counts,created_at&order=created_at.desc&limit=1');

const isEventCurrentlyActive = (row) => {
  const now = Date.now();
  const startsAt = row.starts_at ? Date.parse(row.starts_at) : null;
  const endsAt = row.ends_at ? Date.parse(row.ends_at) : null;
  const started = startsAt === null || Number.isNaN(startsAt) || startsAt <= now;
  const notEnded = endsAt === null || Number.isNaN(endsAt) || endsAt >= now;
  return started && notEnded;
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Método não suportado.' });

  const [packsResult, phasesResult, eventsResult, tracksResult, latestPublicationResult] = await Promise.all([
    requestSupabase('content_packs?select=id,title,description,min_age,max_age,sort_order,metadata,updated_at&is_active=eq.true&order=sort_order.asc'),
    requestSupabase('content_pack_phases?select=pack_id,phase_id,sort_order&order=sort_order.asc'),
    requestSupabase('seasonal_events?select=id,title,subtitle,emoji,world_key,target_completions,reward_label,reward_stars,starts_at,ends_at,metadata,updated_at&is_active=eq.true&order=created_at.asc'),
    requestSupabase('parent_weekly_tracks?select=id,title,age_min,age_max,world_key,is_active,days,metadata,updated_at&is_active=eq.true&order=created_at.asc'),
  ]);

  const failed = [packsResult, phasesResult, eventsResult, tracksResult].find((item) => !item.ok);
  if (failed) return json(500, { ok: false, error: failed.error || 'Falha ao carregar catálogo.' });

  const packs = (packsResult.data || []).map((row) => mapPack(row, phasesResult.data || []));
  const seasonalEvents = (eventsResult.data || []).filter(isEventCurrentlyActive).map(mapEvent);
  const parentWeeklyTracks = (tracksResult.data || []).map(mapTrack);
  const latestPublication = latestPublicationResult.ok && Array.isArray(latestPublicationResult.data) ? latestPublicationResult.data[0] : null;
  const updatedAtCandidates = [
    ...(packsResult.data || []).map((row) => row.updated_at).filter(Boolean),
    ...(eventsResult.data || []).map((row) => row.updated_at).filter(Boolean),
    ...(tracksResult.data || []).map((row) => row.updated_at).filter(Boolean),
  ].sort();
  const updatedAt = updatedAtCandidates.length ? updatedAtCandidates[updatedAtCandidates.length - 1] : null;

  return json(200, {
    ok: true,
    updatedAt,
    payload: {
      manifestVersion: latestPublication?.manifest_version || 2,
      contentPacks: packs,
      seasonalEvents,
      parentWeeklyTracks,
    },
  });
};
