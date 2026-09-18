/*
 * A player's language: chosen with /language (commands/index.ts), remembered per licence in the
 * resource's own key-value store, so it survives a reconnect without a database.
 */
import type EntityPlayer from '../entities/PlayerEntity';
import { DEFAULT_LANGUAGE, isLanguageCodeValid } from './index';

const kvpKey = (player: EntityPlayer): string => `language:${player.license || player.name}`;

/** Put the remembered language on the player, or English. Called as they join. */
export const loadLanguage = (player: EntityPlayer): void => {
	const saved = GetResourceKvpString(kvpKey(player));

	player.language = saved && isLanguageCodeValid(saved) ? saved : DEFAULT_LANGUAGE;
};

export const setLanguage = (player: EntityPlayer, code: string): void => {
	player.language = code;
	SetResourceKvp(kvpKey(player), code);
};
