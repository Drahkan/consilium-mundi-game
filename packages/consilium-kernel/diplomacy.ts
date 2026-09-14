import type {
  Attitude,
  Civilization,
  DiplomacyMessage,
  DiplomacyTerms,
  DiplomacyThread,
  GameState,
  MessageTopic,
  Player,
  Resources,
} from "./types";
import { ZERO, canAfford, cloneRes, resSum, subRes } from "./types";
import { civTheName, uid } from "./civs";
import {
  areAllied,
  breakAlliance,
  formAlliance,
  sealPact,
} from "./alliance";

function the(civ: Civilization): string {
  return civTheName(civ);
}

function ruler(p: Player): string {
  return `${p.civ.rulerTitle} ${p.name}`;
}

function sys(state: GameState, id?: string): string {
  if (!id) return "the designated system";
  const s = state.systems.find((x) => x.id === id);
  return s?.name ?? "the designated system";
}

export function formatRes(r?: Resources): string {
  if (!r) return "nothing";
  const bits: string[] = [];
  if (r.tech) bits.push(`${r.tech} Tech`);
  if (r.metals) bits.push(`${r.metals} Metals`);
  if (r.chon) bits.push(`${r.chon} CHON`);
  return bits.length ? bits.join(", ") : "nothing";
}

export function resNonzero(r?: Resources): boolean {
  return !!r && resSum(r) > 0;
}

