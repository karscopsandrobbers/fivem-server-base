/*
 * The ped director: what the server asked of a ped, performed by the client that controls it.
 *
 * The server writes one activity per ped on the ped's `brain` bag. Every client that can see the
 * ped reads it; the one with network control puts the act on the ped, keeps it there through a
 * stream-out and back, and says what came of it. Control moves as players move, so the act is
 * put back by whoever has it now.
 *
 * Reflexes are the client's own decisions about the game's people it controls, through the same
 * performers and the same priorities, never on the bag. A reflex is refused where the server has
 * asked something that outranks it, and a directed act waits out a reflex that outranks it.
 */
import { EVENTS } from '@shared/events';
import { ACTIVITY, ActivityKind, BRAIN, BrainView, PED_ROLE, PRIORITY, PedReport } from '@shared/peds/pedBrain';
import { describeTraits } from '@shared/peds/pedTraits';
import { drawTextFromWorld } from '../../../gui';
import { debugging } from '../../debug';
import { createGatedTick } from '../../lifecycle';
import { takeControl } from '../anims';
import { PERFORMERS, Performer, Scratch } from './acts';
import { PedSnapshot, nearbyPeds, onPedSeen } from './perception';

interface Directed {
	netId: number;
	view: BrainView;
	/** The activity this client last put on the ped, so it goes on once and again only when it changes. */
	applied: string;
	/** The kind whose act is physically on the ped, to be cleared before the next one. */
	performing: ActivityKind | null;
	/** Outcomes already sent about this activity: each is said once. */
	told: Set<string>;
	scratch: Scratch;
	/** A clip is loading, or the previous act is coming off: nothing else touches the ped until it is done. */
	busy: boolean;
	/** After a reflex that put them on the floor, the get-up before the directed act goes back on. */
	holdUntil: number;
}

interface Reflex {
	kind: ActivityKind;
	view: BrainView;
	until: number;
	scratch: Scratch;
	applied: boolean;
	busy: boolean;
}

/** Every ped in scope wearing a brain bag. */
const known = new Map<number, Directed>();
/** The game's own people this client has decided something about. */
const reflexes = new Map<number, Reflex>();

const noBagFilter = null as unknown as string;

const keyOf = (view: BrainView): string => `${view.kind}:${view.since}:${view.until}:${view.target}`;

export const isDirected = (ped: number): boolean => known.has(ped);

export const directedKind = (ped: number): ActivityKind | null => known.get(ped)?.view.kind ?? null;

/** Face down right now, by the server's word or this client's. */
export const isDown = (ped: number): boolean => (
	known.get(ped)?.view.kind === ACTIVITY.DOWN || reflexes.get(ped)?.kind === ACTIVITY.DOWN
);

const report = (entry: Directed, outcome: PedReport): void => {
	const key = `${outcome}:${entry.view.kind}:${entry.view.since}`;

	if(!entry.told.has(key)) {
		entry.told.add(key);
		emitNet(EVENTS.SERVER_PED_REPORT, entry.netId, outcome);
	}
};

/** Back to being nobody in particular: what a released ambient ped gets from whoever controls it. */
const restore = (ped: number): void => {
	if(!DoesEntityExist(ped) || !NetworkHasControlOfEntity(ped)) {
		return;
	}
	ClearPedTasks(ped);
	SetBlockingOfNonTemporaryEvents(ped, false);
	SetPedFleeAttributes(ped, 0, true);
	SetPedCombatAttributes(ped, 5, false);
	SetPedCombatAttributes(ped, 46, false);
};

const release = (ped: number): void => {
	const entry = known.get(ped);

	if(!entry) {
		return;
	}
	known.delete(ped);
	if(entry.performing) {
		void PERFORMERS[entry.performing].clear?.(ped, entry.scratch);
	}
	restore(ped);
};

const adopt = (ped: number, view: BrainView): void => {
	const entry = known.get(ped);

	if(entry) {
		if(keyOf(entry.view) !== keyOf(view)) {
			entry.told.clear();
		}
		entry.view = view;
		return;
	}
	known.set(ped, {
		netId: NetworkGetNetworkIdFromEntity(ped),
		view,
		applied: '',
		performing: null,
		told: new Set(),
		scratch: {},
		busy: false,
		holdUntil: 0,
	});
};

