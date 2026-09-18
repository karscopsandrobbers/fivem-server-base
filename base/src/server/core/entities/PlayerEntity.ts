/*
 * One connected player. `id` is the server id (the `source` of their events).
 *
 * `data` is the player's state bag: anything written to it reaches every client. `info` is
 * server-only scratch that never leaves this process. Anything FiveM does not sync on its own
 * (animations, particles, attachments) goes out as a task every client runs on the ped.
 */
import { EVENTS } from '@shared/events';
import { clamp } from '@shared/index';
import { TASKS, TaskName, TaskRequest } from '@shared/tasks';
import { Vector3, Vector3Interface } from '@shared/math/Vector3';
import { getLanguageText } from '../i18n';
import Entity from './Entity';
import { createStateProxy } from './stateProxy';

export interface SpawnRequest extends Vector3Interface {
	heading: number;
	/** Model name or an already-resolved hash; the client accepts either. */
	model?: string | number;
}

/** A chat colour the stock chat resource draws the line's prefix in. */
export type ChatColour = [number, number, number];

const CHAT_WHITE: ChatColour = [255, 255, 255];
const CHAT_RED: ChatColour = [255, 56, 56];
const CHAT_YELLOW: ChatColour = [255, 200, 60];

class EntityPlayer extends Entity {
	/** Replicated to every client via this player's state bag. */
	readonly data: Record<string, any>;

	/** Server-only scratch space. */
	readonly info: Record<string, any> = {};

	constructor(source: number) {
		super(source);
		this.data = createStateProxy(Player(String(source)).state);
	}

	/** Most server natives want the source as a string. */
	private get src(): string {
		return String(this.id);
	}

	// ─── identity ────────────────────────────────────────────────────────────

	get name(): string {
		return GetPlayerName(this.src);
	}

	get ip(): string {
		const endpoint = (GetPlayerEndpoint(this.src) ?? '').replace('::ffff:', '');
		const colon = endpoint.lastIndexOf(':');

		return colon > 0 && /^\d+$/.test(endpoint.slice(colon + 1)) ? endpoint.slice(0, colon) : endpoint;
	}

	get ping(): number {
		return GetPlayerPing(this.src);
	}

	/** Full prefixed FiveM identifier ("license:…", "steam:…", "discord:…") or null. */
	getIdentifier(type: string): string | null {
		return GetPlayerIdentifierByType(this.src, type) ?? null;
	}

	/** The stable identity: the ROS licence. What to key saved data on. */
	get license(): string {
		return this.getIdentifier('license') ?? '';
	}

	/** `Name (id)`, for logs. */
	getUsername(): string {
		return `${this.name} (${this.id})`;
	}

	isAdmin(): boolean {
		return IsPlayerAceAllowed(this.src, 'base.admin');
	}

	// ─── session ─────────────────────────────────────────────────────────────

	/** Standing in the world: the spawn routine has run at least once this session. */
	isSpawned(): boolean {
		return this.data.spawned === true;
	}

	isInDebugMode(): boolean {
		return this.data.debugMode === true;
	}

	setDebugMode(state: boolean): void {
		this.data.debugMode = state;
	}

	// ─── ped ─────────────────────────────────────────────────────────────────

	get ped(): number {
		return GetPlayerPed(this.src);
	}

	/** Network id of this player's ped: the handle every other machine can resolve. */
	get netId(): number {
		return NetworkGetNetworkIdFromEntity(this.ped);
	}

	/** The model the server last told the client to wear; the client owns the real one. */
	get model(): number {
		return this.data.model ?? (GetHashKey('mp_m_freemode_01') >>> 0);
	}

	set model(model: number) {
		this.data.model = model;
	}

	get vehicle(): number | null {
		const vehicle = GetVehiclePedIsIn(this.ped, false);

		return vehicle > 0 ? vehicle : null;
	}

	/** -1 for the driver, 0.. for passengers, -2 on foot. */
	get seat(): number {
		const vehicle = this.vehicle;

		if(vehicle === null) {
			return -2;
		}
		for(let seat = -1; seat < 16; seat++) {
			if(GetPedInVehicleSeat(vehicle, seat) === this.ped) {
				return seat;
			}
		}
		return -2;
	}

	get health(): number {
		return GetEntityHealth(this.ped);
	}

	isAlive(): boolean {
		const ped = this.ped;

		return ped > 0 && GetEntityHealth(ped) > 0;
	}

	/** Replicated; every client applies it off the state bag. */
	get alpha(): number {
		return typeof this.data.alpha === 'number' ? this.data.alpha : 255;
	}

