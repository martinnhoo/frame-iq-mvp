/**
 * Safe localStorage wrapper.
 * Safari private mode throws SecurityError on any localStorage access.
 * All methods fail silently and return sensible defaults.
 */

export const storage = {
  get(key: string, fallback: string = ""): string {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  setJSON(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  available(): boolean {
    try {
      const t = "__adbrief_test__";
      localStorage.setItem(t, "1");
      localStorage.removeItem(t);
      return true;
    } catch {
      return false;
    }
  },
};