const noBagSince = new Map<number, number>();
const NO_BAG_RECHECK_MS = 5000;

const adoptFromBag = (ped: number): void => {
	if(known.has(ped) || IsPedAPlayer(ped)) {
		return;
	}

	const now = GetGameTimer();

	if(now - (noBagSince.get(ped) ?? -Infinity) < NO_BAG_RECHECK_MS) {
		return;
	}
	try {
		const view = Entity(ped).state.brain as BrainView | null | undefined;

		if(view && typeof view === 'object') {
			noBagSince.delete(ped);
			adopt(ped, view);
			return;
		}
	} catch{
		// Not networked: not one of ours.
	}
	noBagSince.set(ped, now);
	if(noBagSince.size > 512) {
		for(const [handle, at] of noBagSince) {
			if(now - at >= NO_BAG_RECHECK_MS || !DoesEntityExist(handle)) {
				noBagSince.delete(handle);
			}
		}
	}
};

AddStateBagChangeHandler('brain', noBagFilter, (bagName: string, _key: string, value: BrainView | null) => {
	const entity = GetEntityFromStateBagName(bagName);

	if(entity === 0 || !DoesEntityExist(entity) || !IsEntityAPed(entity)) {
		return;
	}
	if(!value || typeof value !== 'object') {
		release(entity);
		return;
	}
	adopt(entity, value);
});

onPedSeen(adoptFromBag);

// ── performing ─────────────────────────────────────────────────────────────

const perform = async (ped: number, entry: Directed, performer: Performer, key: string, now: number, unix: number): Promise<void> => {
	entry.busy = true;
	try {
		const previous = entry.performing;

		if(previous && previous !== entry.view.kind) {
			await PERFORMERS[previous].clear?.(ped, entry.scratch);
			entry.performing = null;
			entry.scratch = {};
		}
		if(!DoesEntityExist(ped) || !NetworkHasControlOfEntity(ped) || known.get(ped) !== entry) {
			return;
		}
		if(await performer.apply(ped, entry.view, entry.scratch, previous, now, unix)) {
			entry.applied = key;
			entry.performing = entry.view.kind;
			if(performer.started) {
				report(entry, performer.started);
			}
		}
	} finally {
		entry.busy = false;
	}
};

const applyReflex = (ped: number, entry: Reflex, previous: ActivityKind | null, now: number, unix: number): void => {
	entry.busy = true;
	void Promise.resolve(PERFORMERS[entry.kind].apply(ped, entry.view, entry.scratch, previous, now, unix))
		.then(ok => {
			entry.applied = ok;
		})
		.finally(() => {
			entry.busy = false;
		});
};

const endReflex = (ped: number, reflex: Reflex, now: number): void => {
	reflexes.delete(ped);
	void PERFORMERS[reflex.kind].clear?.(ped, reflex.scratch);

	const directed = known.get(ped);

	if(directed) {
		directed.applied = '';
		directed.holdUntil = reflex.kind === ACTIVITY.DOWN ? now + BRAIN.RECOVERY_MS : 0;
	} else if(reflex.kind === ACTIVITY.DOWN || reflex.kind === ACTIVITY.WARY) {
		restore(ped);
	}
};

/**
 * This client's own decision about a ped it controls. Refused for a ped the server has given
 * something that outranks it, or that is already in the grip of a stronger reflex.
 */
export const reflex = (ped: number, kind: ActivityKind, options: { at?: { x: number; y: number; z: number } | null; target?: number; until?: number; params?: Record<string, unknown> } = {}): boolean => {
	if(!DoesEntityExist(ped) || IsPedAPlayer(ped) || !NetworkHasControlOfEntity(ped)) {
		return false;
	}

	const directed = known.get(ped);

	if(directed && PRIORITY[directed.view.kind] >= PRIORITY[kind]) {
		return false;
	}

	const current = reflexes.get(ped);

	if(current) {
		if(PRIORITY[current.kind] > PRIORITY[kind]) {
			return false;
		}
		if(current.kind === kind) {
			current.until = options.until ?? 0;
			return true;
		}
		reflexes.delete(ped);
		void PERFORMERS[current.kind].clear?.(ped, current.scratch);
	}

	const now = GetGameTimer();
	const unix = Date.now() / 1000;
	const view: BrainView = { role: PED_ROLE.REFLEX, kind, since: unix, until: options.until ?? 0, target: options.target ?? 0, at: options.at ?? null, params: options.params ?? {} };
	const entry: Reflex = { kind, view, until: options.until ?? 0, scratch: {}, applied: false, busy: false };

	reflexes.set(ped, entry);
	if(directed) {
		directed.applied = '';
	}
	applyReflex(ped, entry, current?.kind ?? null, now, unix);
	return true;
};

