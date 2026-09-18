const { build, context } = require('esbuild');
const path = require('path');
const fs = require('fs-extra');
const { execFileSync } = require('child_process');
const argv = require('minimist')(process.argv.slice(2));

const
	rootDir = path.resolve(__dirname, '..'),
	srcDir = path.join(rootDir, 'src'),
	resourceName = 'base',
	outDir = path.resolve(rootDir, '../', `resources/${resourceName}`),
	// esbuild does not read tsconfig `paths` per entry point, so the aliases are mirrored here.
	sharedAlias = { '@shared': path.join(srcDir, 'utils/shared') },
	baseOpts = {
		bundle: true,
		minifyWhitespace: true,
		minifyIdentifiers: true,
		sourcemap: 'inline',
		charset: 'utf8',
		loader: { '.ts': 'ts' },
	},
	targets = {
		server: {
			...baseOpts,
			entryPoints: [path.join(rootDir, 'src/server/index.ts')],
			outdir: path.join(outDir, 'server'),
			platform: 'node',
			target: 'node22',
			format: 'cjs',
			alias: { ...sharedAlias, '@server': path.join(srcDir, 'server') },
			// FXServer's V8 host has no dynamic-import callback; any surviving import() would throw.
			supported: { 'dynamic-import': false },
			minifyIdentifiers: false,
		},
		client: {
			...baseOpts,
			entryPoints: [path.join(rootDir, 'src/client/index.ts')],
			outdir: path.join(outDir, 'client'),
			platform: 'browser',
			alias: { ...sharedAlias, '@client': path.join(srcDir, 'client') },
		},
	},
	colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', blue: '\x1b[34m' }
;

const copyAssets = () => {
	console.log('[base]: copying assets...');
	fs.ensureDirSync(outDir);
	fs.copyFileSync(path.join(rootDir, 'src/assets/fxmanifest.lua'), path.join(outDir, 'fxmanifest.lua'));
	// Language files are read by the server at runtime from the resource's own folder.
	fs.emptyDirSync(path.join(outDir, 'i18n'));
	fs.copySync(path.join(rootDir, 'i18n'), path.join(outDir, 'i18n'), {
		filter: src => fs.statSync(src).isDirectory() || src.endsWith('.json'),
	});
};

// esbuild does not type-check; tsc --noEmit runs first so a type error never hides in a bundle.
const typecheck = name => {
	console.log(`[base; ${colors.blue}${name}${colors.reset}]: type-checking...`);
	const tscBin = path.join(rootDir, 'node_modules/.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
	execFileSync(tscBin, ['-p', `./src/${name}/tsconfig.json`, '--noEmit'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: process.platform === 'win32',
	});
};

// A relative require() that survives into the bundle resolves against the resource root at
// runtime and throws. Nothing in the source should reach the bundle as one; use an import.
const assertNoRelativeRequires = name => {
	const outFile = path.join(targets[name].outdir, 'index.js');

	if(!fs.existsSync(outFile)) {
		return;
	}
	const found = [...fs.readFileSync(outFile, 'utf8').matchAll(/require\((['"])(\.[^'"]*)\1\)/g)].map(match => match[2]);

	if(found.length) {
		for(const request of [...new Set(found)]) {
			console.error(`[base; ${colors.blue}${name}${colors.reset}]: ${colors.red}require('${request}') survived bundling${colors.reset}. Use an import.`);
		}
		throw new Error(`${name}: ${new Set(found).size} relative require(s) left in the bundle.`);
	}
};

const bundle = name => build(targets[name]).then(() => {
	assertNoRelativeRequires(name);
	console.log(`[base; ${colors.blue}${name}${colors.reset}]: ${colors.green}built${colors.reset}.`);
});

// Evaluate each bundle with the natives stubbed, so a circular import or a native called at load
// fails the build rather than the server.
const smokeTest = name => {
	console.log(`[base; ${colors.blue}${name}${colors.reset}]: smoke-testing bundle...`);
	execFileSync(process.execPath, [path.join(__dirname, `smoke-${name}.js`)], { cwd: rootDir, stdio: 'inherit' });
};

// The content-pack manifests are regenerated on every build so a fresh clone starts cleanly.
const scaffoldDlc = () => {
	try {
		execFileSync(process.execPath, [path.join(__dirname, 'dlc.js')], { stdio: 'ignore' });
	} catch(e) {
		console.warn('[base]: dlc scaffold skipped -', e.message);
	}
};

const names = argv._.length ? argv._.filter(name => targets[name]) : Object.keys(targets);

// --watch rebuilds on save without type-checking. Run a full `npm run build` before committing.
const watch = async () => {
	const contexts = await Promise.all(names.map(name => context({
		...targets[name],
		plugins: [{
			name: 'base-watch-log',
			setup(pluginBuild) {
				pluginBuild.onEnd(result => {
					if(result.errors.length) {
						console.log(`[base; ${colors.blue}${name}${colors.reset}]: ${colors.red}build failed${colors.reset}.`);
						return;
					}
					copyAssets();
					console.log(`[base; ${colors.blue}${name}${colors.reset}]: ${colors.green}rebuilt${colors.reset} at ${new Date().toLocaleTimeString()}.`);
				});
			},
		}],
	})));

	await Promise.all(contexts.map(ctx => ctx.watch()));
	console.log(`[base]: ${colors.green}watching${colors.reset}. Run 'restart ${resourceName}' in the server console to apply a rebuild.`);
};

(async () => {
	try {
		copyAssets();
		scaffoldDlc();

		if(argv.watch) {
			await watch();
			return;
		}
		names.forEach(typecheck);
		await Promise.all(names.map(bundle));
		names.forEach(smokeTest);
		console.log(`[base]: ${colors.green}build complete${colors.reset}.`);
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
})();
