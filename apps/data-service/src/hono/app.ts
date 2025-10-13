import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { Hono } from 'hono';
import { getDestinationForCountry, getRoutingDestinations } from '../helpers/routing-ops';
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

	// YOU ARE HERE: 10:22
	c.executionCtx.waitUntil(c.env.QUEUE.send(message));

	return c.redirect(destination);
});

App.get('/click/:name', async (c) => {
	return c.json({});
});