export const clearReflex = (ped: number, kind?: ActivityKind): void => {
	const current = reflexes.get(ped);

	if(current && (!kind || current.kind === kind)) {
		endReflex(ped, current, GetGameTimer());
	}
};

export const reflexKind = (ped: number): ActivityKind | null => reflexes.get(ped)?.kind ?? null;

setInterval(() => {
	const now = GetGameTimer();
	const unix = Date.now() / 1000;
	const me = GetPlayerServerId(PlayerId());

	for(const [ped, current] of reflexes) {
		if(!DoesEntityExist(ped) || IsEntityDead(ped)) {
			reflexes.delete(ped);
			continue;
		}
		if((current.until > 0 && unix >= current.until) || !NetworkHasControlOfEntity(ped)) {
			endReflex(ped, current, now);
			continue;
		}
		if(!current.applied) {
			if(!current.busy) {
				applyReflex(ped, current, null, now, unix);
			}
			continue;
		}
		PERFORMERS[current.kind].tick?.(ped, current.view, current.scratch, now, unix, me);
	}

	for(const [ped, entry] of known) {
		if(!DoesEntityExist(ped)) {
			known.delete(ped);
			continue;
		}
		if(entry.view.kind !== ACTIVITY.DEAD && IsPedDeadOrDying(ped, true)) {
			report(entry, 'dead');
			continue;
		}
		if(entry.busy || now < entry.holdUntil) {
			continue;
		}

		const held = reflexes.get(ped);

		if(held && PRIORITY[held.kind] > PRIORITY[entry.view.kind]) {
			// A stare is curiosity and never keeps the server waiting.
			if(held.kind !== ACTIVITY.WARY) {
				entry.applied = '';
				continue;
			}
			endReflex(ped, held, now);
		}

		const performer = PERFORMERS[entry.view.kind];

		if(!NetworkHasControlOfEntity(ped)) {
			entry.applied = '';
			// Somebody else's to task, unless this is the one client that should have it.
			if(performer.claim?.(entry.view, me, ped)) {
				entry.busy = true;
				void takeControl(ped).then(() => {
					entry.busy = false;
				});
			}
			continue;
		}

		const key = keyOf(entry.view);

		if(entry.applied !== key) {
			void perform(ped, entry, performer, key, now, unix);
			continue;
		}

		const outcome = performer.tick?.(ped, entry.view, entry.scratch, now, unix, me) ?? null;

		if(outcome) {
			report(entry, outcome);
		}
	}
}, BRAIN.POLL_MS);

// ── the phone, for everyone to see ─────────────────────────────────────────

const onACall = (view: BrainView, unix: number): boolean => view.kind === ACTIVITY.PHONE && (view.until <= 0 || unix < view.until);

createGatedTick(() => known.size > 0, () => {
	const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);
	const unix = Date.now() / 1000;

	for(const [ped, entry] of known) {
		if(!DoesEntityExist(ped) || !onACall(entry.view, unix)) {
			continue;
		}

		const [x, y, z] = GetEntityCoords(ped, false);
		const distance = Vdist(px, py, pz, x, y, z);

		if(distance > BRAIN.MARKER_RANGE) {
			continue;
		}
		DrawMarker(0, x, y, z + 1.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.25, 0.25, 255, 60, 60, 200, true, false, 2, false, undefined as unknown as string, undefined as unknown as string, false);
		if(distance <= BRAIN.HEAR_RANGE) {
			const left = entry.view.until > 0 ? `~n~${Math.max(0, Math.ceil(entry.view.until - unix))}s` : '';

			drawTextFromWorld(`~r~On the phone to the police~s~${left}`, [x, y, z + 1.0], 4, [255, 255, 255, 255], 0.3);
		}
	}
});

