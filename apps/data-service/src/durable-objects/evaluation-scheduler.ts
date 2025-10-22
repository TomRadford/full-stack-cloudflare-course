import { DurableObject } from 'cloudflare:workers';
import moment from 'moment';

interface ClickData {
	accountId: string;
	linkId: string;
	destinationUrl: string;
	destinationCountryCode: string;
}
// note we need to pass Env type here to get our extended service binding env
export class EvaluationScheduler extends DurableObject<Env> {
	clickData: ClickData | undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			this.clickData = await ctx.storage.get<ClickData>('click_data');
		});
	}

	async collectLinkClick(newClickData: ClickData) {
		this.clickData = newClickData;
		await this.ctx.storage.put('click_data', newClickData);

		const alarm = await this.ctx.storage.getAlarm();

		if (!alarm) {
			const oneDay = moment().add(24, 'hours').valueOf();
			await this.ctx.storage.setAlarm(oneDay);
		}
	}

	async alarm() {
		console.log('alarm triggered');

		const clickData = this.clickData;

		if (!clickData) {
			throw new Error('no click data found');
		}

		await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
			params: {
				linkId: clickData.linkId,
				accountId: clickData.accountId,
				destinationUrl: clickData.destinationUrl,
			},
		});
	}
}
