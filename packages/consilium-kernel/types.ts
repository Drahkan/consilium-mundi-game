export type ResourceKey = "tech" | "metals" | "chon";

export interface Resources {
  tech: number;
  metals: number;
  chon: number;
}

export type Upgrade =
  | "starport"
  | "shipyard"
  | "colony"
  | "mining"
  | "wormhole";

export type Attitude =
  | "neutral"
  | "belligerent"
  | "aggressive"
  | "polite"
  | "apologetic";

export type MessageTopic =
  | "attack"
  | "support"
  | "trade"
  | "espionage"
  | "intelligence"
  | "alliance";

export type PlayerRange = "3-5" | "4-6" | "5-8" | "6-10";
export type Density = "sparse" | "light" | "standard" | "heavy";
export type ResourceProfile = "barren" | "sparse" | "standard" | "dense";
export type HomeDev =
  | "colonyWorlds"
  | "standard"
  | "advanced"
  | "expanding"
  | "fading";
export type VictoryKind =
  | "standard"
  | "galacticDomination"
  | "lastStanding"
  | "corporate"
  | "gunship";
export type TurnDuration =
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "16h"
  | "24h"
  | "36h"
  | "2d"
  | "3d"
  | "none";
export type TurnLimit = 15 | 24 | 40 | 60 | 100 | "none";

export type GameTypeId =
  | "standard"
  | "ragnarok"
  | "reckoning"
  | "weekend"
  | "tradeWars"
  | "postApocalypse"
  | "custom";

export interface GameOptions {
  gameType: GameTypeId;
  playerRange: PlayerRange;
  playerCount: number;
  systemDensity: Density;
  homeDensity: Density;
  systemResources: ResourceProfile;
  homeDev: HomeDev;
  victory: VictoryKind;
  turnDuration: TurnDuration;
  turnLimit: TurnLimit;
  noWeekendTimer: boolean;
  disableCommunications: boolean;
  fogOfWar: boolean;
  uncharted: boolean;
  scorchedEarth: boolean;
  alienArtifacts: boolean;
}

export interface FlagSpec {
  colors: [string, string, string];
  shapeA: FlagShape;
  shapeB: FlagShape;
  scaleA: number;
  scaleB: number;
  offsetA: { x: number; y: number };
  offsetB: { x: number; y: number };
}

export type FlagShape =
  | "disc"
  | "ring"
  | "diamond"
  | "chevron"
  | "bar"
  | "cross"
  | "saltire"
  | "triangle"
  | "star"
  | "hex"
  | "crescent"
  | "slash";

export interface Civilization {
  id: string;
  name: string;
  useThe: boolean;
  racialName: string;
  rulerTitle: string;
  attitude: Attitude;
  flag: FlagSpec;
  diplomat: DiplomatId;
  archived?: boolean;
}

export type DiplomatId =
  | "envoy"
  | "mask"
  | "console"
  | "choir"
  | "captain"
  | "oracle";

export interface Profile {
  version: number;
  displayName: string;
  civilizations: Civilization[];
  friends: string[];
  stats: PlayerStats;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  systemsTaken: number;
  fleetsDestroyed: number;
}

export type PlayerKind = "human" | "ai";

export interface Player {
  id: string;
  kind: PlayerKind;
  name: string;
  civ: Civilization;
  resources: Resources;
  ready: boolean;
  collapsed: boolean;
  discoveredPlayerIds: string[];
  discoveredSystemIds: string[];
}

export type OrderKind = "hold" | "move" | "support";

export type FleetOrder =
  | { kind: "hold" }
  | { kind: "move"; destId: string; wormholeJump?: boolean }
  | { kind: "support"; supportedFleetId: string; destId: string };

export interface Fleet {
  id: string;
  ownerId: string;
  systemId: string;
  order: FleetOrder;
  rallySystemId: string | null;
  scheduledDestroy?: boolean;
}

export interface StarSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  neighbors: string[];
  ownerId: string | null;
  isHome: boolean;
  originalHomePlayerId?: string;
  base: Resources;
  alienArtifact: boolean;
  upgrades: Upgrade[];
  fleets: Fleet[];
  /** home = starting capitol cluster; near = that empire's local unowned belt; core = galactic interior */
  kind?: "home" | "near" | "core";
  /** Player whose home cluster this system belongs to (owned homes and their unowned belt). */
  homeGroupId?: string;
}

export type BuildKind = "starfleet" | Upgrade;

export interface ScheduledBuild {
  id: string;
  playerId: string;
  systemId: string;
  kind: BuildKind;
}

export interface ScheduledTrade {
  id: string;
  playerId: string;
  systemId: string;
  resources: Resources;
  /** Intended recipient — credited when the landing site is unowned or held by the sender. */
  toPlayerId?: string;
}

export type EspionageKind =
  | "fake"
  | "intercept"
  | "sabotage"
  | "destabilize"
  | "counter";

export interface ScheduledEspionage {
  id: string;
  playerId: string;
  kind: EspionageKind;
  systemId?: string;
  targetUpgrade?: Upgrade | "fleets";
  otherPlayerId?: string;
  thirdPlayerId?: string;
}

export type OfferStatus = "open" | "accepted" | "declined" | "countered";

export type AttackIntent = "vacate" | "i-attack" | "you-attack" | "you-take";
export type SupportIntent = "support-me" | "i-support-you" | "threaten-third";
export type AllianceIntent = "with-you" | "with-third";
export type AllianceClause = "form" | "break";

