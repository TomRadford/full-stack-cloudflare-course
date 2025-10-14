import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { Hono } from 'hono';
import { captureLinkClickInBackground, getDestinationForCountry, getRoutingDestinations } from '../helpers/routing-ops';
import { LinkClickMessageType, QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';

export const App = new Hono<{ Bindings: Env }>();

App.get('/:id', async (c) => {
	const id = c.req.param('id');
	const linkInfo = await getRoutingDestinations(c.env, id);

	if (!linkInfo) {
		return c.text('Invalid Link', 200);
	}

	const cfHeaders = cloudflareInfoSchema.safeParse(c.req.raw.cf);

	if (!cfHeaders.success) {
		return c.text('Invalid Cloudflare headers', 200);
	}

	const headers = cfHeaders.data;

	const destination = getDestinationForCountry(linkInfo, headers.country);

	const message: LinkClickMessageType = {
		type: 'LINK_CLICK',
		data: {
			id: id,
			country: headers.country,
			destination,
			accountId: linkInfo.accountId,
			latitude: headers.latitude,
			longitude: headers.longitude,
			timestamp: new Date().toISOString(),
		},
	};

	c.executionCtx.waitUntil(captureLinkClickInBackground(c.env, message));

	return c.redirect(destination);
});

App.get('/client-socket', async (c) => {
	const upgradeHeader = c.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

	const accountId = c.req.header('account-id');
	if (!accountId) {
		return c.text('No Headers', 404);
	}

	const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);

	return await stub.fetch(c.req.raw);
});
