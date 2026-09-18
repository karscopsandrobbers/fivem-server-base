/*
 * One server-owned vehicle. `id` is the entity handle; `handle` is the same number.
 *
 * The server can write a handful of vehicle natives (coords, plate, locks, colours) and none of
 * the mod ones, so the mods, the engine state and the custom colours ride the state bag and
 * every client applies them (client/core/vehicles). `modCache` remembers what we told them, so a
 * read never depends on the owning client echoing our own instruction back.
 */
import { EVENTS } from '@shared/events';
import { clamp } from '@shared/index';
import { TaskName, TaskRequest } from '@shared/tasks';
import { Vector3, Vector3Interface } from '@shared/math/Vector3';
import BaseEntity from './Entity';
import { createStateProxy } from './stateProxy';
import type EntityPlayer from './PlayerEntity';

export interface VehicleModRecord {
	type: string;
	value: string;
}

class EntityVehicle extends BaseEntity {
	/** The vehicle's state bag behind plain-object ergonomics. */
	readonly data: Record<string, any>;

	private readonly modCache = new Map<string | number, unknown>();

	constructor(handle: number) {
		super(handle);
		this.data = createStateProxy(Entity(handle).state);
		this.data.locked = this.locked;
		this.data.engine = true;
	}

	get handle(): number {
		return this.id;
	}

	get exists(): boolean {
		return this.id !== 0 && DoesEntityExist(this.id);
	}

	get netId(): number {
		return this.exists ? NetworkGetNetworkIdFromEntity(this.id) : 0;
	}

	get model(): number {
		return GetEntityModel(this.id) >>> 0;
	}

	get position(): Vector3 {
		const [x, y, z] = GetEntityCoords(this.id);

		return new Vector3(x, y, z);
	}

	set position(position: Vector3Interface) {
		SetEntityCoords(this.id, position.x, position.y, position.z, false, false, false, false);
	}

	get heading(): number {
		return GetEntityHeading(this.id);
	}

	set heading(heading: number) {
		SetEntityHeading(this.id, heading);
	}

	get rotation(): Vector3 {
		const [x, y] = GetEntityRotation(this.id);

		return new Vector3(x, y, GetEntityHeading(this.id));
	}

	get dimension(): number {
		return GetEntityRoutingBucket(this.id);
	}

	set dimension(bucket: number) {
		SetEntityRoutingBucket(this.id, bucket);
	}

	get numberPlate(): string {
		return GetVehicleNumberPlateText(this.id);
	}

	/** Written to the bag as well: SET_VEHICLE_NUMBER_PLATE_TEXT is client-local, and the clients re-assert it. */
	set numberPlate(plate: string) {
		SetVehicleNumberPlateText(this.id, plate);
		this.data.numberPlate = plate;
	}

	get locked(): boolean {
		return GetVehicleDoorLockStatus(this.id) === 2;
	}

	/** Both halves: the native for the sync node, the bag for the clients that check the keys. */
	set locked(state: boolean) {
		SetVehicleDoorsLocked(this.id, state ? 2 : 1);
		this.data.locked = state;
	}

	get engine(): boolean {
		return this.data.engine !== false;
	}

	set engine(state: boolean) {
		this.data.engine = state;
	}

	get bodyHealth(): number {
		return GetVehicleBodyHealth(this.id);
	}

	get dirtLevel(): number {
		return this.data.dirtLevel ?? 0;
	}

	set dirtLevel(dirt: number) {
		this.data.dirtLevel = clamp(dirt, 0, 15);
		SetVehicleDirtLevel(this.id, this.data.dirtLevel);
	}

	// ─── owner ───────────────────────────────────────────────────────────────

	/** The owner is a live player, which cannot ride a bag: the id replicates, the instance is looked up. */
	setOwner(player: EntityPlayer | null): void {
		this.data.owner = player ? player.id : null;
		this.data.ownerName = player ? player.name : null;
	}

	getOwner(): EntityPlayer | null {
		return typeof this.data.owner === 'number' ? globalThis.mp.players.at(this.data.owner) : null;
	}

	getOccupants(): EntityPlayer[] {
		return globalThis.mp.players.filter(player => player.vehicle === this.id);
	}

	// ─── appearance ──────────────────────────────────────────────────────────

