/* Every kind of thing that offers a floating prompt. Registered once, at import. */
import { describePrompts, setPromptEnabled } from '../index';
import './peds';
import './vehicles';
import './props';

/*
 *   /prompts             lists every definition
 *   /prompts <id> off    switches one off (and on again)
 */
RegisterCommand('prompts', (_source: number, args: string[]) => {
	const [id, state] = args;

	if(id && state) {
		console.log(setPromptEnabled(id, state !== 'off') ? `[prompts]: '${id}' is now ${state === 'off' ? 'off' : 'on'}.` : `[prompts]: no definition called '${id}'.`);
		return;
	}
	for(const line of describePrompts()) {
		console.log(`[prompts]: ${line}`);
	}
}, false);
