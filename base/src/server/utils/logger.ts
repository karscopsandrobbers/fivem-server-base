/*
 * The server log: the console, with a level and a colour per line. Kept dependency-free so the
 * bundle stays small; swap in winston or pino here if you want files and rotation.
 */
const COLOUR = { reset: '^7', error: '^1', warn: '^3', info: '^2', debug: '^5', verbose: '^6' } as const;

type Level = keyof typeof COLOUR;

const write = (level: Exclude<Level, 'reset'>, message: unknown, ...rest: unknown[]): void => {
	const text = message instanceof Error ? (message.stack ?? message.message) : String(message);
	const extra = rest.length ? ' ' + rest.map(part => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ') : '';

	console.log(`${COLOUR[level]}[base | ${level}]${COLOUR.reset}: ${text}${extra}`);
};

export const logger = {
	error: (message: unknown, ...rest: unknown[]): void => write('error', message, ...rest),
	warn: (message: unknown, ...rest: unknown[]): void => write('warn', message, ...rest),
	info: (message: unknown, ...rest: unknown[]): void => write('info', message, ...rest),
	verbose: (message: unknown, ...rest: unknown[]): void => write('verbose', message, ...rest),
	debug: (message: unknown, ...rest: unknown[]): void => {
		if(globalThis.developmentMode) {
			write('debug', message, ...rest);
		}
	},
};

export type Logger = typeof logger;
