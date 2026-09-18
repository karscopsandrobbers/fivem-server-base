const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const styleRules = {
	'no-async-promise-executor': 'off',
	'semi': ['error', 'always'],
	'quotes': ['error', 'single'],
	'keyword-spacing': ['error', {
		'overrides': {
			'for': { 'after': false },
			'if': { 'after': false },
			'while': { 'after': false },
			'catch': { 'after': false },
			'switch': { 'after': false },
		},
	}],
	'block-scoped-var': 2,
	'no-empty-function': 2,
	'no-lone-blocks': 2,
	'no-self-compare': 2,
	'no-unused-expressions': 2,
	'no-undef': 0,
	'prefer-spread': 2,
	'prefer-object-spread': 2,
	'prefer-rest-params': 2,
	'prefer-const': ['error', { 'destructuring': 'any', 'ignoreReadBeforeAssign': false }],
	'func-style': ['error', 'expression', { 'allowArrowFunctions': true }],
	'prefer-arrow-callback': 2,
	'arrow-spacing': ['error', { 'before': true, 'after': true }],
	'arrow-parens': ['error', 'as-needed'],
	'implicit-arrow-linebreak': ['error', 'beside'],
};

module.exports = [
	{
		ignores: ['**/node_modules/**', '**/dist/**'],
	},
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'commonjs',
			globals: { ...globals.node },
		},
		rules: styleRules,
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module',
			globals: { ...globals.node },
		},
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
			...styleRules,
		},
	},
	{
		/*
		 * State bags are written through a proxy or `.state.set(key, value, true)`, never by
		 * assignment. Legacy replicates an assignment by default; FiveM for GTAV Enhanced replicates
		 * only when asked, so a bare assignment silently stops leaving the server there.
		 */
		files: ['src/**/*.ts'],
		rules: {
			'no-restricted-syntax': ['error',
				{
					selector: 'AssignmentExpression[left.object.property.name="state"]',
					message: 'Do not assign to a state bag key directly. Use a proxy (player.data / vehicle.data / mp.world.data), or .state.set(key, value, true).',
				},
				{
					selector: 'AssignmentExpression[left.object.name="GlobalState"]',
					message: 'Do not assign to GlobalState directly. Use mp.world.data.x = v, or GlobalState.set(key, value, true).',
				},
				{
					// map/filter/forEach also pass (index, array); Enhanced rejects the array as a malformed vector.
					selector: 'CallExpression[callee.property.name=/^(map|forEach|filter|flatMap|find|findIndex|some|every)$/] > Identifier.arguments[name=/^[A-Z]/]:not([name=/^(Boolean|String|Number|Array|Object|JSON|Math|Date|Promise|BigInt|Symbol)$/])',
					message: 'Do not pass a native to an array method point-free. Wrap it: .map(x => TheNative(x)).',
				},
			],
		},
	},
];
