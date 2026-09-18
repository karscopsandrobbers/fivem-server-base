// Evaluate the built client bundle with every native stubbed, to catch module-eval failures
// (circular-import TDZ, natives called at load time) without booting FXServer.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bundle = path.resolve(__dirname, '../../resources/base/client/index.js');
const code = fs.readFileSync(bundle, 'utf8');
const noop = function() { return 0; };

const Citizen = new Proxy({}, { get: () => noop });
const silentConsole = { log: noop, info: noop, warn: noop, debug: noop, error: noop, trace: noop };

const known = {
	Citizen,
	console: silentConsole,
	setTimeout: noop,
	clearTimeout: noop,
	setInterval: noop,
	clearInterval: noop,
	GetActiveScreenResolution: () => [1920, 1080],
	HasStreamedTextureDictLoaded: () => true,
	GetCurrentResourceName: () => 'base',
	GetResourcePath: () => '.',
	LocalPlayer: { state: {} },
	GlobalState: {},
	GetActivePlayers: () => [],
	Date, Math, JSON, Number, String, Boolean, Array, Object, Map, Set, WeakMap, Promise,
	RegExp, Error, TypeError, Symbol, parseInt, parseFloat, isFinite, isNaN, encodeURIComponent,
	decodeURIComponent, globalThis: null,
};

const sandbox = new Proxy(known, {
	has: () => true,
	get: (target, prop) => {
		if(prop in target) {
			return target[prop];
		}
		if(prop === Symbol.unscopables || prop === Symbol.toStringTag) {
			return undefined;
		}
		return noop;
	},
	set: (target, prop, value) => {
		target[prop] = value;
		return true;
	},
});

try {
	vm.runInNewContext(code, sandbox, { filename: 'client/index.js' });
	console.log('[base]: client bundle evaluated cleanly.');
} catch(e) {
	const frame = (e && e.stack || '').split('\n').find(line => line.includes('client/index.js:')) || '';
	const at = frame.trim().replace(/^at\s*/, '');
	console.error(`[base]: client bundle FAILED to evaluate: ${e && e.message} (${at})`);

	const match = /client\/index\.js:(\d+):(\d+)/.exec(at);

	if(match) {
		const line = code.split('\n')[Number(match[1]) - 1] || '';
		const column = Number(match[2]);
		console.error(`[base]: near -> ...${line.slice(Math.max(0, column - 160), column + 60)}...`);
	}
	process.exit(1);
}
