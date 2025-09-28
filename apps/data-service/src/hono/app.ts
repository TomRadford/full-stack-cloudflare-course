import { getLink } from '@repo/data-ops/queries/links';
import { cloudflareInfoSchema, CloudflareInfoSchemaType } from '@repo/data-ops/zod-schema/links';
import { Hono } from 'hono';
import { getDestinationForCountry, getRoutingDestinations } from '../helpers/routing-ops';

export const App = new Hono<{ Bindings: Env }>();

App.get('/:id', async (c) => {
	const linkInfo = await getRoutingDestinations(c.env, c.req.param('id'));

	if (!linkInfo) {
		return c.text('Invalid Link', 200);
	}

	const cfHeaders = cloudflareInfoSchema.safeParse(c.req.raw.cf);

	if (!cfHeaders.success) {
		return c.text('Invalid Cloudflare headers', 200);
	}

	const headers = cfHeaders.data;

	const destination = getDestinationForCountry(linkInfo, headers.country);

	return c.redirect(destination);
});
