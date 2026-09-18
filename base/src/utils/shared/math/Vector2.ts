export interface Vector2Interface {
	x: number;
	y: number;
}

export class Vector2 implements Vector2Interface {
	public x: number;
	public y: number;

	constructor(x: number | Vector2Interface = 0.0, y = 0.0) {
		if(typeof x === 'object') {
			this.x = x.x;
			this.y = x.y;
		} else {
			this.x = x;
			this.y = y;
		}
	}

	distance(v: Vector2Interface): number {
		return Math.hypot(this.x - v.x, this.y - v.y);
	}

	get length(): number {
		return Math.hypot(this.x, this.y);
	}

	toJSON(): Vector2Interface {
		return { x: this.x, y: this.y };
	}

	toString(): string {
		return `${this.x}, ${this.y}`;
	}
}