function composeMessage(opts: {
  state: GameState;
  from: Player;
  to: Player;
  topic: MessageTopic;
  attitude: Attitude;
  systemId?: string;
  neighborId?: string;
  aboutPlayerId?: string;
  terms?: DiplomacyTerms;
}): string {
  const { state, from, to, topic, attitude, systemId, neighborId, aboutPlayerId, terms } =
    opts;
  const S = sys(state, terms?.giveSystemId ?? systemId);
  const N = neighborId ? sys(state, neighborId) : "an adjacent system";
  const about =
    state.players.find((p) => p.id === (terms?.aboutPlayerId ?? aboutPlayerId))?.civ ??
    to.civ;
  const us = the(from.civ);
  const them = the(to.civ);
  const race = from.civ.racialName;
  const give = formatRes(terms?.give);
  const ask = formatRes(terms?.request);
  const giveSys = sys(state, terms?.giveSystemId);
  const askSys = sys(state, terms?.requestSystemId);
  const unless = terms?.unless ? ` Unless you ${terms.unless}, this stands.` : "";

  if (topic === "trade") {
    const gift = resNonzero(terms?.give);
    const plea = resNonzero(terms?.request);
    const lines: Record<Attitude, string> = {
      neutral: gift && plea
        ? `${ruler(from)} of ${us} proposes an exchange: ${give} landed at ${giveSys}, against ${ask} delivered to ${askSys}.`
        : gift
          ? `${ruler(from)} proposes a delivery of ${give} to ${giveSys}.`
          : `${ruler(from)} suggests that ${them} send ${ask} to ${askSys}.`,
      belligerent: gift
        ? `Refuse us and the next convoy — ${give} bound for ${giveSys} — will feed someone else.${unless}`
        : `Send ${ask} to ${askSys} or ${us} will remember the slight.${unless}`,
      aggressive: plea
        ? `${them} will deliver ${ask} to ${askSys}. ${ruler(from)} has already accounted for them.`
        : `${them} will accept ${give} at ${giveSys}. This is not a discussion.`,
      polite: gift && plea
        ? `${us} offers ${give} at ${giveSys} in a fair exchange for ${ask} at ${askSys}. Let the ledgers, not the guns, speak.`
        : gift
          ? `${us} offers ${give} delivered to ${giveSys}, freely and in good faith.`
          : `${us} requests ${ask} at ${askSys}, and will consider a matching courtesy.`,
      apologetic: plea
        ? `We ask — we must ask — that ${ask} be landed at ${askSys}. Our people are thin this season.`
        : `We can spare ${give} for ${giveSys}. Take it; we have little else to give.`,
    };
    return lines[attitude];
  }

  if (topic === "attack") {
    const intent = terms?.intent ?? "i-attack";
    const vacate = intent === "vacate";
    const youAttack = intent === "you-attack";
    const youTake = intent === "you-take";
    const lines: Record<Attitude, string> = {
      neutral: youTake
        ? `${ruler(from)} of ${us} will leave ${S} unoccupied. ${them} may occupy it from ${N} if they wish.`
        : youAttack
          ? `${us} suggests that ${them} move on ${S} from ${N}. A quiet realignment now may spare both our peoples a regrettable incident.`
          : vacate
            ? `${ruler(from)} requests that ${them} withdraw from ${S}. We have no wish to force the issue.`
            : `${ruler(from)} of ${us} will move on ${S} from ${N}. Consider your dispositions.`,
      belligerent: vacate
        ? `Vacate ${S} or we shall take it from ${N}.${unless}`
        : `The ${race} of ${us} will not be denied ${S}. Stand aside or burn.${unless}`,
      aggressive: youAttack
        ? `${ruler(from)} states without ornament: ${them} will strike ${S} from ${N}. Do so.`
        : `${us} will move on ${S} from ${N}. If ${them} intend to contest it, say so.`,
      polite: youTake
        ? `${us} proposes to leave ${S}. With your blessing we would see ${them} occupy it from ${N}.`
        : vacate
          ? `${us} asks, with respect, that ${them} withdraw from ${S} so hostilities can be avoided.`
          : `${ruler(from)} of ${us} proposes a coordinated movement concerning ${S} from ${N}.`,
      apologetic: youAttack
        ? `${ruler(from)} begs that ${them} strike ${S} from ${N}. We cannot do this ourselves.`
        : `${ruler(from)} begs the patience of ${them}. Permit us ${S}, or strike where we cannot.`,
    };
    return lines[attitude];
  }

  if (topic === "support") {
    const mine = (terms?.intent ?? "support-me") === "support-me";
    const lines: Record<Attitude, string> = {
      neutral: mine
        ? `${us} notes that supporting fire into ${S} from ${N} would settle the local balance with a minimum of blood.`
        : `${us} is prepared to support a movement into ${S} from ${N}, if ${them} wish it.`,
      belligerent: `Unless ${them} comply, ${us} will commit supporting fire against ${S} from ${N}.${unless}`,
      aggressive: mine
        ? `${ruler(from)} requires that ${them} support the movement into ${S} from ${N}. This is not a discussion.`
        : `${them} will accept our supporting fire into ${S} from ${N}.`,
      polite: mine
        ? `${us} requests support into ${S} from ${N}. Two navies, one purpose.`
        : `${us} offers supporting fire into ${S} from ${N}, if that serves ${them}.`,
      apologetic: `We plead for supporting fire into ${S} from ${N}. The ${race} cannot hold the line alone.`,
    };
    return lines[attitude];
  }

  if (topic === "espionage") {
    const op = terms?.espionageKind ?? "sabotage";
    const target = terms?.targetUpgrade ?? "starport";
    const lines: Record<Attitude, string> = {
      neutral: `${us} suggests quiet work at ${S} — ${op} against ${target}. Agents are cheaper than starfleets.`,
      belligerent: `Unless ${them} yield, ${us} will set ${op} upon ${S} (${target}). You will learn of it when the lights go out.${unless}`,
      aggressive: `${ruler(from)} requires ${op} at ${S} (${target}). See it done.`,
      polite: `${us} offers to handle ${op} at ${S} (${target}), or to recommend the same of your own operatives.`,
      apologetic: `We beg a quiet knife at ${S} — ${op} against ${target}. We have not the fleets to do this in the open.`,
    };
    return lines[attitude];
  }

  if (topic === "intelligence") {
    const lines: Record<Attitude, string> = {
      neutral: `${ruler(from)} is prepared to share a correspondence concerning ${the(about)}. Archives, unlike starfleets, cost little to move.`,
      belligerent: `Hold your tongue or ${us} will circulate the relevant archive regarding ${the(about)}. Shame is a weapon.${unless}`,
      aggressive: `${them} will furnish the correspondence concerning ${the(about)}. ${ruler(from)} does not ask twice.`,
      polite: `${us} offers, or requests, a copy of certain messages touching ${the(about)}. Discretion for discretion.`,
      apologetic: `We ask to see what ${the(about)} has written. We are, as ever, the last to know.`,
    };
    return lines[attitude];
  }

  const third = terms?.intent === "with-third";
  const dissolving = terms?.allianceClause === "break";
  const lines: Record<Attitude, string> = {
    neutral: dissolving
      ? `${ruler(from)} of ${us} proposes that our alliance be dissolved.`
      : third
        ? `${ruler(from)} of ${us} notes that a compact with ${the(about)} may soon be sealed.`
        : `${ruler(from)} of ${us} offers a mutual alliance with ${them}, in force the moment both admiralties accept.`,
    belligerent: dissolving
      ? `The alliance is a fiction. Accept its end, or we will denounce it ourselves.${unless}`
      : third
        ? `Ally with us or watch ${us} bind ourselves to ${the(about)}. Isolation is a choice you will not survive.${unless}`
        : `Ally with us or we will find someone who will.${unless}`,
    aggressive: dissolving
      ? `${ruler(from)} ends the alliance. ${them} will acknowledge it.`
      : `${ruler(from)} sets the terms. ${them} will accept an alliance on the lines already indicated.`,
    polite: dissolving
      ? `${ruler(from)} of ${us} asks that we part as allies with clear eyes, and dissolve the compact.`
      : `${ruler(from)} of ${us} offers a mutual alliance to ${them}. Two civilizations, one frontier — in force the moment both accept.`,
    apologetic: dissolving
      ? `We must ask that the alliance end. We know we come as the lesser party.`
      : `The ${race} of ${us} ask for alliance terms. We know we come as the lesser party.`,
  };
  return lines[attitude];
}