	set alpha(alpha: number) {
		this.data.alpha = clamp(Math.trunc(alpha), 0, 255);
	}

	// ─── position ────────────────────────────────────────────────────────────

	get position(): Vector3 {
		const [x, y, z] = GetEntityCoords(this.ped);

		return new Vector3(x, y, z);
	}

	set position(position: Vector3Interface) {
		SetEntityCoords(this.ped, position.x, position.y, position.z, false, false, false, false);
	}

	get heading(): number {
		return GetEntityHeading(this.ped);
	}

	set heading(heading: number) {
		SetEntityHeading(this.ped, heading);
	}

	/** Routing buckets are FiveM's dimensions: players in different buckets never see each other. */
	get dimension(): number {
		return GetPlayerRoutingBucket(this.src);
	}

	set dimension(bucket: number) {
		SetPlayerRoutingBucket(this.src, bucket);
		// The client cannot read its own bucket; anything it draws per dimension reads this.
		this.data.dimension = bucket;
	}

	/** Street and zone, as the client last reported them. */
	getLocation(): string {
		return this.data.location ?? 'Unknown';
	}

	// ─── movement ────────────────────────────────────────────────────────────

	/** Run the client's spawn routine at a position: fade, model, collision, resurrect. */
	spawn(position: Vector3Interface, heading = 0.0, model?: string | number): void {
		this.call(EVENTS.PLAYER_SPAWN, { x: position.x, y: position.y, z: position.z, heading, model } satisfies SpawnRequest);
	}

	/** Snap to a position. A dead ped cannot be moved, so it is respawned there instead. */
	teleport(position: Vector3Interface, heading: number | null = null, dimension: number | null = null, withVehicle = false): void {
		const vehicle = withVehicle ? this.vehicle : null;

		if(dimension !== null) {
			this.dimension = dimension;
			if(vehicle) {
				SetEntityRoutingBucket(vehicle, dimension);
			}
		}
		if(!this.isAlive()) {
			this.spawn(position, heading ?? 0.0, this.model);
			return;
		}

		const target = vehicle ?? this.ped;

		SetEntityCoords(target, position.x, position.y, position.z, false, false, false, false);
		if(heading !== null) {
			SetEntityHeading(target, heading);
		}
	}

	/** Walk this player to a coord instead of snapping them there. */
	goToCoords(position: Vector3Interface, heading: number | null = null, speed = 1.0, timeout = -1): void {
		this.playTask(TASKS.GO_STRAIGHT_TO_COORD, position.x, position.y, position.z, speed, timeout, heading ?? this.heading, 0.0);
	}

	/**
	 * Seat this player in a vehicle. SET_PED_INTO_VEHICLE no-ops server-side while the vehicle is
	 * outside the client's scope, so the owning client warps itself in once the net id resolves.
	 */
	putIntoVehicle(vehicle: number | { netId: number } | null, seat = -1): void {
		const netId = typeof vehicle === 'number' ? NetworkGetNetworkIdFromEntity(vehicle) : (vehicle?.netId ?? 0);

		if(netId) {
			this.playTask(TASKS.ENTER_VEHICLE, netId, -1, seat, 2.0, 16);
		}
	}

	// ─── tasks ───────────────────────────────────────────────────────────────

	/** Ask every client to run a client-only native on this player's ped, by net id. */
	playTask(name: TaskName, ...args: unknown[]): void {
		const netId = this.netId;

		if(!netId) {
			return;
		}
		const request: TaskRequest = { netId, name, args };

		emitNet(EVENTS.TASK_RUN, -1, request);
	}

	playAnimation(dict: string, anim: string, speed = 8.0, flags = 1, timeoutToClear = 0): void {
		this.playTask(TASKS.PLAY_ANIM, dict, anim, speed, -speed, -1, flags, 1.0, false, false, false);

		if(timeoutToClear > 0) {
			setTimeout(() => {
				this.stopAnimation(dict, anim);
				this.clearTasks();
			}, timeoutToClear);
		}
	}

	stopAnimation(dict?: string, anim?: string, exitSpeed = 3.0): void {
		if(dict === undefined || anim === undefined) {
			this.clearTasks();
			return;
		}
		this.playTask(TASKS.STOP_ANIM, dict, anim, exitSpeed);
	}

	playScenario(scenario: string, timeToLeave = 0, playIntro = true): void {
		this.playTask(TASKS.SCENARIO_IN_PLACE, scenario, timeToLeave, playIntro);
	}

	faceEntity(target: EntityPlayer, duration = 2000): void {
		this.playTask(TASKS.TURN_TO_FACE_ENTITY, target.netId, duration);
	}

