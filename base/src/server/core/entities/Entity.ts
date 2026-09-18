abstract class Entity {
	readonly #id: number;

	constructor(id: number) {
		this.#id = id;
	}

	get id(): number {
		return this.#id;
	}

	toJSON() {
		return { id: this.id };
	}
}

export default Entity;