function withClauses(
  body: string,
  opts: {
    state: GameState;
    topic: MessageTopic;
    terms?: DiplomacyTerms;
  },
): string {
  const { state, topic, terms } = opts;
  if (!terms) return body;
  const extra: string[] = [];
  if (topic !== "alliance") {
    if (terms.allianceClause === "form") {
      extra.push(
        resNonzero(terms.request) && !resNonzero(terms.give)
          ? "This is offered as a mutual alliance if they accept. The alliance takes force the moment both admiralties accept; the named goods still have to be scheduled as an ordinary delivery."
          : "This stands together with a mutual alliance, in force the moment both admiralties accept.",
      );
    } else if (terms.allianceClause === "break") {
      extra.push("Upon acceptance, our alliance is dissolved.");
    }
  }
  if (topic !== "trade" && (resNonzero(terms.give) || resNonzero(terms.request))) {
    extra.push(
      `Attached exchange: ${formatRes(terms.give)} landed at ${sys(state, terms.giveSystemId)}, against ${formatRes(terms.request)} delivered to ${sys(state, terms.requestSystemId)}. Goods move only if each admiralty separately orders the delivery.`,
    );
  }
  if (topic === "trade") {
    extra.push(
      "Agreeing records your word; each side must still schedule its own delivery.",
    );
  }
  return extra.length ? `${body} ${extra.join(" ")}` : body;
}

export function composeReply(opts: {
  state: GameState;
  from: Player;
  to: Player;
  topic: MessageTopic;
  attitude: Attitude;
  originalAttitude: Attitude;
  accept: boolean;
  terms?: DiplomacyTerms;
}): string {
  const { state, from, to, attitude, accept, terms, topic } = opts;
  const us = the(from.civ);
  const them = the(to.civ);
  const detail =
    topic === "trade" && (resNonzero(terms?.give) || resNonzero(terms?.request))
      ? accept
        ? ` The exchange stands: ${formatRes(terms?.give)} to ${sys(state, terms?.giveSystemId)}, against ${formatRes(terms?.request)} to ${sys(state, terms?.requestSystemId)}.`
        : ` We will not send ${formatRes(terms?.request)} to ${sys(state, terms?.requestSystemId)}.`
      : "";

  if (attitude === "neutral") {
    return `${us} has taken the matter under advisement. ${them} will have an answer in due course — or not.`;
  }
  if (attitude === "belligerent") {
    return accept
      ? `${us} notes your insolence and will remember it. Do not mistake our present restraint for weakness.`
      : `Your message is an insult. Repeat it and ${us} will answer with starfleets, not scribes.`;
  }
  if (attitude === "aggressive") {
    return accept
      ? `${us} agrees — for our own best interest, not yours. See that you perform your half.${detail}`
      : `${us} rejects this out of hand. Waste our time again and compensation will be extracted.`;
  }
  if (attitude === "polite") {
    return accept
      ? `${us} accepts, with thanks for the consideration shown by ${them}.${detail}`
      : `${us} must decline, with all due consideration. Perhaps another arrangement.`;
  }
  return accept
    ? `We comply — and apologize that ${us} did not already anticipate your desire.${detail}`
    : `We proclaim our loyalty even as we admit the thing cannot be done. Forgive the ${from.civ.racialName}.`;
}

