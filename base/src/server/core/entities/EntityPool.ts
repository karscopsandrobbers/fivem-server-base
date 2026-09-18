import Entity from './Entity';

// FiveM's `source` global is a STRING ("1") while the pool keys by number, so every lookup
// normalises the id first.
const idOf = (entity: Entity | number | string): number => {
	if(typeof entity === 'string') {
		return Number(entity);
	}
	return typeof entity === 'number' ? entity : entity?.id;
};

/** Keyed by entity id: lookups and removal are O(1), and `remove` takes an id or an instance. */
abstract class EntityPool<TEntity extends Entity> {
	protected readonly entities = new Map<number, TEntity>();

	add(entity: TEntity): TEntity {
		this.entities.set(entity.id, entity);
		return entity;
	}

	at(entity: TEntity | number | string): TEntity | null {
		return this.entities.get(idOf(entity)) ?? null;
	}

	exists(entity: TEntity | number | string): boolean {
		return this.entities.has(idOf(entity));
	}

	remove(entity: TEntity | number | string): boolean {
		return this.entities.delete(idOf(entity));
	}

	clear(): void {
		this.entities.clear();
	}

	forEach(fn: (entity: TEntity) => void): void {
		this.entities.forEach(fn);
	}

	map<TResult>(fn: (entity: TEntity) => TResult): TResult[] {
		return this.toArray().map(fn);
	}

	filter(fn: (entity: TEntity) => boolean): TEntity[] {
		return this.toArray().filter(fn);
	}

	find(fn: (entity: TEntity) => boolean): TEntity | undefined {
		return this.toArray().find(fn);
	}

	toArray(): TEntity[] {
		return [...this.entities.values()];
	}

	get length(): number {
		return this.entities.size;
	}

	[Symbol.iterator](): IterableIterator<TEntity> {
		return this.entities.values();
	}
}

export default EntityPool;
