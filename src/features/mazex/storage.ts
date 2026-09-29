export type GameSettings = { sound: boolean; volume: number; vibration: boolean; miniMap: boolean; hints: boolean };
export type SavedRun = { level: number; lives: number; score: number };

export const DEFAULT_SETTINGS: GameSettings = { sound: true, volume: 0.6, vibration: true, miniMap: false, hints: true };

const SETTINGS_KEY = "mazex:settings";
const RUN_KEY = "mazex:run";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage is optional */
  }
}

export function loadSettings(): GameSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<GameSettings>>(SETTINGS_KEY) };
}
export const saveSettings = (settings: GameSettings) => write(SETTINGS_KEY, settings);

export function loadRun(): SavedRun | null {
  const run = read<SavedRun>(RUN_KEY);
  return run && run.level >= 1 && run.lives >= 1 ? run : null;
}
export const saveRun = (run: SavedRun) => write(RUN_KEY, run);
export function clearRun() {
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    /* storage is optional */
  }
}