	toggleHandsUp(duration = -1, facing: EntityPlayer | null = null): void {
		this.playTask(TASKS.HANDS_UP, duration, facing ? facing.netId : 0);
	}

	clearTasks(immediately = false): void {
		this.playTask(immediately ? TASKS.CLEAR_TASKS_IMMEDIATELY : TASKS.CLEAR_TASKS);
	}

	playParticleAtCoord(asset: string, effect: string, position: Vector3Interface, scale = 1.0): void {
		this.playTask(TASKS.PTFX_AT_COORD, asset, effect, position.x, position.y, position.z, scale);
	}

	playParticleOnSelf(asset: string, effect: string, scale = 1.0, offsetZ = 0.0): void {
		this.playTask(TASKS.PTFX_ON_ENTITY, asset, effect, scale, offsetZ);
	}

	attachTo(target: EntityPlayer, boneId: number, offset: Vector3Interface, rotation: Vector3Interface): void {
		this.playTask(TASKS.ATTACH_TO, target.netId, boneId, offset.x, offset.y, offset.z, rotation.x, rotation.y, rotation.z);
	}

	detach(): void {
		this.playTask(TASKS.DETACH);
	}

	/** Weapons belong to the owning client; the relay gives one. */
	giveWeapon(weapon: string, ammo = 250, equip = true): void {
		this.playTask(TASKS.GIVE_WEAPON, weapon, ammo, equip);
	}

	removeAllWeapons(): void {
		this.playTask(TASKS.REMOVE_ALL_WEAPONS);
	}

	setHealth(health: number): void {
		this.playTask(TASKS.SET_HEALTH, health);
	}

	setArmour(armour: number): void {
		this.playTask(TASKS.SET_ARMOUR, armour);
	}

	// ─── data ────────────────────────────────────────────────────────────────

	getVariable(key: string): any {
		return this.data[key];
	}

	setVariable(key: string, value: any): void {
		this.data[key] = value;
	}

	// ─── comms ───────────────────────────────────────────────────────────────

	/** Every server-to-client event goes through here. */
	call(eventName: string, ...args: any[]): void {
		emitNet(eventName, this.src, ...args);
	}

	/** A chat line, through the stock chat resource. `^1`..`^9` colour codes work inside it. */
	clientMessage(text: string, colour: ChatColour = CHAT_WHITE, prefix?: string): void {
		this.call(EVENTS.CHAT_MESSAGE, { color: colour, multiline: true, args: prefix ? [prefix, text] : [text] });
	}

	clientError(text: string): void {
		this.clientMessage(text, CHAT_RED, this.text('ERROR'));
	}

	clientWarning(text: string): void {
		this.clientMessage(text, CHAT_YELLOW, this.text('WARNING'));
	}

	/** GTA's own on-screen notification; `~r~` colour codes, not chat ones. */
	notify(text: string): void {
		this.call(EVENTS.NOTIFY, text);
	}

	/** The bottom-centre help text ("Press ~INPUT_CONTEXT~ to ..."). */
	displayHelp(text: string): void {
		this.call(EVENTS.DISPLAY_HELP, text);
	}

	/** The big freemode shard: a title and a line under it. */
	showShard(title: string, subtitle = '', durationMs = 5000): void {
		this.call(EVENTS.GUI_SHARD, title, subtitle, durationMs);
	}

	showMidsized(title: string, subtitle = '', durationMs = 5000): void {
		this.call(EVENTS.GUI_MIDSIZED, title, subtitle, durationMs);
	}

	/** A frontend audio cue on this player's own screen. */
	playSound(audioName: string, audioRef: string): void {
		this.call(EVENTS.SOUND_FRONTEND, audioName, audioRef);
	}

	kick(reason = 'Kicked'): void {
		DropPlayer(this.src, reason);
	}

	// ─── localisation ────────────────────────────────────────────────────────

	get language(): string {
		return this.data.languageCode ?? 'en';
	}

	set language(code: string) {
		this.data.languageCode = code;
	}

	/** Translate a key into this player's language, substituting `%%` placeholders in order. */
	text(key: string, ...args: unknown[]): string {
		return getLanguageText(this.language, key, ...args);
	}

	languageMessage(key: string, ...args: unknown[]): void {
		this.clientMessage(this.text(key, ...args));
	}

	languageError(key: string, ...args: unknown[]): void {
		this.clientError(this.text(key, ...args));
	}

	languageNotify(key: string, ...args: unknown[]): void {
		this.notify(this.text(key, ...args));
	}

	toJSON() {
		return { id: this.id, name: this.name };
	}
}

export default EntityPlayer;
