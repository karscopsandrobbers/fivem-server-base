/*
 * Chat commands. `command` registers one for everybody, `adminCommand` for holders of the
 * `base.admin` ace (permissions.cfg). Both send a suggestion to the stock chat resource so the
 * command autocompletes.
 */
import { xyInFrontOfPos } from '@shared/index';
import { Vector3 } from '@shared/math/Vector3';
import type EntityPlayer from '../entities/PlayerEntity';
import { createVehicle, ServerVehicleType, vehiclesPool } from '../vehicles';
import { pedBrain } from '../peds/brain';
import { getLanguageByName, getLanguageList } from '../i18n';
import { setLanguage } from '../i18n/events';

type Handler = (player: EntityPlayer, args: string[], raw: string) => void | Promise<void>;

interface Suggestion {
	name: string;
	help: string;
	params?: Array<{ name: string; help: string }>;
}

const suggestions: Suggestion[] = [];

const register = (name: string, help: string, params: Suggestion['params'], admin: boolean, handler: Handler): void => {
	suggestions.push({ name: `/${name}`, help, params });
	RegisterCommand(name, (source: number, args: string[], raw: string) => {
		const player = globalThis.mp.players.at(source);

		if(!player) {
			return;
		}
		if(admin && !player.isAdmin()) {
			player.languageError('NO_PERMISSION');
			return;
		}
		void Promise.resolve(handler(player, args, raw)).catch((error: unknown) => {
			globalThis.mp.logger.error(`[commands; /${name}; ${player.getUsername()}]: ${String(error)}`);
		});
	}, false);
};

export const command = (name: string, help: string, params: Suggestion['params'], handler: Handler): void => register(name, help, params, false, handler);

export const adminCommand = (name: string, help: string, params: Suggestion['params'], handler: Handler): void => register(name, help, params, true, handler);

/** The chat resource is told about every command as a player joins, so they autocomplete. */
export const syncCommands = (player: EntityPlayer): void => {
	for(const suggestion of suggestions) {
		player.call('chat:addSuggestion', suggestion.name, suggestion.help, suggestion.params ?? []);
	}
};

const VEHICLE_TYPES: readonly ServerVehicleType[] = ['automobile', 'bike', 'boat', 'heli', 'plane', 'submarine', 'trailer', 'train'];

// ─── everybody ───────────────────────────────────────────────────────────────

command('pos', 'Where you are standing', [], player => {
	const at = player.position;

	player.languageMessage('POSITION', at.x.toFixed(3), at.y.toFixed(3), at.z.toFixed(3), player.heading.toFixed(1));
});

command('language', 'Change your language', [{ name: 'language', help: 'A name or code from the list' }], (player, args) => {
	const wanted = args[0] ? getLanguageByName(args[0]) : undefined;

	if(!wanted) {
		player.languageError('LANGUAGE_UNKNOWN', args[0] ?? '', getLanguageList().map(language => `${language.name} (${language.code})`).join(', '));
		return;
	}
	setLanguage(player, wanted.code);
	player.languageMessage('LANGUAGE_CHANGED', wanted.name);
});

// ─── admin ───────────────────────────────────────────────────────────────────

adminCommand('car', 'Spawn a vehicle in front of you', [
	{ name: 'model', help: 'e.g. adder, sanchez, dinghy' },
	{ name: 'type', help: 'automobile (default), bike, boat, heli, plane, submarine, trailer, train' },
], async (player, args) => {
	const model = args[0];
	const type = (args[1] ?? 'automobile').toLowerCase() as ServerVehicleType;

	if(!model || !VEHICLE_TYPES.includes(type)) {
		player.clientError('/car <model> [type]');
		return;
	}

	const inFront = xyInFrontOfPos(player.position, player.heading, player.vehicle ? 0.0 : 3.0);
	const vehicle = await createVehicle(model, inFront, player.heading, { type, dimension: player.dimension, numberPlate: 'BASE' });

	if(!vehicle) {
		player.languageError('VEHICLE_INVALID', model);
		return;
	}
	vehicle.setOwner(player);
	player.putIntoVehicle(vehicle, -1);
	player.languageNotify('VEHICLE_SPAWNED', model);
});

adminCommand('dv', 'Delete the vehicle you are in or standing by', [], player => {
	const vehicle = player.vehicle ? vehiclesPool.at(player.vehicle) : vehiclesPool.nearest(player.position, 6.0);

	if(!vehicle) {
		player.languageError('VEHICLE_NONE_NEAR');
		return;
	}
	vehiclesPool.destroy(vehicle);
	player.languageNotify('VEHICLE_DELETED');
});

