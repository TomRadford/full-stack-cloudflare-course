import { getLink } from '@repo/data-ops/queries/links';
import { linkSchema, LinkSchemaType } from '@repo/data-ops/zod-schema/links';

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