export function sendThreadMessage(
  state: GameState,
  args: {
    fromId: string;
    toId: string;
    topic: MessageTopic;
    attitude: Attitude;
    systemId?: string;
    neighborId?: string;
    aboutPlayerId?: string;
    apparentFromId?: string;
    threadId?: string;
    accept?: boolean;
    originalAttitude?: Attitude;
    terms?: DiplomacyTerms;
    status?: DiplomacyMessage["status"];
  },
): DiplomacyThread {
  const from = state.players.find((p) => p.id === args.fromId)!;
  const to = state.players.find((p) => p.id === args.toId)!;
  const apparent = args.apparentFromId
    ? state.players.find((p) => p.id === args.apparentFromId)!
    : from;

  const raw =
    args.threadId && args.accept !== undefined
      ? composeReply({
          state,
          from: apparent,
          to,
          topic: args.topic,
          attitude: args.attitude,
          originalAttitude: args.originalAttitude ?? "neutral",
          accept: args.accept,
          terms: args.terms,
        })
      : composeMessage({
          state,
          from: apparent,
          to,
          topic: args.topic,
          attitude: args.attitude,
          systemId: args.systemId,
          neighborId: args.neighborId,
          aboutPlayerId: args.aboutPlayerId,
          terms: args.terms,
        });

  const text =
    args.accept !== undefined
      ? raw
      : withClauses(raw, { state, topic: args.topic, terms: args.terms });

  const msg: DiplomacyMessage = {
    id: uid("msg"),
    turn: state.turn,
    fromPlayerId: from.id,
    apparentFromId: apparent.id,
    toPlayerId: to.id,
    topic: args.topic,
    attitude: args.attitude,
    systemId: args.systemId,
    neighborId: args.neighborId,
    aboutPlayerId: args.aboutPlayerId,
    text,
    read: false,
    terms: args.terms,
    status: args.status ?? (args.terms ? "open" : undefined),
  };

  let thread = args.threadId
    ? state.threads.find((t) => t.id === args.threadId)
    : undefined;
  if (!thread) {
    thread = {
      id: uid("thr"),
      topic: args.topic,
      participants: [apparent.id, to.id],
      systemId: args.systemId,
      messages: [],
    };
    state.threads.push(thread);
  }
  thread.messages.push(msg);
  return thread;
}

export function previewDispatch(args: Parameters<typeof composeMessage>[0]): string {
  return withClauses(composeMessage(args), {
    state: args.state,
    topic: args.topic,
    terms: args.terms,
  });
}

export interface TermsView {
  incoming: string | null;
  outgoing: string | null;
  intent: string | null;
  canAccept: boolean;
  acceptHint: string;
  blockedReason: string | null;
}

function canFulfillDelivery(state: GameState, playerId: string, systemId?: string): boolean {
  if (!systemId) return false;
  const s = state.systems.find((x) => x.id === systemId);
  if (!s) return false;
  if (s.ownerId === playerId) return true;
  return s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === playerId);
}

