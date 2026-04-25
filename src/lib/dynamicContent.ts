import type { ContentPack, ParentWeeklyTrack, SeasonalEvent } from '../data/gameContent';

export type DynamicCatalogPayload = {
  manifestVersion: number;
  contentPacks: ContentPack[];
  seasonalEvents: SeasonalEvent[];
  parentWeeklyTracks: ParentWeeklyTrack[];
};

export type DynamicCatalogResponse = {
  ok: boolean;
  payload?: DynamicCatalogPayload;
  updatedAt?: string | null;
  error?: string;
};

export type DynamicCatalogAdminPayload = DynamicCatalogPayload;

export type DynamicCatalogAdminResponse = DynamicCatalogResponse & {
  source?: 'remote' | 'local';
  publication?: {
    publishedAt: string | null;
    manifestVersion: number | null;
    counts: { packs: number; events: number; tracks: number } | null;
  } | null;
};

export const dynamicContentEnabled = () => String(import.meta.env.VITE_ENABLE_DYNAMIC_CONTENT).toLowerCase() === 'true';

const parseResponse = async (response: Response): Promise<DynamicCatalogResponse> => {
  const raw = await response.text();
  let data: DynamicCatalogResponse | null = null;

  try {
    data = raw ? (JSON.parse(raw) as DynamicCatalogResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error || `Falha HTTP ${response.status}`,
      payload: data?.payload,
      updatedAt: data?.updatedAt ?? null,
    };
  }

  return data ?? { ok: true, updatedAt: null };
};

export const fetchDynamicCatalog = async (): Promise<DynamicCatalogResponse> => {
  try {
    const response = await fetch('/.netlify/functions/content-catalog', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return parseResponse(response);
  } catch {
    return { ok: false, error: 'Falha de rede ao carregar o catálogo dinâmico.' };
  }
};

export const fetchAdminDynamicCatalog = async (adminToken: string): Promise<DynamicCatalogAdminResponse> => {
  try {
    const response = await fetch('/.netlify/functions/content-admin', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-admin-token': adminToken,
      },
      cache: 'no-store',
    });
    return parseResponse(response) as Promise<DynamicCatalogAdminResponse>;
  } catch {
    return { ok: false, error: 'Falha de rede ao carregar o catálogo remoto para o estúdio admin.' };
  }
};

export const publishDynamicCatalog = async (adminToken: string, payload: DynamicCatalogAdminPayload): Promise<DynamicCatalogAdminResponse> => {
  try {
    const response = await fetch('/.netlify/functions/content-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  } catch {
    return { ok: false, error: 'Falha de rede ao publicar o catálogo.' };
  }
};