	/** The paint indices, written where every client applies them; the owner's sync would undo a native alone. */
	setColor(primary: number, secondary: number): void {
		SetVehicleColours(this.id, primary, secondary);
		this.data.primaryColour = primary;
		this.data.secondaryColour = secondary;
		this.rememberMod('primaryColour', primary);
		this.rememberMod('secondaryColour', secondary);
	}

	getColor(index: number): number {
		return GetVehicleColours(this.id)[index === 0 ? 0 : 1];
	}

	setColorRGB(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): void {
		SetVehicleCustomPrimaryColour(this.id, r1, g1, b1);
		SetVehicleCustomSecondaryColour(this.id, r2, g2, b2);
		this.data.primaryRGB = [r1, g1, b1];
		this.data.secondaryRGB = [r2, g2, b2];
	}

	/** Back to the paint index: a custom colour paints over it, and only the clients can clear one. */
	clearColorRGB(): void {
		this.data.primaryRGB = null;
		this.data.secondaryRGB = null;
	}

	setNeonColor(r: number, g: number, b: number): void {
		this.queueMod('neonColour', JSON.stringify([r, g, b]));
	}

	/** SetVehicleExtra is client-only; the extras map replicates and the clients apply it. */
	setExtra(extraId: number, toggle: boolean): void {
		const extras: Record<string, boolean> = { ...(this.data.extras ?? {}) };

		if(extras[extraId] !== toggle) {
			extras[extraId] = toggle;
			this.data.extras = extras;
		}
	}

	/** A numeric mod slot (0..48) to an index; -1 is stock. */
	setMod(modType: number, value: number): void {
		this.rememberMod(modType, value);
		this.queueMod(String(modType), value);
	}

	getMod(modType: number): number {
		return (this.modCache.get(modType) as number | undefined) ?? -1;
	}

	/** A toggle mod: 18 turbo, 20 tyre smoke, 22 xenon. */
	toggleMod(modType: number, on: boolean): void {
		this.rememberMod(modType, on);
		this.queueMod(String(modType), on ? 1 : 0);
	}

	setWindowTint(tint: number): void {
		this.setMod(46, tint);
	}

	setLivery(livery: number): void {
		this.rememberMod('livery', livery);
		this.queueMod('livery', livery);
	}

	setWheelType(type: number): void {
		this.rememberMod('wheelType', type);
		this.queueMod('wheelType', type);
	}

	setPlateType(type: number): void {
		this.rememberMod('plateType', type);
		this.queueMod('plateType', type);
	}

	/** Record what a mod was set to, without applying it. */
	rememberMod(modType: string | number, value: unknown): void {
		this.modCache.set(modType, value);
	}

	recalledMod(modType: string | number): unknown {
		return this.modCache.get(modType);
	}

	/**
	 * Every mod the server has asked for, as one `mods` bag key the clients re-apply in full.
	 * Rebuilt and assigned whole: state bags are shallow.
	 */
	private queueMod(type: string, value: unknown): void {
		const mods: VehicleModRecord[] = Array.isArray(this.data.mods) ? [...this.data.mods] : [];
		const record: VehicleModRecord = { type, value: typeof value === 'string' ? value : JSON.stringify(value) };
		const index = mods.findIndex(mod => mod.type === type);

		if(index === -1) {
			mods.push(record);
		} else {
			mods[index] = record;
		}
		this.data.mods = mods;
		// The re-apply signal: each client sets it back true locally after running the set.
		this.data.modApplied = false;
	}

	// ─── data ────────────────────────────────────────────────────────────────

	setVariable(key: string, value: unknown): void {
		this.data[key] = value;
	}

	getVariable(key: string): any {
		return this.data[key];
	}

	/** Ask every client to run a client-only native on this vehicle: a repair, a flip. */
	playTask(name: TaskName, ...args: unknown[]): void {
		const netId = this.netId;

		if(!netId) {
			return;
		}
		const request: TaskRequest = { netId, name, args };

		emitNet(EVENTS.TASK_RUN, -1, request);
	}

	/** Hand the handle back to the engine. Removing it from the pool is the pool's job. */
	destroy(): void {
		if(this.exists) {
			DeleteEntity(this.id);
		}
	}

	toJSON() {
		return { id: this.id, handle: this.handle, exists: this.exists };
	}
}

export default EntityVehicle;
