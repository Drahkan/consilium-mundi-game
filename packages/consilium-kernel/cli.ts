/**
 * JSON stdin/stdout bridge so a Python FastAPI host can run the kernel
 * with `node cli.mjs` and never reimplement combat or diplomacy.
 *
 * One JSON object in, one JSON object out.
 * { "op": "<name>", "state": GameState | null, ...args }
 * { "ok": true, "state": GameState, "view": GameState?, "error": null, ... }
 */
import type { GameState } from "./types";
import { listGameTypes, optionsForType } from "./constants";
import { presetCivs, randomCiv } from "./civs";
import { randomSeed } from "./mapgen";
import {
  acceptDispatch,
  allHumansReady,
  answerIncident,
  applyBuild,
  applyDismissReport,
  applyEspionage,
  applyFleetOrder,
  applyResign,
  applyTrade,
  claimSeat,
  counterDispatch,
  declineDispatch,
  deliverPact,
  denounce,
  inboxForPlayer,
  markReady,
  markUnready,
  openMatch,
  recapFor,
  resolveIfDue,
  sendDispatch,
  shouldResolve,
  tradeFrontierFor,
  viewForPlayer,
} from "./host";
import { hydrateGame } from "./persist";
import { SAVE_VERSION } from "./constants";
import { legalTradeDestinations } from "./diplomacy";
import {
  applyLegacyBuildOrders,
  applyLegacyFleetOrders,
  applyLegacyRally,
  openMatchLegacy,
  replayFrame,
  skipReport,
  viewLegacy,
} from "./legacy";


type Req = {
  op: string;
  state?: GameState;
  viewerId?: string;
  playerId?: string;
  [k: string]: unknown;
};

function fail(msg: string) {
  return { ok: false, error: msg };
}

function ok(state: GameState, extra: Record<string, unknown> = {}) {
  return { ok: true, error: null, state, ...extra };
}

function requireState(req: Req): GameState {
  if (!req.state) throw new Error("state is required");
  return structuredClone(req.state);
}