export function viewTerms(
  state: GameState,
  msg: DiplomacyMessage,
  viewerId: string,
): TermsView {
  const t = msg.terms;
  if (!t) {
    return {
      incoming: null,
      outgoing: null,
      intent: "A statement of intent — no goods change hands if you reply.",
      canAccept: msg.status === "open" || msg.status === undefined,
      acceptHint: "Agreeing records your word. It does not move fleets; issue matching orders on the map.",
      blockedReason: null,
    };
  }

  const iAmRecipient = msg.toPlayerId === viewerId;
  const giveStr = resNonzero(t.give)
    ? `${formatRes(t.give)} → ${sys(state, t.giveSystemId)}`
    : null;
  const reqStr = resNonzero(t.request)
    ? `${formatRes(t.request)} → ${sys(state, t.requestSystemId)}`
    : null;

  const incoming = iAmRecipient ? giveStr : reqStr;
  const outgoing = iAmRecipient ? reqStr : giveStr;

  if (resNonzero(t.give) || resNonzero(t.request)) {
    const iPay = iAmRecipient ? t.request : t.give;
    const iDest = iAmRecipient ? t.requestSystemId : t.giveSystemId;
    const theyPay = iAmRecipient ? t.give : t.request;
    const theyId = iAmRecipient ? msg.fromPlayerId : msg.toPlayerId;
    const theyDest = iAmRecipient ? t.giveSystemId : t.requestSystemId;
    const me = state.players.find((p) => p.id === viewerId)!;
    let blocked: string | null = null;
    if (resNonzero(iPay)) {
      if (!canAfford(me.resources, iPay!)) blocked = `You cannot afford ${formatRes(iPay)} this turn.`;
      else if (!canFulfillDelivery(state, viewerId, iDest))
        blocked = `You do not border ${sys(state, iDest)}, so you cannot land a delivery there.`;
    }
    if (!blocked && resNonzero(theyPay) && theyDest) {
      if (!canFulfillDelivery(state, theyId, theyDest))
        blocked = `They no longer border ${sys(state, theyDest)} — the delivery cannot land.`;
    }
    const parts: string[] = [];
    if (outgoing) parts.push(`You send ${outgoing}.`);
    if (incoming) parts.push(`They send ${incoming}.`);
    if (!parts.length) parts.push("No goods are specified.");
    return {
      incoming,
      outgoing,
      intent: t.allianceClause === "form"
        ? iAmRecipient
          ? "Mutual alliance is sealed the moment you accept."
          : "Mutual alliance is sealed the moment they accept."
        : t.allianceClause === "break"
          ? iAmRecipient
            ? "Accepting dissolves the alliance immediately."
            : "They are asked to dissolve the alliance."
          : null,
      canAccept: !blocked && (msg.status === "open" || !msg.status),
      acceptHint: `If you accept, your word is recorded: ${parts.join(" ")} You must still schedule your own delivery on the map — accepting does not move goods.`,
      blockedReason: blocked,
    };
  }

  const intentBits: string[] = [];
  if (msg.topic === "attack") {
    const S = sys(state, msg.systemId);
    const N = msg.neighborId ? ` from ${sys(state, msg.neighborId)}` : "";
    if (t.intent === "vacate") intentBits.push(`They ask you to withdraw from ${S}.`);
    else if (t.intent === "you-attack") intentBits.push(`They ask you to strike ${S}${N}.`);
    else if (t.intent === "you-take") intentBits.push(`They will leave ${S}; they invite you to take it${N}.`);
    else intentBits.push(`They will move on ${S}${N}.`);
  } else if (msg.topic === "support") {
    const S = sys(state, msg.systemId);
    const N = msg.neighborId ? sys(state, msg.neighborId) : "an adjacent system";
    intentBits.push(
      t.intent === "i-support-you"
        ? `They offer supporting fire into ${S} from ${N}.`
        : `They ask you to support a movement into ${S} from ${N}.`,
    );
  } else if (msg.topic === "espionage") {
    intentBits.push(
      `Espionage: ${t.espionageKind ?? "sabotage"} at ${sys(state, msg.systemId)}` +
        (t.targetUpgrade ? ` (${t.targetUpgrade})` : "") +
        ".",
    );
  } else if (msg.topic === "alliance") {
    const other = state.players.find((p) => p.id === t.aboutPlayerId);
    intentBits.push(
      t.allianceClause === "break" || t.intent === "break"
        ? "They propose dissolving the alliance."
        : t.intent === "with-third"
          ? `They may ally with ${other ? the(other.civ) : "another power"}.`
          : "They offer a mutual alliance with you, in force the moment both accept.",
    );
  }
  if (t.allianceClause === "form" && msg.topic !== "alliance") {
    intentBits.push("Bundled: mutual alliance, sealed on accept.");
  }
  if (t.allianceClause === "break" && msg.topic !== "alliance") {
    intentBits.push("Bundled: the alliance is dissolved on accept.");
  }
  if (t.unless) intentBits.push(`Condition: unless you ${t.unless}.`);

  return {
    incoming,
    outgoing,
    intent: intentBits.join(" ") || null,
    canAccept: msg.status === "open" || !msg.status,
    acceptHint:
      "Agreeing records your word. It does not move fleets or spend Tech — issue matching orders yourself if you mean to act.",
    blockedReason: null,
  };
}

