/*
 * Localisation: every `<code>.json` in the resource's i18n/ folder is a catalogue of key -> text.
 * `getLanguageText(code, key, ...args)` looks a key up in the player's language, falls back to
 * English, and finally to the key itself so a missing translation is visible rather than silent.
 * Placeholders are `%%`, filled in order.
 */
import fs from 'fs';
import path from 'path';

export interface LanguageEntry {
	code: string;
	name: string;
}

export const DEFAULT_LANGUAGE = 'en';

const catalogues = new Map<string, Record<string, string>>();
const languages: LanguageEntry[] = [];

// FXServer's Node has no __dirname and only lets a resource read its own folder.
const languageDir = (): string => path.join(GetResourcePath(GetCurrentResourceName()), 'i18n');

export const processLanguageCode = (code?: string | null): string => code || DEFAULT_LANGUAGE;

export const getLanguageList = (): LanguageEntry[] => languages;

export const isLanguageCodeValid = (code: string): boolean => languages.some(language => language.code === code);

export const getLanguageByName = (name: string): LanguageEntry | undefined => (
	languages.find(language => language.name.toLowerCase() === name.toLowerCase() || language.code.toLowerCase() === name.toLowerCase())
);

export const doesLanguageKeyExist = (code: string, key: string): boolean => Boolean(catalogues.get(processLanguageCode(code))?.[key]);

export const getText = (code: string, key: string): string => {
	const text = catalogues.get(processLanguageCode(code))?.[key];

	if(text) {
		return text;
	}

	const fallback = catalogues.get(DEFAULT_LANGUAGE)?.[key];

	if(!fallback) {
		globalThis.mp.logger.warn(`[i18n]: missing key '${key}' (${processLanguageCode(code)}).`);
		return key;
	}
	return fallback;
};

/** Substitute `%%` placeholders in order. */
export const fillTemplate = (text: string, args: unknown[]): string => (
	text.split('%%').reduce((out, chunk, index) => out + chunk + (index < args.length ? String(args[index] ?? '') : ''), '')
);

export const getLanguageText = (code: string, key: string, ...args: unknown[]): string => fillTemplate(getText(code, key), args);

/** Broadcast a language key to every player in their own language. */
export const messageToAll = (key: string, ...args: unknown[]): void => {
	globalThis.mp.players.forEach(player => player.languageMessage(key, ...args));
};

/** Read every catalogue. The LANGUAGE_NAME key inside each file is what /language lists. */
export const loadLanguages = (): void => {
	const dir = languageDir();
	let files: string[];

	try {
		files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
	} catch(error) {
		globalThis.mp.logger.error(`[i18n]: could not read ${dir}: ${error}`);
		return;
	}

	catalogues.clear();
	languages.length = 0;

	for(const file of files.sort()) {
		const code = file.replace('.json', '');

		try {
			const catalogue = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Record<string, string>;

			catalogues.set(code, catalogue);
			languages.push({ code, name: catalogue.LANGUAGE_NAME ?? code });
		} catch(error) {
			globalThis.mp.logger.error(`[i18n]: failed to parse ${file}: ${error}`);
		}
	}
	if(!catalogues.has(DEFAULT_LANGUAGE)) {
		globalThis.mp.logger.error(`[i18n]: no ${DEFAULT_LANGUAGE}.json: every key will come back as itself.`);
	}
	globalThis.mp.logger.info(`[i18n]: ${catalogues.size} catalogue(s) loaded: ${languages.map(language => language.code).join(', ')}.`);
};