function dispatch(req: Req): unknown {
  const op = req.op;
  switch (op) {
    case "ping":
      return { ok: true, error: null, pong: true, version: 6 };
    case "listGameTypes":
      return { ok: true, error: null, gameTypes: listGameTypes() };
    case "optionsForType":
      return {
        ok: true,
        error: null,
        options: optionsForType(
          req.gameType as Parameters<typeof optionsForType>[0],
          req.playerCount as number | undefined,
        ),
      };
    case "presetCivs":
      return { ok: true, error: null, civs: presetCivs() };
    case "randomCiv":
      return {
        ok: true,
        error: null,
        civ: randomCiv(String(req.seed ?? "seed"), Number(req.index ?? 0)),
      };
    case "openMatch": {
      const state = openMatch({
        options: req.options as Parameters<typeof openMatch>[0]["options"],
        hostCiv: req.hostCiv as Parameters<typeof openMatch>[0]["hostCiv"],
        hostName: String(req.hostName ?? "Commander"),
        seed: String(req.seed ?? randomSeed()),
      });
      return ok(state);
    }
    case "claimSeat": {
      const state = requireState(req);
      const seat = claimSeat(
        state,
        req.civ as Parameters<typeof claimSeat>[1],
        String(req.name ?? "Commander"),
      );
      if (!seat) return fail("No open seat.");
      return ok(state, { player: seat });
    }
    case "viewForPlayer": {
      const state = requireState(req);
      const viewerId = String(req.viewerId ?? req.playerId ?? "");
      if (!viewerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        view: viewForPlayer(state, viewerId),
      };
    }
    case "applyFleetOrder": {
      const state = requireState(req);
      const err = applyFleetOrder(
        state,
        String(req.playerId),
        String(req.fleetId),
        req.order as Parameters<typeof applyFleetOrder>[3],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyBuild": {
      const state = requireState(req);
      const err = applyBuild(
        state,
        String(req.playerId),
        String(req.systemId),
        req.kind as Parameters<typeof applyBuild>[3],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyTrade": {
      const state = requireState(req);
      const err = applyTrade(
        state,
        String(req.playerId),
        String(req.systemId),
        req.resources as Parameters<typeof applyTrade>[3],
        req.toPlayerId as string | undefined,
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyEspionage": {
      const state = requireState(req);
      const err = applyEspionage(
        state,
        req.espionage as Parameters<typeof applyEspionage>[1],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "markReady": {
      const state = markReady(requireState(req), String(req.playerId));
      return ok(state, { allReady: allHumansReady(state) });
    }
    case "markUnready":
      return ok(markUnready(requireState(req), String(req.playerId)));
    case "shouldResolve": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        due: shouldResolve(state, {
          turnDueAt: req.turnDueAt as number | undefined,
        }),
      };
    }
    case "resolveIfDue": {
      const before = requireState(req);
      const state = resolveIfDue(before, {
        turnDueAt: req.turnDueAt as number | undefined,
      });
      return ok(state, { resolved: state.turn !== before.turn || state.phase !== before.phase });
    }
    case "dismissReport":
      return ok(applyDismissReport(requireState(req)));
    case "resign":
      return ok(applyResign(requireState(req), String(req.playerId)));
    case "sendDispatch": {
      const state = requireState(req);
      const thread = sendDispatch(
        state,
        req.args as Parameters<typeof sendDispatch>[1],
      );
      return ok(state, { thread });
    }
    case "acceptDispatch": {
      const state = requireState(req);
      const err = acceptDispatch(state, String(req.viewerId ?? req.playerId), String(req.messageId));
      if (err) return fail(err);
      return ok(state);
    }
    case "declineDispatch": {
      const state = requireState(req);
      const err = declineDispatch(state, String(req.viewerId ?? req.playerId), String(req.messageId));
      if (err) return fail(err);
      return ok(state);
    }
    case "counterDispatch": {
      const state = requireState(req);
      const err = counterDispatch(
        state,
        String(req.viewerId ?? req.playerId),
        String(req.messageId),
        req.terms as Parameters<typeof counterDispatch>[3],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "denounce": {
      const state = requireState(req);
      const err = denounce(state, String(req.playerId), String(req.toId), req.reason as string | undefined);
      if (err) return fail(err);
      return ok(state);
    }
    case "answerIncident": {
      const state = requireState(req);
      const err = answerIncident(
        state,
        String(req.viewerId ?? req.playerId),
        String(req.incidentId),
        req.action as Parameters<typeof answerIncident>[3],
        req.unless as string | undefined,
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "deliverPact": {
      const state = requireState(req);
      const err = deliverPact(state, String(req.playerId), String(req.pactId));
      if (err) return fail(err);
      return ok(state);
    }
    case "openMatchLegacy": {
      const state = openMatchLegacy({
        hostName: String(req.hostName ?? "Commander"),
        config: (req.config ?? {}) as Parameters<typeof openMatchLegacy>[0]["config"],
        seed: req.seed as string | undefined,
      });
      return ok(state);
    }
    case "viewLegacy": {
      const state = requireState(req);
      const viewerId = (req.viewerId ?? req.playerId) as string | null;
      return {
        ok: true,
        error: null,
        state,
        view: viewLegacy(state, viewerId ? String(viewerId) : null, {
          turnDueAt: req.turnDueAt as number | null | undefined,
          turnSeconds: req.turnSeconds as number | undefined,
          turnPaused: req.turnPaused as boolean | undefined,
          turnPausedRemaining: req.turnPausedRemaining as number | undefined,
          started: req.started as boolean | undefined,
        }),
      };
    }
    case "applyLegacyFleetOrders": {
      const state = requireState(req);
      const err = applyLegacyFleetOrders(
        state,
        String(req.playerId),
        (req.orders ?? []) as Parameters<typeof applyLegacyFleetOrders>[2],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyLegacyBuildOrders": {
      const state = requireState(req);
      const err = applyLegacyBuildOrders(
        state,
        String(req.playerId),
        (req.orders ?? []) as Parameters<typeof applyLegacyBuildOrders>[2],
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyLegacyRally": {
      const state = requireState(req);
      const err = applyLegacyRally(
        state,
        String(req.playerId),
        String(req.fleetId),
        (req.rallySystemId ?? null) as string | null,
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "replayFrame": {
      const state = requireState(req);
      return { ok: true, error: null, state, frame: replayFrame(state) };
    }
    case "skipReport":
      return ok(skipReport(requireState(req)));
    case "claimSeatNamed": {
      const state = requireState(req);
      const civs = presetCivs();
      const civ =
        (req.civ as Parameters<typeof claimSeat>[1] | undefined) ??
        randomCiv(String(req.seed ?? "join"), state.players.length);
      const seat = claimSeat(state, civ ?? civs[0]!, String(req.name ?? "Commander"));
      if (!seat) return fail("No open seat.");
      return ok(state, { player: seat });
    }
    case "serialize": {
      const state = requireState(req);
      return { ok: true, error: null, version: state.version, blob: state };
    }
    case "load": {
      const blob = (req.blob ?? req.state) as GameState | undefined;
      if (!blob || !blob.systems || !blob.players) return fail("blob is not a GameState");
      if (typeof blob.version === "number" && blob.version > SAVE_VERSION) {
        return fail(`blob version ${blob.version} is newer than kernel ${SAVE_VERSION}`);
      }
      return ok(hydrateGame(blob));
    }
    case "inboxForPlayer": {
      const state = requireState(req);
      const playerId = String(req.viewerId ?? req.playerId ?? "");
      if (!playerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        inbox: inboxForPlayer(state, playerId),
      };
    }
    case "legalTradeDestinations": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        systemIds: legalTradeDestinations(state, String(req.playerId)),
      };
    }
    case "tradeFrontier": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        systemIds: tradeFrontierFor(
          state,
          String(req.playerId ?? req.senderId),
          String(req.toId ?? req.recipientId),
        ),
      };
    }
    case "recap": {
      const state = requireState(req);
      const playerId = String(req.viewerId ?? req.playerId ?? "");
      if (!playerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        recap: recapFor(state, playerId),
      };
    }
    default:
      return fail(`unknown op: ${op}`);
  }
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    process.stdout.write(JSON.stringify(fail("empty stdin")) + "\n");
    process.exit(1);
  }
  let req: Req;
  try {
    req = JSON.parse(raw) as Req;
  } catch {
    process.stdout.write(JSON.stringify(fail("invalid JSON")) + "\n");
    process.exit(1);
  }
  try {
    const result = dispatch(req);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result && typeof result === "object" && (result as { ok?: boolean }).ok === false) {
      process.exit(2);
    }
  } catch (e) {
    process.stdout.write(
      JSON.stringify(fail(e instanceof Error ? e.message : String(e))) + "\n",
    );
    process.exit(1);
  }
}

void main();
