// Load the built server bundle with every native stubbed, to catch module-eval failures without
// booting FXServer. Only synchronous module evaluation is checked.
const fs = require('fs');
const path = require('path');

const bundle = path.resolve(__dirname, '../../resources/base/server/index.js');

if(!fs.existsSync(bundle)) {
	console.error('[base]: server bundle missing. Build it before smoke-testing.');
	process.exit(1);
}

const code = fs.readFileSync(bundle, 'utf8');
const noop = function() { return 0; };

process.on('unhandledRejection', () => { /* a rejected query during load is expected here */ });

const natives = {
	GetCurrentResourceName: () => 'base',
	GetResourcePath: () => path.resolve(__dirname, '../../resources/base'),
	GetConvar: (_name, fallback) => fallback,
	GetConvarInt: (_name, fallback) => fallback,
	GetPlayers: () => [],
	GetGameTimer: () => 0,
	source: 0,
	on: noop, onNet: noop, emit: noop, emitNet: noop,
	AddEventHandler: noop, RegisterNetEvent: noop, RegisterCommand: noop,
	TriggerEvent: noop, TriggerClientEvent: noop, ExecuteCommand: noop,
};

for(const [name, value] of Object.entries(natives)) {
	if(typeof global[name] === 'undefined') {
		global[name] = value;
	}
}

// A stub that survives being called, constructed or walked into (`GlobalState.set(...)`).
const makeStub = () => {
	// A function expression on purpose: an arrow has no [[Construct]], and the bundle does `new Foo()`.
	// eslint-disable-next-line prefer-arrow-callback
	const stub = new Proxy(function() { return stub; }, {
		get: (_target, prop) => {
			if(prop === Symbol.toPrimitive) {
				return () => 0;
			}
			if(prop === 'then' || prop === Symbol.iterator || prop === Symbol.asyncIterator) {
				return undefined;
			}
			return stub;
		},
		apply: () => stub,
		construct: () => stub,
	});

	return stub;
};

let stubbed = 0;

for(const match of code.matchAll(/\b([A-Z][A-Za-z0-9_]{2,})\s*[.(]/g)) {
	const name = match[1];

	if(typeof global[name] === 'undefined') {
		global[name] = makeStub();
		stubbed++;
	}
}

const realConsole = { log: console.log, error: console.error };
const realWrite = { out: process.stdout.write.bind(process.stdout), err: process.stderr.write.bind(process.stderr) };
const mute = () => {
	process.stdout.write = () => true;
	process.stderr.write = () => true;
};
const unmute = () => {
	process.stdout.write = realWrite.out;
	process.stderr.write = realWrite.err;
};

mute();

try {
	require(bundle);
	unmute();
	realConsole.log(`[base]: server bundle evaluated cleanly (${stubbed} natives stubbed).`);
	process.exit(0);
} catch(e) {
	unmute();

	const frames = (e && e.stack || '').split('\n').filter(line => line.trim().startsWith('at '));
	const frame = frames.find(line => line.includes('index.js:')) || frames[0] || '';

	realConsole.error(`[base]: server bundle FAILED to evaluate: ${e && e.message}`);
	realConsole.error(`[base]: ${frame.trim()}`);

	const match = /index\.js:(\d+):(\d+)/.exec(frame);

	if(match) {
		const line = code.split('\n')[Number(match[1]) - 1] || '';
		const column = Number(match[2]);
		realConsole.error(`[base]: near -> ...${line.slice(Math.max(0, column - 200), column + 80)}...`);
	}
	process.exit(1);
}
