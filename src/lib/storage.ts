export const safeReadStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora falhas de quota/privacidade sem derrubar a UI.
  }
};

export const getOrCreateDeviceId = (key: string) => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `device-memory-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};