/** One-line summary of an offer, for collapsed threads and the turn report. */
export function offerHeadline(
  state: GameState,
  msg: DiplomacyMessage,
  viewerId: string,
): string {
  const v = viewTerms(state, msg, viewerId);
  const bits: string[] = [];
  if (v.incoming) bits.push(`they send ${v.incoming}`);
  if (v.outgoing) bits.push(`you send ${v.outgoing}`);
  if (v.intent) bits.push(v.intent);
  if (bits.length) return bits.join(" · ");
  return msg.text.length > 96 ? `${msg.text.slice(0, 96)}…` : msg.text;
}

function pushTrade(
  state: GameState,
  playerId: string,
  systemId: string,
  resources: Resources,
  toPlayerId?: string,
): string | null {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return "Unknown power.";
  if (!resNonzero(resources)) return null;
  if (!canFulfillDelivery(state, playerId, systemId))
    return `${p.civ.name} cannot deliver to ${sys(state, systemId)}.`;
  if (!canAfford(p.resources, resources))
    return `${p.civ.name} cannot afford ${formatRes(resources)}.`;
  p.resources = subRes(p.resources, resources);
  state.trades.push({
    id: uid("trd"),
    playerId,
    systemId,
    resources: cloneRes(resources),
    toPlayerId,
  });
  return null;
}

/** Schedule the viewer's half of a sealed pact (still a normal delivery order). */
export function schedulePactDelivery(
  state: GameState,
  playerId: string,
  pactId: string,
): string | null {
  const pact = (state.pacts ?? []).find((p) => p.id === pactId);
  if (!pact) return "No such bargain.";
  const half =
    playerId === pact.aId
      ? { resources: pact.give, systemId: pact.giveSystemId, otherId: pact.bId }
      : playerId === pact.bId
        ? { resources: pact.request, systemId: pact.requestSystemId, otherId: pact.aId }
        : null;
  if (!half) return "You are not a party to this bargain.";
  if (!resNonzero(half.resources) || !half.systemId) return "Nothing to send.";
  const already = state.trades.some(
    (t) =>
      t.playerId === playerId &&
      t.systemId === half.systemId &&
      t.resources.tech === half.resources.tech &&
      t.resources.metals === half.resources.metals &&
      t.resources.chon === half.resources.chon,
  );
  if (already) return "That delivery is already scheduled.";
  return pushTrade(state, playerId, half.systemId, half.resources, half.otherId);
}

export function acceptOffer(
  state: GameState,
  viewerId: string,
  messageId: string,
): string | null {
  const thread = state.threads.find((t) => t.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  if (msg.status && msg.status !== "open") return "That offer is already closed.";

  const view = viewTerms(state, msg, viewerId);
  if (!view.canAccept) return view.blockedReason ?? "Cannot accept.";

  const t = msg.terms ?? {};
  const clause =
    t.allianceClause ??
    (msg.topic === "alliance" && t.intent !== "with-third" ? "form" : undefined);

  if (clause === "form") {
    formAlliance(state, msg.fromPlayerId, viewerId);
  } else if (clause === "break") {
    breakAlliance(state, msg.fromPlayerId, viewerId);
  }

  const hasTrade = resNonzero(t.give) || resNonzero(t.request);
  if (hasTrade || clause) {
    sealPact(state, {
      messageId: msg.id,
      threadId: thread.id,
      aId: msg.fromPlayerId,
      bId: viewerId,
      give: t.give,
      giveSystemId: t.giveSystemId,
      request: t.request,
      requestSystemId: t.requestSystemId,
      allianceClause: clause,
    });
  }

  msg.status = "accepted";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude: "polite",
    threadId: thread.id,
    accept: true,
    originalAttitude: msg.attitude,
    terms: flipTerms(t),
    systemId: msg.systemId,
    status: "accepted",
  });
  return null;
}

