import { EVENTS } from '@shared/events';
import EntityPlayer, { ChatColour } from './PlayerEntity';
import EntityPool from './EntityPool';

class EntityPlayersPool extends EntityPool<EntityPlayer> {
	/** One broadcast to everyone; emitNet's -1 target sends a single packet. */
	call(eventName: string, ...args: any[]): void {
		emitNet(eventName, -1, ...args);
	}

	broadcast(text: string, colour: ChatColour = [255, 255, 255], prefix?: string): void {
		this.call(EVENTS.CHAT_MESSAGE, { color: colour, multiline: true, args: prefix ? [prefix, text] : [text] });
	}

	/** Every player standing in the world. */
	spawned(): EntityPlayer[] {
		return this.filter(player => player.isSpawned());
	}

	/** Rebuild the pool from the players FXServer already knows about, e.g. after a resource restart. */
	resync(): void {
		this.clear();
		for(const source of getPlayers()) {
			this.add(new EntityPlayer(Number(source)));
		}
	}
}

export default EntityPlayersPool;
