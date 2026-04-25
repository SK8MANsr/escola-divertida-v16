export type CloudSyncResponse<T> = {
  ok: boolean;
  payload?: T;
  updatedAt?: string | null;
  error?: string;
};

export const cloudSyncEnabled = () => String(import.meta.env.VITE_ENABLE_CLOUD_SYNC).toLowerCase() === 'true';

const parseResponse = async <T,>(response: Response): Promise<CloudSyncResponse<T>> => {
  const raw = await response.text();
  let data: CloudSyncResponse<T> | null = null;

  try {
    data = raw ? (JSON.parse(raw) as CloudSyncResponse<T>) : null;
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

export const fetchCloudSave = async <T,>(deviceId: string): Promise<CloudSyncResponse<T>> => {
  try {
    const response = await fetch(`/.netlify/functions/cloud-save?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return parseResponse<T>(response);
  } catch {
    return { ok: false, error: 'Falha de rede ao carregar a nuvem.' };
  }
};

export const pushCloudSave = async <T,>(deviceId: string, payload: T): Promise<CloudSyncResponse<T>> => {
  try {
    const response = await fetch('/.netlify/functions/cloud-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ deviceId, payload }),
    });
    return parseResponse<T>(response);
  } catch {
    return { ok: false, error: 'Falha de rede ao sincronizar a nuvem.' };
  }
};