export function declineOffer(
  state: GameState,
  viewerId: string,
  messageId: string,
  attitude: Attitude = "polite",
): string | null {
  const thread = state.threads.find((t) => t.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  msg.status = "declined";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude,
    threadId: thread.id,
    accept: false,
    originalAttitude: msg.attitude,
    terms: msg.terms,
    systemId: msg.systemId,
    status: "declined",
  });
  return null;
}

/** Immediately dissolve an alliance and notify the other party. */
export function denounceAlliance(
  state: GameState,
  fromId: string,
  toId: string,
  reason?: string,
): string | null {
  if (!areAllied(state, fromId, toId)) return "You are not allied with that power.";
  breakAlliance(state, fromId, toId);
  sendThreadMessage(state, {
    fromId,
    toId,
    topic: "alliance",
    attitude: "belligerent",
    terms: {
      allianceClause: "break",
      intent: "with-you",
      unless: reason,
    },
    status: "accepted",
  });
  return null;
}

export function respondToIncident(
  state: GameState,
  viewerId: string,
  incidentId: string,
  action: "ignored" | "broke" | "threatened",
  unless?: string,
): string | null {
  const inc = (state.allyIncidents ?? []).find((i) => i.id === incidentId);
  if (!inc) return "No such incident.";
  if (inc.victimId !== viewerId) return "That grievance is not yours.";
  if (inc.status !== "open") return "Already answered.";
  inc.status = action;
  if (action === "broke") {
    return denounceAlliance(state, viewerId, inc.actorId, inc.text);
  }
  if (action === "threatened") {
    sendThreadMessage(state, {
      fromId: viewerId,
      toId: inc.actorId,
      topic: "alliance",
      attitude: "belligerent",
      systemId: inc.systemId,
      terms: {
        allianceClause: areAllied(state, viewerId, inc.actorId) ? undefined : "break",
        intent: "with-you",
        unless: unless || "make amends for the slight",
      },
      status: "open",
    });
  }
  return null;
}

export function counterOffer(
  state: GameState,
  viewerId: string,
  messageId: string,
  terms: DiplomacyTerms,
): string | null {
  const thread = state.threads.find((t) => t.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  msg.status = "countered";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude: "polite",
    threadId: thread.id,
    terms,
    systemId: terms.giveSystemId ?? terms.requestSystemId ?? msg.systemId,
    neighborId: msg.neighborId,
    aboutPlayerId: terms.aboutPlayerId ?? msg.aboutPlayerId,
    status: "open",
  });
  return null;
}

export function visibleThreads(
  state: GameState,
  viewerId: string,
): DiplomacyThread[] {
  const intercepts = state.espionage.filter(
    (e) => e.kind === "intercept" && e.playerId === viewerId,
  );
  return state.threads.filter((t) => {
    if (t.participants.includes(viewerId)) return true;
    if (t.messages.some((m) => m.fromPlayerId === viewerId)) return true;
    return intercepts.some(
      (e) =>
        e.otherPlayerId &&
        e.thirdPlayerId &&
        t.participants.includes(e.otherPlayerId) &&
        t.participants.includes(e.thirdPlayerId),
    );
  });
}

export function unreadCount(state: GameState, viewerId: string): number {
  return visibleThreads(state, viewerId).reduce(
    (n, t) =>
      n +
      t.messages.filter((m) => m.toPlayerId === viewerId && !m.read).length,
    0,
  );
}

