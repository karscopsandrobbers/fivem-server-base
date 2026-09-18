/*
 * A position with a facing: a spawn, a drop-off, a door. Anything placed in the world is written
 * as one of these so a heading is never lost in a plain object.
 */
import { Vector3 } from './Vector3';

export interface Vector4Interface {
	x: number;
	y: number;
	z: number;
	heading: number;
}

export class Vector4 implements Vector4Interface {
	public x: number;
	public y: number;
	public z: number;
	public heading: number;

	constructor(x: number | Vector4Interface = 0.0, y = 0.0, z = 0.0, heading = 0.0) {
		if(typeof x === 'object') {
			this.x = x.x;
			this.y = x.y;
			this.z = x.z;
			this.heading = x.heading;
		} else {
			this.x = x;
			this.y = y;
			this.z = z;
			this.heading = heading;
		}
	}

	get position(): Vector3 {
		return new Vector3(this.x, this.y, this.z);
	}

	toJSON(): Vector4Interface {
		return { x: this.x, y: this.y, z: this.z, heading: this.heading };
	}

	toString(): string {
		return `${this.x}, ${this.y}, ${this.z}, ${this.heading}`;
	}
}
