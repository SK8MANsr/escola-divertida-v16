const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
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

const requireAdminToken = (event) => {
  const expectedToken = process.env.CONTENT_ADMIN_TOKEN;
  const providedToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (!expectedToken) return { ok: false, status: 500, error: 'CONTENT_ADMIN_TOKEN não configurado no Netlify.' };
  if (!providedToken || providedToken !== expectedToken) return { ok: false, status: 401, error: 'Token administrativo inválido.' };
  return { ok: true };
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

const normalizePackRows = (packs) => packs.map((pack, index) => ({
  id: pack.id,
  slug: pack.id,
  title: pack.title,
  description: pack.description || '',
  min_age: Math.min(...(pack.recommendedAges || [4])),
  max_age: Math.max(...(pack.recommendedAges || [7])),
  is_active: true,
  sort_order: index,
  metadata: {
    ageLabel: pack.ageLabel,
    recommendedAges: pack.recommendedAges,
    themeLabel: pack.themeLabel,
    accentClass: pack.accentClass,
    mascotTip: pack.mascotTip,
    featureBullets: pack.featureBullets,
  },
}));

const normalizePackPhaseRows = (packs) => packs.flatMap((pack) => (pack.phaseIds || []).map((phaseId, index) => ({
  pack_id: pack.id,
  phase_id: phaseId,
  sort_order: index,
  metadata: {},
})));

const normalizeEventRows = (events) => events.map((item) => ({
  id: item.id,
  slug: item.id,
  title: item.title,
  subtitle: item.subtitle || '',
  emoji: item.emoji || '🎉',
  world_key: item.world,
  target_completions: item.targetCompletions || 1,
  reward_label: item.rewardLabel || 'Selo especial',
  reward_stars: item.rewardStars || 0,
  is_active: true,
  metadata: {
    palette: item.palette,
    monthRange: item.monthRange,
  },
}));

const normalizeTrackRows = (tracks) => tracks.map((item) => ({
  id: item.id,
  slug: item.id,
  title: item.title,
  age_min: item.ageMin,
  age_max: item.ageMax,
  world_key: item.world || null,
  is_active: item.isActive !== false,
  days: item.days || [],
  metadata: {
    accentClass: item.accentClass,
    description: item.description,
  },
}));

const buildPublicationMeta = (manifestVersion, packs, events, tracks) => ({
  manifest_version: manifestVersion || 2,
  counts: { packs: packs.length, events: events.length, tracks: tracks.length },
  payload: {
    manifestVersion: manifestVersion || 2,
    contentPacks: packs,
    seasonalEvents: events,
    parentWeeklyTracks: tracks,
  },
  published_by: 'netlify-content-admin',
});

const fetchRemoteCatalog = async () => {
  const [packsResult, phasesResult, eventsResult, tracksResult, publicationsResult] = await Promise.all([
    requestSupabase('content_packs?select=id,title,description,min_age,max_age,sort_order,metadata,updated_at&is_active=eq.true&order=sort_order.asc'),
    requestSupabase('content_pack_phases?select=pack_id,phase_id,sort_order&order=sort_order.asc'),
    requestSupabase('seasonal_events?select=id,title,subtitle,emoji,world_key,target_completions,reward_label,reward_stars,starts_at,ends_at,metadata,updated_at&is_active=eq.true&order=created_at.asc'),
    requestSupabase('parent_weekly_tracks?select=id,title,age_min,age_max,world_key,is_active,days,metadata,updated_at&is_active=eq.true&order=created_at.asc'),
    requestSupabase('catalog_publications?select=manifest_version,counts,created_at&order=created_at.desc&limit=1'),
  ]);

  const failed = [packsResult, phasesResult, eventsResult, tracksResult, publicationsResult].find((item) => !item.ok);
  if (failed) return { ok: false, error: failed.error || 'Falha ao ler o catálogo remoto.' };

  const payload = {
    manifestVersion: publicationsResult.data?.[0]?.manifest_version || 2,
    contentPacks: (packsResult.data || []).map((row) => mapPack(row, phasesResult.data || [])),
    seasonalEvents: (eventsResult.data || []).map(mapEvent),
    parentWeeklyTracks: (tracksResult.data || []).map(mapTrack),
  };

  const updatedAtCandidates = [
    ...(packsResult.data || []).map((row) => row.updated_at).filter(Boolean),
    ...(eventsResult.data || []).map((row) => row.updated_at).filter(Boolean),
    ...(tracksResult.data || []).map((row) => row.updated_at).filter(Boolean),
    ...(publicationsResult.data || []).map((row) => row.created_at).filter(Boolean),
  ].sort();

  return {
    ok: true,
    payload,
    updatedAt: updatedAtCandidates.length ? updatedAtCandidates[updatedAtCandidates.length - 1] : null,
    publication: publicationsResult.data?.[0]
      ? {
          publishedAt: publicationsResult.data[0].created_at || null,
          manifestVersion: publicationsResult.data[0].manifest_version || null,
          counts: publicationsResult.data[0].counts || null,
        }
      : null,
  };
};

const deactivateMissingRows = async (table, idsToKeep) => {
  if (!Array.isArray(idsToKeep) || !idsToKeep.length) {
    return requestSupabase(`${table}?id=not.is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_active: false }),
    });
  }
  const encodedIds = idsToKeep.map((id) => `"${id}"`).join(',');
  return requestSupabase(`${table}?id=not.in.(${encodedIds})`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: false }),
  });
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const tokenCheck = requireAdminToken(event);
  if (!tokenCheck.ok) return json(tokenCheck.status, { ok: false, error: tokenCheck.error });

  if (event.httpMethod === 'GET') {
    const remote = await fetchRemoteCatalog();
    if (!remote.ok) return json(500, { ok: false, error: remote.error });
    return json(200, { ok: true, source: 'remote', updatedAt: remote.updatedAt, payload: remote.payload, publication: remote.publication });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Método não suportado.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'JSON inválido.' });
  }

  const packs = Array.isArray(body.contentPacks) ? body.contentPacks : [];
  const seasonalEvents = Array.isArray(body.seasonalEvents) ? body.seasonalEvents : [];
  const parentWeeklyTracks = Array.isArray(body.parentWeeklyTracks) ? body.parentWeeklyTracks : [];

  const packRows = normalizePackRows(packs);
  const phaseRows = normalizePackPhaseRows(packs);
  const eventRows = normalizeEventRows(seasonalEvents);
  const trackRows = normalizeTrackRows(parentWeeklyTracks);

  const deactivatePacks = await deactivateMissingRows('content_packs', packRows.map((row) => row.id));
  if (!deactivatePacks.ok) return json(500, { ok: false, error: deactivatePacks.error });
  if (packRows.length) {
    const upsertPacks = await requestSupabase('content_packs?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(packRows),
    });
    if (!upsertPacks.ok) return json(500, { ok: false, error: upsertPacks.error });
  }

  const deleteAllPhases = await requestSupabase('content_pack_phases?pack_id=not.is.null', { method: 'DELETE' });
  if (!deleteAllPhases.ok && deleteAllPhases.status !== 404) return json(500, { ok: false, error: deleteAllPhases.error });
  if (phaseRows.length) {
    const insertPhases = await requestSupabase('content_pack_phases', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(phaseRows),
    });
    if (!insertPhases.ok) return json(500, { ok: false, error: insertPhases.error });
  }

  const deactivateEvents = await deactivateMissingRows('seasonal_events', eventRows.map((row) => row.id));
  if (!deactivateEvents.ok) return json(500, { ok: false, error: deactivateEvents.error });
  if (eventRows.length) {
    const upsertEvents = await requestSupabase('seasonal_events?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(eventRows),
    });
    if (!upsertEvents.ok) return json(500, { ok: false, error: upsertEvents.error });
  }

  const deactivateTracks = await deactivateMissingRows('parent_weekly_tracks', trackRows.map((row) => row.id));
  if (!deactivateTracks.ok) return json(500, { ok: false, error: deactivateTracks.error });
  if (trackRows.length) {
    const upsertTracks = await requestSupabase('parent_weekly_tracks?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(trackRows),
    });
    if (!upsertTracks.ok) return json(500, { ok: false, error: upsertTracks.error });
  }

  const publicationMeta = buildPublicationMeta(body.manifestVersion || 2, packs, seasonalEvents, parentWeeklyTracks);
  const publication = await requestSupabase('catalog_publications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([publicationMeta]),
  });
  if (!publication.ok) return json(500, { ok: false, error: publication.error });

  return json(200, {
    ok: true,
    source: 'remote',
    updatedAt: publication.data?.[0]?.created_at || new Date().toISOString(),
    payload: {
      manifestVersion: body.manifestVersion || 2,
      contentPacks: packs,
      seasonalEvents,
      parentWeeklyTracks,
    },
    publication: publication.data?.[0]
      ? {
          publishedAt: publication.data[0].created_at || null,
          manifestVersion: publication.data[0].manifest_version || null,
          counts: publication.data[0].counts || null,
        }
      : null,
    message: 'Catálogo sincronizado integralmente com o Supabase.',
  });
};
