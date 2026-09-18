/*
 * The client registry. Every module that has to run is named here, in dependency order; esbuild
 * bundles only what an entry reaches, so a module nobody imports is silently absent.
 */
import { EVENTS } from '@shared/events';

import './modules/gui/instructions';
import './gui';
import './gui/messages';
import './gui/scaleform_messages';

import './core/controls';
import './core/entity';
import './core/world';
import './core/vehicles';
import './core/player';
import './core/peds';
import './core/prompts/definitions';
import './core/tasks';
import './core/spawn';
import './core/debug';

on('onClientResourceStart', (resource: string) => {
	if(GetCurrentResourceName() === resource) {
		emitNet(EVENTS.CLIENT_FEEDBACK, `client resource '${resource}' started.`);
	}
});
