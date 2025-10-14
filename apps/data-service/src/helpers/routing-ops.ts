import { getLink } from '@repo/data-ops/queries/links';
import { linkSchema, LinkSchemaType } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';
import moment from 'moment';

export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
	if (!countryCode) {
		return linkInfo.destinations.default;
	}

	if (linkInfo.destinations[countryCode]) {
		return linkInfo.destinations[countryCode];
	}

	return linkInfo.destinations.default;
}

export async function getLinkInfoFromKV(env: Env, linkId: string) {
	const linkInfo = await env.CACHE.get(linkId);
	if (!linkInfo) {
		return null;
	}
	try {
		return linkSchema.parse(linkInfo);
	} catch {
		return null;
	}
}

const TTL_TIME = 60 * 60 * 24; // 1 day

export async function saveLinkInfoToKv(env: Env, linkInfo: LinkSchemaType) {
	try {
		await env.CACHE.put(linkInfo.linkId, JSON.stringify(linkInfo), { expirationTtl: TTL_TIME });
	} catch (error) {
		console.error('Error saving link info to KV:', error);
	}
}

export async function getRoutingDestinations(env: Env, linkId: string) {
	const linkInfoFromKV = await getLinkInfoFromKV(env, linkId);
	if (linkInfoFromKV) {
		return linkInfoFromKV;
	}
	const linkInfoFromDb = await getLink(linkId);
	if (!linkInfoFromDb) {
		return null;
	}
	await saveLinkInfoToKv(env, linkInfoFromDb);
	return linkInfoFromDb;
}

export async function scheduleEvalWorkflow(env: Env, event: LinkClickMessageType) {
	const doId = env.EVALUATION_SCHEDULER.idFromName(`${event.data.id}:${event.data.destination}`);
	const stub = env.EVALUATION_SCHEDULER.get(doId);
	await stub.collectLinkClick({
		linkId: event.data.id,
		accountId: event.data.accountId,
		destinationUrl: event.data.destination,
		destinationCountryCode: event.data.country || 'UNKNOWN',
	});
}

export async function captureLinkClickInBackground(env: Env, event: LinkClickMessageType) {
	await env.QUEUE.send(event);

	const doId = env.LINK_CLICK_TRACKER_OBJECT.idFromName(event.data.accountId);
	const stub = env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	if (!event.data.latitude || !event.data.longitude || !event.data.country) return;
	await stub.addClick(event.data.latitude, event.data.longitude, event.data.country, moment().valueOf());
}
