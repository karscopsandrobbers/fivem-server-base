/*
 * The local player, and other players as this client sees them. Everything replicated lives on a
 * state bag; the local player's own keys are kept in a Map fed by the change handler, because a
 * bag read is a native call and a decode, and the predicates below are asked every frame.
 */
export const Delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** A networked player, resolved from the server id the server uses for them. */
export class ClientPlayer {
	constructor(public readonly serverId: number) {}

	get handle(): number {
		return GetPlayerFromServerId(this.serverId);
	}

	get ped(): number {
		return GetPlayerPed(this.handle);
	}

	get exists(): boolean {
		return this.handle !== -1;
	}

	get name(): string {
		return GetPlayerName(this.handle);
	}

	get position(): number[] {
		return GetEntityCoords(this.ped, true);
	}

	get vehicle(): number {
		return GetVehiclePedIsIn(this.ped, false);
	}

	/** Mirror of the server's `player.data`: same keys, replicated by the engine. */
	get data(): Record<string, any> {
		return Player(this.serverId).state;
	}

	getVariable(key: string): any {
		return this.data[key];
	}
}

const own = new Map<string, unknown>();

const ownBag = (): string => `player:${GetPlayerServerId(PlayerId())}`;

// Every key of every bag, narrowed to our own at fire time: the server id is not known at load.
AddStateBagChangeHandler(null as unknown as string, null as unknown as string, (bagName: string, key: string, value: unknown) => {
	if(bagName === ownBag()) {
		own.set(key, value);
	}
});

const ownState = (key: string): any => {
	if(!own.has(key)) {
		own.set(key, LocalPlayer.state[key]);
	}
	return own.get(key);
};

export const localPlayer = {
	get id(): number {
		return PlayerId();
	},

	get serverId(): number {
		return GetPlayerServerId(PlayerId());
	},

	get ped(): number {
		return PlayerPedId();
	},

	get data(): Record<string, any> {
		return LocalPlayer.state;
	},

	getVariable(key: string): any {
		return ownState(key);
	},

	/** Standing in the world: the server has run the spawn routine at least once. */
	isSpawned(): boolean {
		return ownState('spawned') === true;
	},

	isInDebugMode(): boolean {
		return ownState('debugMode') === true;
	},

	/** The routing bucket, as the server last set it. */
	get dimension(): number {
		return ownState('dimension') ?? 0;
	},

	get vehicle(): number {
		return GetVehiclePedIsIn(PlayerPedId(), false);
	},

	isDrivingAnyVehicle(): boolean {
		const vehicle = GetVehiclePedIsIn(PlayerPedId(), false);

		return vehicle > 0 && GetPedInVehicleSeat(vehicle, -1) === PlayerPedId();
	},

	get weapon(): number {
		return GetSelectedPedWeapon(PlayerPedId()) >>> 0;
	},

	/** What the player is free-aiming at, or 0. */
	getEntityIsFreeAimingAt(): number {
		const [aiming, entity] = GetEntityPlayerIsFreeAimingAt(PlayerId());

		return aiming ? entity : 0;
	},

	playSoundFrontEnd(audioName: string, audioRef: string): void {
		PlaySoundFrontend(-1, audioName, audioRef, true);
	},

	/** A line into the server log, tagged with this player. */
	serverLog(message: string): void {
		emitNet('base:client:log', message);
	},
};

export const playerAt = (serverId: number): ClientPlayer => new ClientPlayer(serverId);

/** Watch a replicated player key. Fires for every player whose bag changes, the local one included. */
export const addDataHandler = (key: string, handler: (player: ClientPlayer, value: any) => void): void => {
	AddStateBagChangeHandler(key, null as unknown as string, (bagName: string, _key: string, value: any) => {
		const handle = GetPlayerFromStateBagName(bagName);

		if(handle !== 0) {
			handler(new ClientPlayer(GetPlayerServerId(handle)), value);
		}
	});
};

/** Every networked player except the local one. */
export const forEachInStreamRange = (handler: (player: ClientPlayer) => void): void => {
	for(const handle of GetActivePlayers()) {
		if(handle !== PlayerId()) {
			handler(new ClientPlayer(GetPlayerServerId(handle)));
		}
	}
};
