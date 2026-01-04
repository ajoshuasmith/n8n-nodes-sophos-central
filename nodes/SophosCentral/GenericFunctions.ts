import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import type { IAuthToken, ISophosCentralCredentials, ITenant } from './types';

const tokenCache = new Map<string, IAuthToken>();

function getCacheKey(credentials: ISophosCentralCredentials): string {
	return `${credentials.clientId}:${credentials.clientSecret}`;
}

function joinUrl(baseUrl: string, endpoint: string): string {
	const normalizedBase =
		baseUrl.startsWith('http://') || baseUrl.startsWith('https://')
			? baseUrl
			: `https://${baseUrl}`;

	const base = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase;
	const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	return `${base}${path}`;
}

export async function getAuthContext(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	credentials: ISophosCentralCredentials,
): Promise<IAuthToken> {
	const cacheKey = getCacheKey(credentials);
	const cached = tokenCache.get(cacheKey);

	if (cached && cached.expiresAt > Date.now() + 300000 && cached.dataRegion) {
		return cached;
	}

	const token = await getAccessToken.call(this, credentials);
	const whoami = await getWhoAmI.call(this, token);

	const ctx: IAuthToken = {
		token,
		expiresAt: whoami.expiresAt,
		partnerId: whoami.partnerId,
		dataRegion: whoami.dataRegion,
	};

	tokenCache.set(cacheKey, ctx);
	return ctx;
}

export async function getAccessToken(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	credentials: ISophosCentralCredentials,
): Promise<string> {
	const body = `grant_type=client_credentials&scope=token&client_id=${encodeURIComponent(
		credentials.clientId,
	)}&client_secret=${encodeURIComponent(credentials.clientSecret)}`;

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: 'https://id.sophos.com/api/v2/oauth2/token',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body,
		json: true,
	};

	try {
		const response = (await this.helpers.httpRequest(options)) as IDataObject;
		return response.access_token as string;
	} catch (error) {
		const err = error as IDataObject;
		const errorResponse = (error || {}) as JsonObject;
		throw new NodeApiError(this.getNode(), errorResponse, {
			message: 'Failed to authenticate with Sophos Central',
			description:
				err.error_description?.toString() ||
				err.message?.toString() ||
				'Invalid client credentials',
		});
	}
}

export async function getWhoAmI(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	token: string,
): Promise<IAuthToken> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: 'https://api.central.sophos.com/whoami/v1',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		json: true,
	};

	try {
		const response = (await this.helpers.httpRequest(options)) as IDataObject;
		const apiHosts =
			(response as IDataObject).apiHosts ||
			(response as IDataObject)['api-hosts'] ||
			(response as IDataObject).api_hosts;

		const dataRegion =
			(apiHosts as IDataObject)?.dataRegion ||
			(apiHosts as IDataObject)?.['data-region'] ||
			(apiHosts as IDataObject)?.global;

		if (!dataRegion) {
			throw new NodeOperationError(this.getNode(), 'Could not determine data region from whoami');
		}

		return {
			token,
			expiresAt: Date.now() + 3600 * 1000,
			partnerId: (response as IDataObject).id as string,
			dataRegion: dataRegion as string,
		};
	} catch (error) {
		const errorResponse = (error || {}) as JsonObject;
		throw new NodeApiError(this.getNode(), errorResponse, {
			message: 'Failed to get Sophos Central account context',
			description: 'Could not retrieve whoami information from Sophos Central',
		});
	}
}

export async function getTenantList(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	credentials: ISophosCentralCredentials,
): Promise<ITenant[]> {
	if (credentials.accountType !== 'partner') {
		return [];
	}

	const ctx = await getAuthContext.call(this, credentials);

	const returnData: ITenant[] = [];
	let page = 1;
	const pageSize = 100;
	let totalPages = 1;

	do {
		const response = (await this.helpers.httpRequest({
			method: 'GET',
			url: 'https://api.central.sophos.com/partner/v1/tenants',
			headers: {
				Authorization: `Bearer ${ctx.token}`,
				'X-Partner-ID': ctx.partnerId as string,
			},
			qs: {
				page,
				pageSize,
				pageTotal: true,
			},
			json: true,
		})) as IDataObject;

		const items = (response as IDataObject).items as ITenant[] | undefined;
		if (items?.length) {
			returnData.push(...items);
		}

		const pages = (response as IDataObject).pages as IDataObject | undefined;
		totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
		page += 1;
	} while (page <= totalPages);

	return returnData;
}

