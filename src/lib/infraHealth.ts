export type InfrastructureHealthPayload = {
  netlifyFunctions: boolean;
  supabaseConfigured: boolean;
  adminTokenConfigured: boolean;
  cloudSyncEnabled: boolean;
  dynamicContentEnabled: boolean;
  supabaseReachable: boolean | null;
  catalogPublicationsReady?: boolean | null;
  checkedAt: string;
  warnings: string[];
};

export type InfrastructureHealthResponse = {
  ok: boolean;
  payload?: InfrastructureHealthPayload;
  error?: string;
};

const parseResponse = async (response: Response): Promise<InfrastructureHealthResponse> => {
  const raw = await response.text();
  let data: InfrastructureHealthResponse | null = null;

  try {
    data = raw ? (JSON.parse(raw) as InfrastructureHealthResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error || `Falha HTTP ${response.status}`,
      payload: data?.payload,
    };
  }

  return data ?? { ok: true };
};

export const fetchInfrastructureHealth = async (): Promise<InfrastructureHealthResponse> => {
  try {
    const response = await fetch('/.netlify/functions/infra-health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return parseResponse(response);
  } catch {
    return { ok: false, error: 'Falha de rede ao consultar a infraestrutura.' };
  }
};