// ── the debug overlay ──────────────────────────────────────────────────────

const fightReadout = (ped: number): string => {
	const group = GetPedRelationshipGroupHash(ped);
	const towardsPlayer = GetRelationshipBetweenGroups(group, GetHashKey('PLAYER'));
	const doing = IsPedFleeing(ped) ? '~r~FLEEING' : IsPedInCombat(ped, PlayerPedId()) ? '~g~in combat' : '~o~neither';

	// 5 is hate, the only value that fights.
	return `  ${doing}~s~ · feels ${towardsPlayer === 5 ? '~g~hate' : `~r~${towardsPlayer}`}~s~ · armed ${IsPedArmed(ped, 7) ? '~g~yes' : '~r~no'}~s~ · group ${group}`;
};

type DebugAnnotator = (entry: PedSnapshot) => string | null;

const annotators: DebugAnnotator[] = [];

/** Say something about a ped in the `peds` channel. */
export const onPedDebug = (annotator: DebugAnnotator): void => {
	annotators.push(annotator);
};

createGatedTick(() => debugging('peds'), () => {
	for(const entry of nearbyPeds()) {
		if(entry.isPlayer || entry.distance > BRAIN.MARKER_RANGE) {
			continue;
		}

		const directed = known.get(entry.ped);
		const held = reflexes.get(entry.ped);
		const mine = entry.mine ? '~g~mine' : '~r~theirs';
		const who = entry.isServer ? '~b~server' : '~s~ambient';
		const lines: string[] = [`~c~${GetEntityArchetypeName(entry.ped) || `0x${(entry.model >>> 0).toString(16)}`}`];

		if(directed) {
			lines.push(`~y~${directed.view.role}/${directed.view.kind}~s~ · ${mine}~s~ · doing ${directed.performing ?? '-'}`);

			const traits = directed.view.traits ? describeTraits(directed.view.traits) : '';

			if(traits) {
				lines.push(`~s~${traits}`);
			}
		}
		if(held) {
			lines.push(`~o~reflex/${held.kind}~s~${held.until > 0 ? ` ${Math.max(0, Math.ceil(held.until - Date.now() / 1000))}s` : ''} · ${mine}`);
			if(held.kind === ACTIVITY.FIGHT) {
				lines.push(fightReadout(entry.ped));
			}
		}
		if(!directed && !held) {
			lines.push(`${who}~s~ · ${mine}~s~ · ${entry.dead ? '~r~dead' : 'no brain, no reflex'}`);
		}
		for(const annotator of annotators) {
			const line = annotator(entry);

			if(line) {
				lines.push(line);
			}
		}
		lines.forEach((line, index) => {
			drawTextFromWorld(line, [entry.x, entry.y, entry.z + 1.4 - index * 0.13], 4, [255, 255, 255, 255], 0.28);
		});
	}
});

// ── a gun on one of them ───────────────────────────────────────────────────

/** Said once per target; the server decides what it does to them. */
let aimedAt = 0;
let aimedSince = 0;
let heldSaid = false;

setInterval(() => {
	const player = PlayerId();
	let target = 0;

	if(IsPlayerFreeAiming(player) || IsPlayerTargettingAnything(player)) {
		// Every person in range, directed or not: the server takes the game's own people on a gun.
		for(const entry of nearbyPeds()) {
			if(entry.isPlayer || entry.dead || !entry.netId || entry.distance > BRAIN.AIM_RANGE) {
				continue;
			}
			if(IsPlayerFreeAimingAtEntity(player, entry.ped) || IsPlayerTargettingEntity(player, entry.ped)) {
				target = entry.netId;
				break;
			}
		}
	}

	const now = GetGameTimer();

	if(target !== aimedAt) {
		aimedSince = now;
		heldSaid = false;
		if(target) {
			emitNet(EVENTS.SERVER_PED_AIMED_AT, target);
		}
	} else if(target && !heldSaid && now - aimedSince >= BRAIN.AIM_HOLD_MS) {
		heldSaid = true;
		emitNet(EVENTS.SERVER_PED_AIM_HELD, target);
	}
	aimedAt = target;
}, BRAIN.AIM_POLL_MS);
