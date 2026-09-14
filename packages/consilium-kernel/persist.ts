import type { GameState, PlayerStats, Profile } from "./types";
import { PROFILE_VERSION, SAVE_VERSION } from "./constants";
import { defaultProfile } from "./engine";

const PROFILE_KEY = "consilium.profile.v1";
const GAMES_KEY = "consilium.games.v1";
const SETTINGS_KEY = "consilium.settings.v1";

export interface Settings {
  mute: boolean;
  reduceMotion: boolean;
}

const defaultSettings: Settings = { mute: true, reduceMotion: false };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadProfile(): Profile {
  const p = read<Profile | null>(PROFILE_KEY, null);
  if (!p) return defaultProfile();
  const d = defaultProfile();
  return {
    ...d,
    ...p,
    version: PROFILE_VERSION,
    stats: { ...d.stats, ...p.stats },
    civilizations: p.civilizations?.length ? p.civilizations : d.civilizations,
  };
}

export function saveProfile(p: Profile) {
  write(PROFILE_KEY, { ...p, version: PROFILE_VERSION });
}

/** Fill arrays/maps missing from older blobs. Safe to run on every load. */
export function hydrateGame(g: GameState): GameState {
  return {
    ...g,
    version: typeof g.version === "number" ? g.version : SAVE_VERSION,
    destroyUpgrades: g.destroyUpgrades ?? [],
    activeSabotage: g.activeSabotage ?? {},
    sabotageUntilTurn: g.sabotageUntilTurn ?? {},
    destabilized: g.destabilized ?? [],
    counterEspionage: g.counterEspionage ?? [],
    builds: g.builds ?? [],
    trades: g.trades ?? [],
    espionage: g.espionage ?? [],
    threads: g.threads ?? [],
    alliances: g.alliances ?? [],
    pacts: g.pacts ?? [],
    promiseReports: g.promiseReports ?? [],
    allyIncidents: g.allyIncidents ?? [],
    log: g.log ?? [],
    archiveLog: g.archiveLog ?? [],
    turnSnapshots: g.turnSnapshots ?? [],
  };
}

export function loadGames(): GameState[] {
  const list = read<GameState[]>(GAMES_KEY, []);
  return list.filter((g) => g && g.systems && g.players).map(hydrateGame);
}

export function saveGames(games: GameState[]) {
  const slim = games
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
    .map((g) => ({ ...g, version: SAVE_VERSION }));
  write(GAMES_KEY, slim);
}

export function upsertGame(games: GameState[], game: GameState): GameState[] {
  const i = games.findIndex((g) => g.id === game.id);
  const next = games.slice();
  if (i >= 0) next[i] = game;
  else next.unshift(game);
  saveGames(next);
  return next;
}

export function removeGame(games: GameState[], id: string): GameState[] {
  const next = games.filter((g) => g.id !== id);
  saveGames(next);
  return next;
}

export function loadSettings(): Settings {
  return { ...defaultSettings, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export function applyResultToStats(
  stats: PlayerStats,
  game: GameState,
  humanId: string,
): PlayerStats {
  const next = { ...stats, gamesPlayed: stats.gamesPlayed + 1 };
  if (!game.winnerIds) return next;
  if (game.result === "tie" && game.winnerIds.includes(humanId)) next.ties += 1;
  else if (game.winnerIds.includes(humanId)) next.wins += 1;
  else next.losses += 1;
  return next;
}

export function exportSave(game: GameState): string {
  return JSON.stringify(game);
}

export function importSave(raw: string): GameState | null {
  try {
    const g = JSON.parse(raw) as GameState;
    if (!g?.id || !g.systems || !g.players) return null;
    return hydrateGame(g);
  } catch {
    return null;
  }
}
