/*
 * The server half of the ped brain: the stack per ped, and the one place that writes the bag.
 *
 * Every system that wants something of a ped asks here and is told yes or no. Yes puts the
 * activity on the ped's stack and, if it is the top, on the ped's state bag for the clients. No
 * means the ped is busier than that, and the caller is expected to cope: the stack remembers.
 *
 * A leaf on purpose: nothing here knows what a role means. Systems listen for reports through the
 * role handlers instead, which is what keeps this loadable from the ped pool itself.
 */
import { ACTIVITY, ActivityKind, BrainView, IdleParams, PRIORITY, PedReport, PedRole } from '@shared/peds/pedBrain';
import { NEUTRAL_TRAITS, PedTraits, traitsFor } from '@shared/peds/pedTraits';
import { getTimestamp } from '@shared/index';
import type { Activity, PedBrain, RequestOptions } from './types';

type ReportHandler = (brain: PedBrain, report: PedReport, kind: ActivityKind) => void;
type AimHandler = (brain: PedBrain, playerId: number) => void;

const BAG_KEY = 'brain';

const handleOf = (netId: number): number => {
	const handle = netId ? NetworkGetEntityFromNetworkId(netId) : 0;

	return handle && DoesEntityExist(handle) ? handle : 0;
};

const topOf = (brain: PedBrain): Activity => brain.stack[brain.stack.length - 1];

/** A seed that names the same person every time: a posted ped by where it was put, an ambient one by its net id. */
const traitSeed = (handle: number, netId: number, origin?: { x: number; y: number; z: number }): number => {
	const model = Math.imul(GetEntityModel(handle) >>> 0, 0x27d4eb2d);

	if(origin) {
		return (Math.imul(Math.round(origin.x * 4), 73856093) ^ Math.imul(Math.round(origin.y * 4), 19349663) ^ Math.imul(Math.round(origin.z * 4), 83492791) ^ model) >>> 0;
	}
	return (netId ^ model) >>> 0;
};

/** 0 for a moment after creation: a server ped is not addressable on its first tick, so it is asked again. */
const netIdOf = (brain: PedBrain): number => {
	if(!brain.netId && DoesEntityExist(brain.handle)) {
		brain.netId = NetworkGetNetworkIdFromEntity(brain.handle);
	}
	return brain.netId;
};

/** The top of the stack, written once per change: a write that changes nothing replicates nothing. */
const publish = (brain: PedBrain): void => {
	const top = topOf(brain);
	const view: BrainView = { role: brain.role, kind: top.kind, since: top.since, until: top.until, target: top.target, at: top.at, params: top.params, traits: brain.traits };
	const key = JSON.stringify(view);

	if(key === brain.published) {
		return;
	}
	brain.published = key;
	if(DoesEntityExist(brain.handle)) {
		Entity(brain.handle).state.set(BAG_KEY, view, true);
	}
};

class PedBrainService {
	private readonly brains = new Map<number, PedBrain>();
	private readonly reportHandlers = new Map<PedRole, ReportHandler[]>();
	private readonly aimHandlers = new Map<PedRole, AimHandler[]>();
	private readonly aimHeldHandlers = new Map<PedRole, AimHandler[]>();
	private nextToken = 1;

	/**
	 * Give a ped a brain. A server ped gets one at birth (entities/PedsEntity); an ambient one when
	 * a system takes it, and then only if nothing else has: a ped answers to one role at a time.
	 */
	adopt(handle: number, role: PedRole, options: { ambient?: boolean; idle?: IdleParams; origin?: { x: number; y: number; z: number } } = {}): PedBrain | null {
		if(!handle || !DoesEntityExist(handle)) {
			return null;
		}

		const existing = this.brains.get(handle);

		if(existing) {
			return existing.role === role ? existing : null;
		}

		const netId = NetworkGetNetworkIdFromEntity(handle);
		const brain: PedBrain = {
			handle,
			netId,
			role,
			ambient: options.ambient === true,
			traits: options.origin || netId ? traitsFor(traitSeed(handle, netId, options.origin)) : { ...NEUTRAL_TRAITS },
			stack: [this.activity(ACTIVITY.IDLE, { params: { ...(options.idle ?? {}) } })],
			timer: null,
			published: '',
		};

		this.brains.set(handle, brain);
		publish(brain);
		return brain;
	}

