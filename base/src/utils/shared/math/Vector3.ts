export interface Vector3Interface {
	x: number;
	y: number;
	z: number;
}

export class Vector3 implements Vector3Interface {
	public static create(vector: number | Vector3Interface): Vector3 {
		if(typeof vector === 'number') {
			return new Vector3(vector, vector, vector);
		}
		return new Vector3(vector.x, vector.y, vector.z);
	}

	public static clone(vector: Vector3Interface): Vector3 {
		return Vector3.create(vector);
	}

	public static add(v1: Vector3Interface, v2: number | Vector3Interface): Vector3 {
		if(typeof v2 === 'number') {
			return new Vector3(v1.x + v2, v1.y + v2, v1.z + v2);
		}
		return new Vector3(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
	}

	public static subtract(v1: Vector3Interface, v2: Vector3Interface): Vector3 {
		return new Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
	}

	public static multiply(v1: Vector3Interface, v2: Vector3Interface | number): Vector3 {
		if(typeof v2 === 'number') {
			return new Vector3(v1.x * v2, v1.y * v2, v1.z * v2);
		}
		return new Vector3(v1.x * v2.x, v1.y * v2.y, v1.z * v2.z);
	}

	public static divide(v1: Vector3Interface, v2: Vector3Interface | number): Vector3 {
		if(typeof v2 === 'number') {
			return new Vector3(v1.x / v2, v1.y / v2, v1.z / v2);
		}
		return new Vector3(v1.x / v2.x, v1.y / v2.y, v1.z / v2.z);
	}

	public static dotProduct(v1: Vector3Interface, v2: Vector3Interface): number {
		return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
	}

	public static crossProduct(v1: Vector3Interface, v2: Vector3Interface): Vector3 {
		return new Vector3(
			v1.y * v2.z - v1.z * v2.y,
			v1.z * v2.x - v1.x * v2.z,
			v1.x * v2.y - v1.y * v2.x,
		);
	}

	public static normalize(vector: Vector3): Vector3 {
		return Vector3.divide(vector, vector.length);
	}

	constructor(public x: number, public y: number, public z: number) {}

	public clone(): Vector3 {
		return new Vector3(this.x, this.y, this.z);
	}

	public distanceSquared(v: Vector3Interface): number {
		const w = this.subtract(v);

		return Vector3.dotProduct(w, w);
	}

	public distance(v: Vector3Interface): number {
		return Math.sqrt(this.distanceSquared(v));
	}

	public get normalize(): Vector3 {
		return Vector3.normalize(this);
	}

	public crossProduct(v: Vector3Interface): Vector3 {
		return Vector3.crossProduct(this, v);
	}

	public dotProduct(v: Vector3Interface): number {
		return Vector3.dotProduct(this, v);
	}

	public add(v: number | Vector3Interface): Vector3 {
		return Vector3.add(this, v);
	}

	public subtract(v: Vector3Interface): Vector3 {
		return Vector3.subtract(this, v);
	}

	public multiply(v: number | Vector3Interface): Vector3 {
		return Vector3.multiply(this, v);
	}

	public divide(v: number | Vector3Interface): Vector3 {
		return Vector3.divide(this, v);
	}

	public replace(v: Vector3Interface): void {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
	}

	public get length(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	/** The wire shape: a state bag or an event carries plain objects, never class instances. */
	public toJSON(): Vector3Interface {
		return { x: this.x, y: this.y, z: this.z };
	}
}
