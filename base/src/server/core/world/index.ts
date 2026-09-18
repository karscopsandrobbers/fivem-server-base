/*
 * `mp.world`: replicated world state, and the things the server places for every client to draw.
 *
 * FiveM's server has no blips, markers or labels of its own, so these are registries the clients
 * render (client/core/world). They replicate through GlobalState, which every client reads at any
 * distance, so a blip added at boot reaches a player who joins an hour later.
 */
import { Vector3Interface } from '@shared/math/Vector3';
import { createStateProxy } from '../entities/stateProxy';

export interface WorldBlip {
	id: number;
	name: string;
	sprite: number;
	position: Vector3Interface;
	scale: number;
	colour: number;
	shortRange: boolean;
	dimension: number;
}

export interface WorldMarker {
	id: number;
	/** DrawMarker's type: 1 is the flat cylinder, 2 the arrow, 28 the sphere. */
	type: number;
	position: Vector3Interface;
	scale: number;
	rotation: number;
	colour: [number, number, number, number];
	bobUpAndDown: boolean;
	dimension: number;
}

export interface WorldLabel {
	id: number;
	text: string;
	position: Vector3Interface;
	colour: [number, number, number, number];
	drawDistance: number;
	dimension: number;
	font: number;
}

export interface BlipOptions {
	scale?: number;
	colour?: number;
	shortRange?: boolean;
	dimension?: number;
}

export interface MarkerOptions {
	scale?: number;
	rotation?: number;
	colour?: [number, number, number, number];
	bobUpAndDown?: boolean;
	dimension?: number;
}

export interface LabelOptions {
	colour?: [number, number, number, number];
	drawDistance?: number;
	dimension?: number;
	font?: number;
}

const flat = (position: Vector3Interface): Vector3Interface => ({ x: position.x, y: position.y, z: position.z });

/** One list replicated as one GlobalState key; bags are shallow, so the whole array is reassigned per change. */
class Registry<T extends { id: number }> {
	private readonly items: T[] = [];
	private nextId = 1;

	constructor(private readonly key: string) {}

	protected add(build: (id: number) => T): T {
		const item = build(this.nextId++);

		this.items.push(item);
		this.publish();
		return item;
	}

	remove(id: number): boolean {
		const index = this.items.findIndex(item => item.id === id);

		if(index === -1) {
			return false;
		}
		this.items.splice(index, 1);
		this.publish();
		return true;
	}

	toArray(): T[] {
		return [...this.items];
	}

	clear(): void {
		this.items.length = 0;
		this.publish();
	}

	private publish(): void {
		GlobalState.set(this.key, this.items, true);
	}
}

class BlipRegistry extends Registry<WorldBlip> {
	new(name: string, sprite: number, position: Vector3Interface, options: BlipOptions = {}): WorldBlip {
		return this.add(id => ({
			id,
			name,
			sprite,
			position: flat(position),
			scale: options.scale ?? 0.8,
			colour: options.colour ?? 0,
			shortRange: options.shortRange ?? true,
			dimension: options.dimension ?? 0,
		}));
	}
}

class MarkerRegistry extends Registry<WorldMarker> {
	new(type: number, position: Vector3Interface, options: MarkerOptions = {}): WorldMarker {
		return this.add(id => ({
			id,
			type,
			position: flat(position),
			scale: options.scale ?? 1.0,
			rotation: options.rotation ?? 0.0,
			colour: options.colour ?? [255, 255, 255, 120],
			bobUpAndDown: options.bobUpAndDown ?? false,
			dimension: options.dimension ?? 0,
		}));
	}
}

class LabelRegistry extends Registry<WorldLabel> {
	new(text: string, position: Vector3Interface, options: LabelOptions = {}): WorldLabel {
		return this.add(id => ({
			id,
			text,
			position: flat(position),
			colour: options.colour ?? [255, 255, 255, 255],
			drawDistance: options.drawDistance ?? 25.0,
			dimension: options.dimension ?? 0,
			font: options.font ?? 4,
		}));
	}
}

export const world = {
	/** Replicated world state: `mp.world.data.weather = 'RAIN'` reaches every client as GlobalState.weather. */
	data: createStateProxy(GlobalState),
	blips: new BlipRegistry('worldBlips'),
	markers: new MarkerRegistry('worldMarkers'),
	labels: new LabelRegistry('worldLabels'),
};

export type WorldRegistry = typeof world;

// A resource restart starts from nothing; the previous run's lists would otherwise linger in GlobalState.
on('onResourceStart', (resource: string) => {
	if(GetCurrentResourceName() === resource) {
		world.blips.clear();
		world.markers.clear();
		world.labels.clear();
	}
});