	/** The ped is nobody's any more: the bag is cleared for the clients and the stack forgotten. */
	forget(handle: number): void {
		const brain = this.brains.get(handle);

		if(!brain) {
			return;
		}
		if(brain.timer) {
			clearTimeout(brain.timer);
		}
		this.brains.delete(handle);
		if(DoesEntityExist(handle)) {
			Entity(handle).state.set(BAG_KEY, null, true);
		}
	}

	byNetId(netId: number): PedBrain | null {
		if(!netId) {
			return null;
		}
		for(const brain of this.brains.values()) {
			if(netIdOf(brain) === netId) {
				return brain;
			}
		}
		return null;
	}

	byHandle(handle: number): PedBrain | null {
		return this.brains.get(handle) ?? null;
	}

	current(handle: number): Activity | null {
		const brain = this.brains.get(handle);

		return brain ? topOf(brain) : null;
	}

	traitsOf(handle: number): PedTraits {
		return this.brains.get(handle)?.traits ?? { ...NEUTRAL_TRAITS };
	}

	has(handle: number, kind: ActivityKind): boolean {
		return this.brains.get(handle)?.stack.some(entry => entry.kind === kind) ?? false;
	}

	/** Would a request of this kind be refused right now? */
	busierThan(handle: number, kind: ActivityKind): boolean {
		const brain = this.brains.get(handle);

		if(!brain) {
			return true;
		}

		const top = topOf(brain);

		return top.kind === ACTIVITY.DEAD || PRIORITY[top.kind] > PRIORITY[kind];
	}

	/**
	 * Ask the ped to do something. Refused when the ped is dead or doing something that outranks
	 * it. An activity of a kind already on the stack is replaced where it stands; otherwise it goes
	 * on top, equal priority included.
	 */
	request(handle: number, kind: ActivityKind, options: RequestOptions = {}): boolean {
		const brain = this.brains.get(handle);

		if(!brain || kind === ACTIVITY.IDLE) {
			return false;
		}
		this.prune(brain);

		const top = topOf(brain);

		if(top.kind === ACTIVITY.DEAD || PRIORITY[top.kind] > PRIORITY[kind]) {
			return false;
		}

		const activity = this.activity(kind, options);
		const index = brain.stack.findIndex(entry => entry.kind === kind);

		if(index === -1) {
			brain.stack.push(activity);
		} else {
			brain.stack[index] = activity;
		}
		publish(brain);
		this.schedule(brain);
		return true;
	}

	/** Take an activity back: by kind, or by the token the request was given. Whatever is beneath resumes. */
	release(handle: number, kindOrToken: ActivityKind | string): boolean {
		const brain = this.brains.get(handle);

		if(!brain) {
			return false;
		}

		const before = brain.stack.length;

		brain.stack = brain.stack.filter(entry => entry.kind === ACTIVITY.IDLE || (entry.kind !== kindOrToken && entry.token !== kindOrToken));
		if(brain.stack.length === before) {
			return false;
		}
		publish(brain);
		this.schedule(brain);
		return true;
	}

	/** Change the post: what the ped goes back to when everything else is done. */
	setIdle(handle: number, idle: IdleParams): void {
		const brain = this.brains.get(handle);

		if(brain) {
			brain.stack[0] = this.activity(ACTIVITY.IDLE, { params: { ...idle } });
			publish(brain);
		}
	}

	/** The ped is dead: nothing else is ever asked of it. */
	died(handle: number): void {
		const brain = this.brains.get(handle);

		if(!brain || topOf(brain).kind === ACTIVITY.DEAD) {
			return;
		}
		if(brain.timer) {
			clearTimeout(brain.timer);
			brain.timer = null;
		}
		brain.stack.push(this.activity(ACTIVITY.DEAD, {}));
		publish(brain);
	}

	onReport(role: PedRole, handler: ReportHandler): void {
		this.reportHandlers.set(role, [...(this.reportHandlers.get(role) ?? []), handler]);
	}

	onAimedAt(role: PedRole, handler: AimHandler): void {
		this.aimHandlers.set(role, [...(this.aimHandlers.get(role) ?? []), handler]);
	}

	/** A gun held on a ped past BRAIN.AIM_HOLD_MS. */
	onAimHeld(role: PedRole, handler: AimHandler): void {
		this.aimHeldHandlers.set(role, [...(this.aimHeldHandlers.get(role) ?? []), handler]);
	}

