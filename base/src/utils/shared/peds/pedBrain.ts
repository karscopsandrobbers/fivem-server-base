/*
 * The ped brain: one activity per ped, whoever the ped is.
 *
 * A ped does one thing at a time. The server decides what and writes it on the ped's own `brain`
 * state bag; every client that can see the ped reads it, and the one with network control
 * performs it (client/core/peds/brain). A request below what the ped is already doing is refused.
 * When an activity ends the one beneath it resumes: the stack is the server's, and the clients
 * only ever see the top of it.
 *
 * The server's own peds are born with a brain. The game's ambient people get one when a system
 * takes them and lose it when they are released or stream out of everybody's range. What a client
 * does to ambient people it controls without asking the server (a reflex) uses the same
 * activities and the same priorities, and is never written to the bag.
 */
import type { PedTraits } from './pedTraits';

export const ACTIVITY = Object.freeze({
	/** The post: a scenario, a chair, a looping clip, or standing there. The bottom of every stack. */
	IDLE: 'idle',
	/** Hands over the head, staying put. */
	COWER: 'cower',
	/** Down on the knees with a gun on them. */
	KNEEL: 'kneel',
	/** Behind the nearest cover, away from the gun. */
	HIDE: 'hide',
	/** Somebody who has noticed a weapon: stopped, watching. */
	WARY: 'wary',
	/** Running from a place or a person. */
	FLEE: 'flee',
	/** On the phone to the police. */
	PHONE: 'phone',
	/** Hands up at gunpoint. */
	SURRENDER: 'surrender',
	/** Armed and going for somebody, or bare-handed and going for them anyway. */
	FIGHT: 'fight',
	/** Face down: gassed, knocked out. */
	DOWN: 'down',
	DEAD: 'dead',
});

export type ActivityKind = typeof ACTIVITY[keyof typeof ACTIVITY];

/** Higher outranks lower: a request below the ped's current activity is refused. Equal goes on top. */
export const PRIORITY: Readonly<Record<ActivityKind, number>> = Object.freeze({
	idle: 0,
	cower: 30,
	hide: 31,
	kneel: 32,
	wary: 35,
	flee: 40,
	phone: 50,
	surrender: 55,
	fight: 70,
	down: 90,
	dead: 100,
});

/** Who a ped answers to. Reports from the clients are routed to the system that owns the role. */
export const PED_ROLE = Object.freeze({
	/** Placed to be somewhere: a shopkeeper, a stand-in. */
	ACTOR: 'actor',
	/** Paid to be there: draws on whoever threatens what he watches. */
	GUARD: 'guard',
	/** One of the game's own people, taken for a while. */
	CIVILIAN: 'civilian',
	/** A client's own decision about a ped it controls. Never on the bag. */
	REFLEX: 'reflex',
});

export type PedRole = typeof PED_ROLE[keyof typeof PED_ROLE];

export interface PedPlace {
	x: number;
	y: number;
	z: number;
	heading: number;
}

/** The post. Everything here is applied by whoever controls the ped. */
export interface IdleParams {
	/** A stock scenario, e.g. WORLD_HUMAN_STAND_IMPATIENT. */
	scenario?: string;
	/** A scenario the ped is warped onto: a chair, a bench, a lean. */
	scenarioAt?: { name: string } & PedPlace;
	/** A looping clip instead of a scenario. */
	anim?: { dict: string; clip: string };
	/** A looping clip at a fixed place and facing: a ped at a desk. */
	animAt?: { dict: string; clip: string } & PedPlace;
	/** The facing, re-applied by the owning client: the spawn heading is not reliable. */
	heading?: number;
	/** Where the post is: where to walk back to after a fight or a knock-down. */
	home?: PedPlace;
}

/** How a ped fights, when it fights. An empty weapon is fists. */
export interface FightParams {
	weapon: string;
	group: string;
	/** 0 poor .. 2 professional. */
	ability?: number;
	accuracy?: number;
	/** Trigger speed. 100 is the default; lower is more deliberate. */
	shootRate?: number;
	/** A FIRING_PATTERN_* name from firingpatterns.meta. */
	firingPattern?: string;
	/** 0 stationary, 1 defensive, 2 will advance, 3 will retreat. */
	movement?: number;
	/** 0 near, 1 medium, 2 far. */
	range?: number;
	/** No shouted line as it starts. */
	silent?: boolean;
	/** Takes cover and fires blind from it. */
	cover?: boolean;
	/** Holds fire without a clear line to the target. */
	needsLineOfSight?: boolean;
	/** Never breaks off and runs. */
	neverFlee?: boolean;
	/** Hate every player, not only the one it was sent at. True unless said otherwise. */
	hatesPlayers?: boolean;
}

export interface FleeParams {
	distance: number;
	/** A way out to make for first, before running from the place. */
	door?: { x: number; y: number; z: number };
}

/** What a ped is doing, as every client sees it. Null on the bag once the ped is released. */
export interface BrainView {
	role: PedRole;
	kind: ActivityKind;
	/** Unix seconds it was asked for, and when it ends on its own. 0 for as long as it is asked. */
	since: number;
	until: number;
	/** A player server id the activity is about: who to fight, or watch. 0 for nobody. */
	target: number;
	/** A place the activity is about: what to run from. */
	at: { x: number; y: number; z: number } | null;
	params: Record<string, unknown>;
	/** Who this one is (pedTraits). Absent on a reflex, which is nobody in particular. */
	traits?: PedTraits;
}

/** What the client performing an activity says about it. */
export type PedReport = 'dialling' | 'stopped' | 'fighting' | 'dead' | 'gone' | 'done' | 'posted';

export const BRAIN = Object.freeze({
	/** How often the performing client looks at each ped it directs. */
	POLL_MS: 250,
	/** How often the server checks its ambient peds are still somewhere. */
	SWEEP_MS: 2000,
	/** The one look at everybody around the player, for every system that needs to pick a ped. */
	PERCEPTION_MS: 1000,
	PERCEPTION_RANGE: 150.0,
	/** A gun on a ped: how often it is checked, and from how far it counts. */
	AIM_POLL_MS: 100,
	AIM_RANGE: 20.0,
	/** A gun kept on the same ped this long is a demand, said once. */
	AIM_HOLD_MS: 1500,
	/** How close you have to be to hear a call and read the line, and to see the phone over a head. */
	HEAR_RANGE: 12.0,
	MARKER_RANGE: 45.0,
	/** How far somebody running from a place runs. */
	FLEE_DISTANCE: 150.0,
	/** After a knock-down, the get-up before anything is asked of them again. */
	RECOVERY_MS: 3000,

	/* Panic spreads: one person running is a thing that happened to them; a street emptying is a crowd. */
	CONTAGION: Object.freeze({
		RANGE: 14.0,
		CHANCE: 0.45,
		COOLDOWN_MS: 6000,
		SECONDS: 12,
		MAX_DEPTH: 2,
		MAX_PER_PASS: 6,
	}),

	/* Seeing it coming: a drawn weapon is noticed, and the people facing you stop and watch. */
	ANTICIPATION: Object.freeze({
		NOTICE_RANGE: 26.0,
		FIELD_OF_VIEW_DEGREES: 110.0,
		SECONDS: 6,
		COOLDOWN_MS: 9000,
	}),
});