export function markThreadRead(state: GameState, threadId: string, viewerId: string) {
  const t = state.threads.find((x) => x.id === threadId);
  if (!t) return;
  for (const m of t.messages) {
    if (m.toPlayerId === viewerId) m.read = true;
  }
}

export function borderingTheirSystems(
  state: GameState,
  meId: string,
  themId: string,
): string[] {
  return state.systems
    .filter(
      (s) =>
        s.ownerId === themId &&
        s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === meId),
    )
    .map((s) => s.id);
}

/** Systems this player may land a delivery on (not owned by them, adjacent to them). */
export function legalTradeDestinations(state: GameState, playerId: string): string[] {
  return state.systems
    .filter(
      (s) =>
        s.ownerId !== playerId &&
        s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === playerId),
    )
    .map((s) => s.id);
}

/** Landing sites the sender can still reach that the recipient owns or also borders. */
export function tradeFrontier(
  state: GameState,
  senderId: string,
  recipientId: string,
): string[] {
  const targeted = new Set<string>();
  for (const s of state.systems) {
    for (const f of s.fleets) {
      if (f.order.kind === "move" && f.order.destId) targeted.add(f.order.destId);
    }
  }
  const dests = legalTradeDestinations(state, senderId).filter((id) => !targeted.has(id));
  const ownedByThem = dests.filter(
    (id) => state.systems.find((s) => s.id === id)?.ownerId === recipientId,
  );
  if (ownedByThem.length) return ownedByThem;
  const shared = dests.filter((id) => {
    const s = state.systems.find((x) => x.id === id);
    if (!s) return false;
    return s.neighbors.some(
      (n) => state.systems.find((x) => x.id === n)?.ownerId === recipientId,
    );
  });
  return shared.length ? shared : dests;
}

export function flipTerms(t: DiplomacyTerms): DiplomacyTerms {
  return {
    ...t,
    give: t.request ? cloneRes(t.request) : cloneRes(ZERO),
    giveSystemId: t.requestSystemId,
    request: t.give ? cloneRes(t.give) : cloneRes(ZERO),
    requestSystemId: t.giveSystemId,
  };
}

/** Draft a counter from the original author's terms (same numbers, new speaker). */
export function draftCounter(
  original: DiplomacyTerms | undefined,
  sendDests: string[],
  receiveDests: string[],
): DiplomacyTerms {
  const pick = (ids: string[], preferred?: string) =>
    preferred && ids.includes(preferred) ? preferred : (ids[0] ?? undefined);
  return {
    give: cloneRes(original?.give ?? ZERO),
    request: cloneRes(original?.request ?? ZERO),
    giveSystemId: pick(sendDests, original?.giveSystemId),
    requestSystemId: pick(receiveDests, original?.requestSystemId),
    allianceClause: original?.allianceClause,
    intent: original?.allianceClause === "form" ? "with-you" : original?.intent,
  };
}

export const TOPICS: { id: MessageTopic; label: string; needsSystem: boolean }[] =
  [
    { id: "attack", label: "Attacking a solar system", needsSystem: true },
    { id: "support", label: "Providing support", needsSystem: true },
    { id: "trade", label: "Trade resources", needsSystem: false },
    { id: "espionage", label: "Providing espionage", needsSystem: true },
    { id: "intelligence", label: "Providing intelligence", needsSystem: false },
    { id: "alliance", label: "Providing alliance", needsSystem: false },
  ];

export const ATTACK_INTENTS: { id: NonNullable<DiplomacyTerms["intent"]>; label: string }[] = [
  { id: "i-attack", label: "I will attack this system" },
  { id: "vacate", label: "Withdraw from this system" },
  { id: "you-attack", label: "You attack this system" },
  { id: "you-take", label: "I leave; you may take it" },
];

export const SUPPORT_INTENTS: { id: NonNullable<DiplomacyTerms["intent"]>; label: string }[] = [
  { id: "support-me", label: "Support my movement into this system" },
  { id: "i-support-you", label: "I will support your movement" },
];

export {
  areAllied,
  alliesOf,
  legalAttackSystems,
  legalEspionageSystems,
  legalMessageSystems,
  playerReaches,
} from "./alliance";
