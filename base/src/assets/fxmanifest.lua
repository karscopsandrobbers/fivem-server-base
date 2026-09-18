fx_version 'cerulean'
game 'gta5'

version '0.1.0'
description 'A barebones TypeScript FiveM server.'

resource_type 'gametype' { name = 'Base' }

-- The language catalogues are read by the server at runtime (i18n/<code>.json).
files {
	'i18n/*.json',
}

client_script 'client/index.js'
server_script 'server/index.js'
