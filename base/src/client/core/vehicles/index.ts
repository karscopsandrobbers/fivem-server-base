/*
 * What the server says about a vehicle, applied here: the lock, the engine, the plate, the
 * colours and the mod table all ride the vehicle's state bag, because the natives that set
 * them are client-only. Every client applies them as the vehicle streams in, and again when a
 * key changes.
 */
import { debugging } from '../debug';
import { drawTextFromWorld } from '../../gui';
import { createGatedTick } from '../lifecycle';

interface ModRecord {
	type: string;
	value: string;
}

const NO_BAG_FILTER = null as unknown as string;

const parse = (value: string): unknown => {
	try {
		return JSON.parse(value);
	} catch{
		return value;
	}
};

const applyModRecord = (vehicle: number, record: ModRecord): void => {
	const numeric = Number(record.type);
	const value = parse(record.value);

	if(Number.isFinite(numeric) && String(numeric) === record.type) {
		switch(numeric) {
			case 18:
			case 20:
			case 22:
				ToggleVehicleMod(vehicle, numeric, Boolean(value));
				return;
			case 46:
				SetVehicleWindowTint(vehicle, Number(value) >= 0 ? Number(value) : 0);
				return;
			default:
				SetVehicleMod(vehicle, numeric, Number(value), false);
				return;
		}
	}
	switch(record.type) {
		case 'neonColour':
			if(Array.isArray(value)) {
				for(let index = 0; index < 4; index++) {
					SetVehicleNeonLightEnabled(vehicle, index, true);
				}
				SetVehicleNeonLightsColour(vehicle, Number(value[0]), Number(value[1]), Number(value[2]));
			}
			return;
		case 'livery':
			SetVehicleLivery(vehicle, Number(value));
			return;
		case 'wheelType':
			SetVehicleWheelType(vehicle, Number(value));
			return;
		case 'plateType':
			SetVehicleNumberPlateTextIndex(vehicle, Number(value));
			return;
	}
};

const applyState = (vehicle: number): void => {
	const state = Entity(vehicle).state;

	if(typeof state.numberPlate === 'string') {
		SetVehicleNumberPlateText(vehicle, state.numberPlate);
	}
	if(typeof state.locked === 'boolean') {
		SetVehicleDoorsLocked(vehicle, state.locked ? 2 : 1);
	}
	if(state.engine === false && GetIsVehicleEngineRunning(vehicle)) {
		SetVehicleEngineOn(vehicle, false, true, true);
	}
	if(typeof state.primaryColour === 'number' && typeof state.secondaryColour === 'number') {
		SetVehicleColours(vehicle, state.primaryColour, state.secondaryColour);
	}
	if(Array.isArray(state.primaryRGB)) {
		SetVehicleCustomPrimaryColour(vehicle, state.primaryRGB[0], state.primaryRGB[1], state.primaryRGB[2]);
	} else if(state.primaryRGB === null) {
		ClearVehicleCustomPrimaryColour(vehicle);
	}
	if(Array.isArray(state.secondaryRGB)) {
		SetVehicleCustomSecondaryColour(vehicle, state.secondaryRGB[0], state.secondaryRGB[1], state.secondaryRGB[2]);
	} else if(state.secondaryRGB === null) {
		ClearVehicleCustomSecondaryColour(vehicle);
	}
	if(state.extras && typeof state.extras === 'object') {
		for(const [extra, on] of Object.entries(state.extras as Record<string, boolean>)) {
			SetVehicleExtra(vehicle, Number(extra), !on);
		}
	}
	if(Array.isArray(state.mods)) {
		SetVehicleModKit(vehicle, 0);
		// Wheel type first: the wheel index is only valid inside its type.
		for(const record of state.mods as ModRecord[]) {
			if(record?.type === 'wheelType') {
				applyModRecord(vehicle, record);
			}
		}
		for(const record of state.mods as ModRecord[]) {
			if(record?.type !== undefined && record.type !== 'wheelType') {
				applyModRecord(vehicle, record);
			}
		}
	}
	// Client-local: says this machine has run the set. The server clears it on every change.
	state.set('modApplied', true, false);
};

// A change to any of the keys the server writes re-applies the whole set; the set is small.
for(const key of ['locked', 'engine', 'numberPlate', 'mods', 'primaryColour', 'primaryRGB', 'secondaryRGB', 'extras']) {
	AddStateBagChangeHandler(key, NO_BAG_FILTER, (bagName: string) => {
		const entity = GetEntityFromStateBagName(bagName);

		if(entity !== 0 && DoesEntityExist(entity) && IsEntityAVehicle(entity)) {
			applyState(entity);
		}
	});
}

// FiveM has no stream-in event, so a vehicle that arrives with its bag already written is caught here.
setInterval(() => {
	for(const vehicle of GetGamePool('CVehicle') as number[]) {
		if(!DoesEntityExist(vehicle)) {
			continue;
		}

		const state = Entity(vehicle).state;

		if(state.modApplied !== true && (Array.isArray(state.mods) || typeof state.locked === 'boolean' || typeof state.numberPlate === 'string')) {
			applyState(vehicle);
		}
	}
}, 1000);

// The engine flag: a vehicle told off stays off, even for a driver who presses W.
setTick(() => {
	const vehicle = GetVehiclePedIsIn(PlayerPedId(), false);

	if(vehicle && GetPedInVehicleSeat(vehicle, -1) === PlayerPedId() && Entity(vehicle).state.engine === false) {
		SetVehicleEngineOn(vehicle, false, true, true);
	}
});

createGatedTick(() => debugging('vehicles'), () => {
	const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);

	for(const vehicle of GetGamePool('CVehicle') as number[]) {
		const [x, y, z] = GetEntityCoords(vehicle, false);

		if(Vdist(px, py, pz, x, y, z) > 40.0) {
			continue;
		}

		const netId = NetworkGetEntityIsNetworked(vehicle) ? NetworkGetNetworkIdFromEntity(vehicle) : 0;
		const state = Entity(vehicle).state;

		drawTextFromWorld(`~c~#${vehicle} net ${netId}~s~ ${state.locked ? '~r~locked' : '~g~open'}~s~ ${state.engine === false ? '~r~engine off' : ''}`, [x, y, z + 1.2], 4, [255, 255, 255, 255], 0.28);
	}
});