/** Binding terms attached to a dispatch — shown in the UI and used on accept. */
export interface DiplomacyTerms {
  give?: Resources;
  giveSystemId?: string;
  request?: Resources;
  requestSystemId?: string;
  intent?: AttackIntent | SupportIntent | AllianceIntent | EspionageKind | string;
  espionageKind?: EspionageKind;
  targetUpgrade?: Upgrade | "fleets";
  aboutPlayerId?: string;
  unless?: string;
  /** Bundled with any topic: form or dissolve a bilateral alliance on accept. */
  allianceClause?: AllianceClause;
}

export interface DiplomacyMessage {
  id: string;
  turn: number;
  fromPlayerId: string;
  /** Apparent sender — differs from fromPlayerId when faked. */
  apparentFromId: string;
  toPlayerId: string;
  topic: MessageTopic;
  attitude: Attitude;
  systemId?: string;
  neighborId?: string;
  aboutPlayerId?: string;
  intelThreadId?: string;
  text: string;
  read: boolean;
  terms?: DiplomacyTerms;
  status?: OfferStatus;
}

export interface DiplomacyThread {
  id: string;
  topic: MessageTopic;
  participants: [string, string];
  systemId?: string;
  messages: DiplomacyMessage[];
}

/** Verbal alliance. In force the moment both sides accept; either side may denounce it. */
export interface Alliance {
  a: string;
  b: string;
  formedTurn: number;
}

/**
 * A sealed bargain: both admiralties gave their word. Goods still have to be
 * ordered as ordinary deliveries — accepting does not move the treasury.
 */
export interface Pact {
  id: string;
  sealedTurn: number;
  messageId: string;
  threadId: string;
  /** Original offerer — promised `give` to `giveSystemId`. */
  aId: string;
  /** Accepter — promised `request` to `requestSystemId`. */
  bId: string;
  give: Resources;
  giveSystemId?: string;
  request: Resources;
  requestSystemId?: string;
  allianceClause?: AllianceClause;
  evaluated?: boolean;
}

export type PromiseResult = "kept" | "broken" | "partial";

export interface PromiseReport {
  id: string;
  pactId: string;
  actorId: string;
  otherId: string;
  result: PromiseResult;
  detail: string;
  /** Extra hostilities or side actions that did not themselves void the bargain. */
  extras?: string[];
  kind?: "delivery" | "alliance" | "hostility";
}

export type AllyIncidentKind = "attack" | "espionage" | "occupy";
export type AllyIncidentStatus = "open" | "ignored" | "broke" | "threatened";

export interface AllyIncident {
  id: string;
  turn: number;
  actorId: string;
  victimId: string;
  kind: AllyIncidentKind;
  systemId?: string;
  text: string;
  status: AllyIncidentStatus;
}

export type LogSeverity = "info" | "combat" | "intel" | "econ" | "alert";

export interface TurnLogEntry {
  id: string;
  severity: LogSeverity;
  text: string;
  systemId?: string;
  playerId?: string;
}

export type GamePhase = "activity" | "resolving" | "report" | "ended";

export interface SnapshotSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  ownerId: string | null;
  isHome: boolean;
  upgrades: Upgrade[];
  neighbors: string[];
  fleets: { ownerId: string; n: number }[];
}

export interface SnapshotPlayer {
  id: string;
  name: string;
  civName: string;
  colors: string[];
}

export interface TurnSnapshot {
  turn: number;
  phase: GamePhase;
  systems: SnapshotSystem[];
  resources: Record<string, Resources>;
  combat: { text: string; systemId?: string }[];
  /** Slim admiralty list for recap/replay. Optional on pre-v5 blobs. */
  players?: SnapshotPlayer[];
}

export interface GameState {
  version: number;
  id: string;
  seed: string;
  name: string;
  options: GameOptions;
  turn: number;
  phase: GamePhase;
  systems: StarSystem[];
  players: Player[];
  builds: ScheduledBuild[];
  trades: ScheduledTrade[];
  espionage: ScheduledEspionage[];
  threads: DiplomacyThread[];
  alliances: Alliance[];
  pacts: Pact[];
  promiseReports: PromiseReport[];
  allyIncidents: AllyIncident[];
  log: TurnLogEntry[];
  archiveLog: TurnLogEntry[];
  winnerIds: string[] | null;
  result: "win" | "tie" | null;
  createdAt: number;
  updatedAt: number;
  humanPlayerId: string;
  actingPlayerId: string;
  sabotageUntilTurn: Record<string, number>;
  /** systemId -> sabotaged target */
  activeSabotage: Record<string, Upgrade | "fleets">;
  destabilized: string[];
  counterEspionage: string[];
  destroyUpgrades: { playerId: string; systemId: string; upgrade: Upgrade }[];
  turnSnapshots: TurnSnapshot[];
}

export interface SavedLobby {
  id: string;
  state: GameState;
}

export const ZERO: Resources = { tech: 0, metals: 0, chon: 0 };

export function addRes(a: Resources, b: Resources): Resources {
  return {
    tech: a.tech + b.tech,
    metals: a.metals + b.metals,
    chon: a.chon + b.chon,
  };
}

export function subRes(a: Resources, b: Resources): Resources {
  return {
    tech: a.tech - b.tech,
    metals: a.metals - b.metals,
    chon: a.chon - b.chon,
  };
}

export function canAfford(have: Resources, cost: Resources): boolean {
  return (
    have.tech >= cost.tech &&
    have.metals >= cost.metals &&
    have.chon >= cost.chon
  );
}

export function resSum(r: Resources): number {
  return r.tech + r.metals + r.chon;
}

export function cloneRes(r: Resources): Resources {
  return { tech: r.tech, metals: r.metals, chon: r.chon };
}

export function resEqual(a: Resources, b: Resources): boolean {
  return a.tech === b.tech && a.metals === b.metals && a.chon === b.chon;
}
