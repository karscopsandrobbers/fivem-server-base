/*
 * Where a player lands on joining and after dying: a random pick from these, all in Los Santos.
 * Add your own as Vector4s (x, y, z, heading).
 */
import { Vector4 } from '../math/Vector4';

export const SPAWNS: readonly Vector4[] = Object.freeze([
	// Legion Square.
	new Vector4(245.0126, -881.0927, 30.4921, 294.4731),
	// Strawberry.
	new Vector4(57.3265, -1333.7301, 29.3141, 220.0),
	// Rancho.
	new Vector4(385.4221, -1930.1084, 24.6163, 90.3429),
	// Mission Row.
	new Vector4(414.6993, -980.7730, 29.4473, 90.0),
	new Vector4(428.7130, -984.8737, 30.7110, 1.0),
	// Pillbox Hill.
	new Vector4(298.6216, -584.3184, 43.2606, 71.0),
	// Rockford Hills.
	new Vector4(-449.4126, -340.5162, 34.5013, 87.0),
	// Davis.
	new Vector4(1193.5388, -1473.1052, 34.8199, 0.0),
]);

/** The models a fresh player is given, one at random. */
export const SPAWN_MODELS: readonly string[] = Object.freeze(['mp_m_freemode_01', 'mp_f_freemode_01']);

/** Seconds a dead player lies there before being put back. */
export const RESPAWN_SECONDS = 5;