export async function resolveTenantId(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	tenantIdFromParameters: string | undefined,
): Promise<string> {
	if (tenantIdFromParameters) {
		return tenantIdFromParameters;
	}

	const credentials = (await this.getCredentials(
		'sophosCentralApi',
	)) as unknown as ISophosCentralCredentials;

	if (credentials.accountType === 'organization' && credentials.tenantId) {
		return credentials.tenantId;
	}

	throw new NodeOperationError(
		this.getNode(),
		'Tenant is required for Partner accounts. Select a tenant, or use an Organization credential.',
	);
}

export async function sophosCentralApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	tenantId?: string,
): Promise<IDataObject> {
	const credentials = (await this.getCredentials(
		'sophosCentralApi',
	)) as unknown as ISophosCentralCredentials;

	const ctx = await getAuthContext.call(this, credentials);

	const effectiveTenantId =
		tenantId || (credentials.accountType === 'organization' ? credentials.tenantId : undefined);

	if (!effectiveTenantId) {
		throw new NodeOperationError(
			this.getNode(),
			'Tenant ID is required. Select a tenant in the node parameters.',
		);
	}

	const url = joinUrl(ctx.dataRegion, endpoint);

	const options: IHttpRequestOptions = {
		method,
		url,
		headers: {
			Authorization: `Bearer ${ctx.token}`,
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Tenant-ID': effectiveTenantId,
		},
		qs: query,
		json: true,
	};

	if (Object.keys(body).length > 0) {
		options.body = body;
	}

	try {
		return await this.helpers.httpRequest(options);
	} catch (error: unknown) {
		const errorResponse = (error || {}) as JsonObject;
		const err = error as {
			statusCode?: number;
			response?: { headers?: IDataObject };
			error?: { message?: string; error_description?: string };
			message?: string;
		};

		if (err.statusCode === 401) {
			tokenCache.delete(getCacheKey(credentials));
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Authentication failed',
				description:
					'Your access token has expired or credentials are invalid. Please check your API credentials.',
			});
		}

		if (err.statusCode === 403) {
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Permission denied',
				description: 'Your API credentials do not have permission to perform this action.',
			});
		}

		if (err.statusCode === 404) {
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Resource not found',
				description: err.error?.message || 'The requested resource does not exist.',
			});
		}

		if (err.statusCode === 429) {
			const retryAfter = err.response?.headers?.['retry-after'] || 60;
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Rate limit exceeded',
				description: `Please retry after ${retryAfter} seconds.`,
			});
		}

		const errorMessage =
			err.error?.message || err.error?.error_description || err.message || 'Unknown error';

		throw new NodeApiError(this.getNode(), errorResponse, {
			message: 'Sophos Central API Error',
			description: errorMessage,
		});
	}
}

export async function sophosCentralApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	tenantId?: string,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	let page = 1;
	const pageSize = 100;
	let totalPages = 1;

	do {
		const response = await sophosCentralApiRequest.call(
			this,
			method,
			endpoint,
			body,
			{
				...query,
				page,
				pageSize,
				pageTotal: true,
			},
			tenantId,
		);

		const items = (response as IDataObject).items as IDataObject[] | undefined;
		if (items?.length) {
			returnData.push(...items);
		}

		const pages = (response as IDataObject).pages as IDataObject | undefined;
		totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
		page += 1;
	} while (page <= totalPages);

	return returnData;
}

declare const setTimeout: (handler: () => void, timeout: number) => unknown;

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