	/** The client performing a ped's activity says what came of it. */
	report(netId: number, report: PedReport): void {
		const brain = this.byNetId(netId);

		if(!brain) {
			return;
		}

		const kind = topOf(brain).kind;

		if(report === 'dead') {
			this.died(brain.handle);
		}
		this.dispatch(brain, report, kind);
		if(report === 'gone' && brain.ambient) {
			this.forget(brain.handle);
		}
	}

	aimedAt(playerId: number, netId: number): void {
		const brain = this.byNetId(netId);

		if(brain) {
			for(const handler of this.aimHandlers.get(brain.role) ?? []) {
				handler(brain, playerId);
			}
		}
	}

	aimHeld(playerId: number, netId: number): void {
		const brain = this.byNetId(netId);

		if(brain) {
			for(const handler of this.aimHeldHandlers.get(brain.role) ?? []) {
				handler(brain, playerId);
			}
		}
	}

	/** Ambient peds that are nowhere any more are gone; server peds the engine dropped are forgotten. */
	sweep(): void {
		for(const brain of [...this.brains.values()]) {
			if(brain.ambient) {
				if(!handleOf(netIdOf(brain))) {
					this.dispatch(brain, 'gone', topOf(brain).kind);
					this.forget(brain.handle);
				}
			} else if(!DoesEntityExist(brain.handle)) {
				this.forget(brain.handle);
			}
		}
	}

	/** The nearest living, standing ped of this role within range. */
	nearestOfRole(role: PedRole, x: number, y: number, z: number, range: number): number | null {
		let best: number | null = null;
		let bestDistance = range;

		for(const brain of this.brains.values()) {
			if(brain.role !== role || !DoesEntityExist(brain.handle)) {
				continue;
			}

			const top = topOf(brain);

			if(top.kind === ACTIVITY.DEAD || top.kind === ACTIVITY.DOWN) {
				continue;
			}

			const [px, py, pz] = GetEntityCoords(brain.handle);
			const distance = Math.hypot(px - x, py - y, pz - z);

			if(distance <= bestDistance) {
				best = brain.handle;
				bestDistance = distance;
			}
		}
		return best;
	}

	/** Every ped with a brain, for the log. */
	describe(): string[] {
		return [...this.brains.values()].map(brain => (
			`${brain.role}${brain.ambient ? ' (ambient)' : ''} #${brain.handle}: ${brain.stack.map(entry => entry.kind).join(' < ')}`
		));
	}

	private activity(kind: ActivityKind, options: RequestOptions): Activity {
		return {
			kind,
			params: options.params ?? {},
			target: options.target ?? 0,
			at: options.at ?? null,
			since: getTimestamp(),
			until: options.until ?? 0,
			token: options.token ?? `${kind}#${this.nextToken++}`,
		};
	}

	/** Entries whose time has run out while something outranked them are dropped, and their systems told. */
	private prune(brain: PedBrain): void {
		const now = getTimestamp();
		const expired = brain.stack.filter(entry => entry.until > 0 && entry.until <= now && entry.kind !== ACTIVITY.IDLE);

		if(!expired.length) {
			return;
		}
		brain.stack = brain.stack.filter(entry => !expired.includes(entry));
		for(const entry of expired) {
			this.dispatch(brain, 'done', entry.kind);
		}
	}

	/** One timer per ped, on the top's own clock: when it runs out the entry goes and the system is told. */
	private schedule(brain: PedBrain): void {
		if(brain.timer) {
			clearTimeout(brain.timer);
			brain.timer = null;
		}

		const top = topOf(brain);

		if(top.until <= 0 || top.kind === ACTIVITY.DEAD) {
			return;
		}
		brain.timer = setTimeout(() => {
			brain.timer = null;
			if(!this.brains.has(brain.handle)) {
				return;
			}
			if(topOf(brain) !== top) {
				this.schedule(brain);
				return;
			}
			brain.stack = brain.stack.filter(entry => entry !== top);
			publish(brain);
			this.schedule(brain);
			this.dispatch(brain, 'done', top.kind);
		}, Math.max(0, (top.until - getTimestamp()) * 1000));
	}

	private dispatch(brain: PedBrain, report: PedReport, kind: ActivityKind): void {
		for(const handler of this.reportHandlers.get(brain.role) ?? []) {
			handler(brain, report, kind);
		}
	}
}

export const pedBrain = new PedBrainService();