adminCommand('ped', 'Spawn a ped in front of you', [
	{ name: 'model', help: 'e.g. a_m_y_hipster_01' },
	{ name: 'scenario', help: 'optional, e.g. WORLD_HUMAN_SMOKING' },
], (player, args) => {
	const model = args[0];

	if(!model) {
		player.clientError('/ped <model> [scenario]');
		return;
	}

	const at = xyInFrontOfPos(player.position, player.heading, 2.5);
	const ped = globalThis.mp.peds.newActor(model, new Vector3(at.x, at.y, at.z), {
		heading: (player.heading + 180) % 360,
		scenario: args[1],
		invincible: false,
		dimension: player.dimension,
	});

	if(!ped) {
		player.languageError('PED_INVALID', model);
		return;
	}
	player.languageNotify('PED_SPAWNED', model);
});

adminCommand('dp', 'Delete every ped the server placed', [], player => {
	player.notify(`~y~Removed ${globalThis.mp.peds.destroyAll()} ped(s).`);
});

adminCommand('tp', 'Teleport to coordinates', [
	{ name: 'x', help: '' }, { name: 'y', help: '' }, { name: 'z', help: '' },
], (player, args) => {
	const [x, y, z] = args.map(Number);

	if([x, y, z].some(value => !Number.isFinite(value))) {
		player.clientError('/tp <x> <y> <z>');
		return;
	}
	player.teleport(new Vector3(x, y, z), null, null, true);
	player.languageNotify('TELEPORTED', x, y, z);
});

adminCommand('weapon', 'Give yourself a weapon', [{ name: 'name', help: 'e.g. weapon_pistol' }], (player, args) => {
	if(!args[0]) {
		player.clientError('/weapon <name>');
		return;
	}
	player.giveWeapon(args[0].toUpperCase(), 250, true);
});

adminCommand('heal', 'Full health and armour', [], player => {
	player.setHealth(200);
	player.setArmour(100);
});

adminCommand('debug', 'Toggle debug mode: ped brains and prompts draw what they know', [], player => {
	player.setDebugMode(!player.isInDebugMode());
	player.languageNotify(player.isInDebugMode() ? 'DEBUG_ON' : 'DEBUG_OFF');
});

adminCommand('brains', 'List every ped with a brain in the console', [], player => {
	const lines = pedBrain.describe();

	player.clientMessage(`${lines.length} ped(s) with a brain; see the server console.`);
	for(const line of lines) {
		globalThis.mp.logger.info(`[brains]: ${line}`);
	}
});

adminCommand('marker', 'Drop a world marker and a label where you stand', [], player => {
	const at = player.position;
	const marker = globalThis.mp.world.markers.new(1, new Vector3(at.x, at.y, at.z - 1.0), { scale: 1.5, colour: [255, 200, 60, 120] });

	globalThis.mp.world.labels.new(`Marker #${marker.id}`, new Vector3(at.x, at.y, at.z), { drawDistance: 20.0 });
	player.notify(`~y~Marker #${marker.id} placed.`);
});

adminCommand('blip', 'Drop a map blip where you stand', [{ name: 'name', help: 'what the map calls it' }], (player, args) => {
	const blip = globalThis.mp.world.blips.new(args.join(' ') || 'Blip', 1, player.position, { colour: 5, shortRange: false });

	player.notify(`~y~Blip #${blip.id} placed.`);
});

adminCommand('shard', 'Show yourself the big freemode message', [{ name: 'text', help: '' }], (player, args) => {
	player.showShard(args.join(' ') || 'Shard', 'The big freemode message', 4000);
});

adminCommand('midsized', 'Show yourself the midsized message', [{ name: 'text', help: '' }], (player, args) => {
	player.showMidsized(args.join(' ') || 'Midsized', 'The midsized message', 4000);
});

adminCommand('help', 'Show yourself a help text', [{ name: 'text', help: '' }], (player, args) => {
	player.displayHelp(args.join(' ') || 'Press ~INPUT_CONTEXT~ to interact.');
});

// Everything above is a suggestion in the stock chat the moment a player joins.
on('playerJoining', () => {
	const player = globalThis.mp.players.at(source);

	if(player) {
		syncCommands(player);
	}
});

// Console only: `basewho` lists everybody's identifiers, for permissions.cfg.
RegisterCommand('basewho', (source: number) => {
	if(source !== 0) {
		return;
	}
	for(const player of globalThis.mp.players) {
		globalThis.mp.logger.info(`${player.getUsername()}: license ${player.license || '-'}, discord ${player.getIdentifier('discord') ?? '-'}`);
	}
}, true);
