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

// Cache tenant API hosts to avoid repeated lookups (10-minute TTL)
interface ITenantHostCache {
	apiHost: string;
	expiresAt: number;
}
const tenantHostCache = new Map<string, ITenantHostCache>();
const TENANT_HOST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (tenant regions are essentially permanent)

function getCacheKey(credentials: ISophosCentralCredentials): string {
	return `${credentials.clientId}:${credentials.clientSecret}`;
}

async function sophosHttpRequestWithRetry(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	options: IHttpRequestOptions,
): Promise<IDataObject> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			return (await this.helpers.httpRequest(options)) as IDataObject;
		} catch (error) {
			const err = error as { statusCode?: number; response?: { status?: number; statusCode?: number; headers?: IDataObject } };
			const status = err.statusCode || err.response?.status || err.response?.statusCode;
			if ((status !== 429 && (!status || status < 500)) || attempt === 2) throw error;
			const retryAfter = Number(err.response?.headers?.['retry-after']);
			await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * 2 ** attempt);
		}
	}
	throw new Error('Unreachable retry state');
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
		idType: whoami.idType,
		dataRegion: whoami.dataRegion,
	};

	if (credentials.accountType === 'partner' && ctx.idType !== 'partner') {
		throw new NodeOperationError(
			this.getNode(),
			`This credential is configured as Partner, but Sophos whoami returned '${ctx.idType || 'no idType'}'. Create or select Partner API credentials, then try again.`,
		);
	}

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
			idType: (response as IDataObject).idType as string | undefined,
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

function getSophosErrorDescription(error: unknown): string {
	const err = error as {
		message?: string;
		error?: {
			message?: string;
			error?: string;
			error_description?: string;
			correlationId?: string;
			code?: string;
		};
		response?: {
			data?: { message?: string; error?: string; correlationId?: string; code?: string };
			body?: { message?: string; error?: string; correlationId?: string; code?: string };
		};
	};
	const details = err.response?.data || err.response?.body || err.error;
	const message = details?.message || details?.error || err.message || 'Unknown error';
	const correlationId = details?.correlationId;
	const code = details?.code;

	return [
		message,
		code ? `Code: ${code}` : undefined,
		correlationId ? `Correlation ID: ${correlationId}` : undefined,
	]
		.filter((value): value is string => Boolean(value))
		.join(' | ');
}

export async function sophosCentralLicensingApiRequest(
	this: IExecuteFunctions,
	endpoint: string,
	query: IDataObject = {},
	tenantId?: string,
): Promise<IDataObject> {
	const credentials = (await this.getCredentials(
		'sophosCentralApi',
	)) as unknown as ISophosCentralCredentials;
	const ctx = await getAuthContext.call(this, credentials);
	const effectiveTenantId =
		tenantId || (credentials.accountType === 'organization' ? credentials.tenantId : undefined);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${ctx.token}`,
		Accept: 'application/json',
	};

	if (effectiveTenantId) {
		headers['X-Tenant-ID'] = effectiveTenantId;
	} else if (credentials.accountType === 'partner' && ctx.partnerId) {
		headers['X-Partner-ID'] = ctx.partnerId;
	} else {
		throw new NodeOperationError(
			this.getNode(),
			'A Tenant ID is required for this Licensing API request.',
		);
	}

	try {
		return await sophosHttpRequestWithRetry.call(this, {
			method: 'GET',
			url: `https://api.central.sophos.com/licenses/v1${endpoint}`,
			headers,
			qs: query,
			json: true,
		});
	} catch (error) {
		const err = error as {
			statusCode?: number;
			response?: {
				status?: number;
				statusCode?: number;
				data?: IDataObject;
			};
		};
		const statusCode =
			err.statusCode || err.response?.status || err.response?.statusCode || 'Unknown';
		const scope = effectiveTenantId ? `tenant ${effectiveTenantId}` : `partner ${ctx.partnerId}`;
		const description = `${getSophosErrorDescription(error)} | Request scope: ${scope}`;
		const errorResponse = {
			...(error as object),
			response: {
				...err.response,
				data: {
					...err.response?.data,
					message: description,
				},
			},
		} as JsonObject;

		throw new NodeApiError(this.getNode(), errorResponse, {
			message: `Sophos Licensing API error (Status ${statusCode})`,
			description,
		});
	}
}

export async function sophosCentralLicensingApiRequestAllItems(
	this: IExecuteFunctions,
	endpoint: string,
	tenantId?: string,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let page = 1;
	let totalPages = 1;

	do {
		const response = await sophosCentralLicensingApiRequest.call(this, endpoint, {
			page,
			pageSize: 100,
			pageTotal: true,
		}, tenantId);
		const pageItems = (response.items as IDataObject[]) || [];
		items.push(...pageItems);

		const pages = response.pages as IDataObject | undefined;
		totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
		page += 1;
	} while (page <= totalPages);

	return items;
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

export async function getTenantApiHost(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	tenantId: string,
): Promise<string> {
	const credentials = (await this.getCredentials(
		'sophosCentralApi',
	)) as unknown as ISophosCentralCredentials;

	if (credentials.accountType === 'partner') {
		// Check cache first to avoid excessive API calls
		const cached = tenantHostCache.get(tenantId);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.apiHost;
		}

		// Fetch the specific tenant to get its apiHost
		const ctx = await getAuthContext.call(this, credentials);
		
		try {
			const response = (await this.helpers.httpRequest({
				method: 'GET',
				url: `https://api.central.sophos.com/partner/v1/tenants/${tenantId}`,
				headers: {
					Authorization: `Bearer ${ctx.token}`,
					'X-Partner-ID': ctx.partnerId as string,
				},
				json: true,
			})) as IDataObject;

			// Get apiHost from response
			let apiHost = response.apiHost || response['api-host'];
			
			if (!apiHost) {
				// Fallback: construct from dataRegion
				const dataRegion = response.dataRegion || response['data-region'];
				if (dataRegion) {
					apiHost = `https://api-${dataRegion}.central.sophos.com`;
				}
			}

			if (!apiHost) {
				throw new NodeOperationError(
					this.getNode(),
					`Tenant '${tenantId}' found but no apiHost or dataRegion in response.`,
				);
			}

			// Cache the API host
			tenantHostCache.set(tenantId, {
				apiHost: apiHost as string,
				expiresAt: Date.now() + TENANT_HOST_CACHE_TTL,
			});

			return apiHost as string;
		} catch {
			// Clear any stale cache entry on error
			tenantHostCache.delete(tenantId);
			throw new NodeOperationError(
				this.getNode(),
				`Could not find tenant '${tenantId}'. Ensure it exists and is accessible by this Partner account.`,
			);
		}
	}

	// For Organization accounts, use the auth context's data region
	const ctx = await getAuthContext.call(this, credentials);
	return ctx.dataRegion;
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

	// Get the API host specific to this tenant (critical for multi-region support)
	const apiHost = await getTenantApiHost.call(this, effectiveTenantId);
	const url = joinUrl(apiHost, endpoint);

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
		return await sophosHttpRequestWithRetry.call(this, options);
	} catch (error: unknown) {
		const errorResponse = (error || {}) as JsonObject;
		const err = error as {
			statusCode?: number;
			response?: { headers?: IDataObject; status?: number; statusCode?: number };
			error?: { message?: string; error_description?: string };
			message?: string;
		};

		// Try to capture the status code from various possible locations in the error object
		const statusCode = err.statusCode || err.response?.status || err.response?.statusCode;

		// Critical Debugging Info: Include the URL we tried to hit in the error message
		// This helps verify if we hit the correct region (e.g., api-us01 vs api-eu01)
		const debugInfo = `(URL: ${url}, Tenant: ${effectiveTenantId}, Host: ${apiHost})`;

		if (statusCode === 401) {
			tokenCache.delete(getCacheKey(credentials));
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Authentication failed',
				description:
					'Your access token has expired or credentials are invalid. Please check your API credentials.',
			});
		}

		if (statusCode === 403) {
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Permission denied',
				description: 'Your API credentials do not have permission to perform this action.',
			});
		}

		if (statusCode === 404) {
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: `Resource not found ${debugInfo}`,
				description: err.error?.message || 'The requested resource does not exist. Check if the ID is correct and belongs to this tenant.',
			});
		}

		if (statusCode === 429) {
			const retryAfter = err.response?.headers?.['retry-after'] || 60;
			throw new NodeApiError(this.getNode(), errorResponse, {
				message: 'Rate limit exceeded',
				description: `Please retry after ${retryAfter} seconds.`,
			});
		}

		const errorMessage =
			err.error?.message || err.error?.error_description || err.message || 'Unknown error';

		throw new NodeApiError(this.getNode(), errorResponse, {
			message: `Sophos Central API Error (Status ${statusCode || 'Unknown'}) ${debugInfo}`,
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

// Helper to get firewalls from all tenants for Partner accounts
export async function getAllTenantsFirewalls(
	this: IExecuteFunctions,
	credentials: ISophosCentralCredentials,
	returnAll: boolean,
	limit?: number,
): Promise<IDataObject[]> {
	const tenants = await getTenantList.call(this, credentials);
	const allFirewalls: IDataObject[] = [];

	for (const tenant of tenants) {
		if (!returnAll && limit !== undefined && allFirewalls.length >= limit) break;

		try {
			let tenantFirewalls: IDataObject[];
			if (returnAll) {
				tenantFirewalls = await sophosCentralApiRequestAllItems.call(
					this,
					'GET',
					'/firewall/v1/firewalls',
					{},
					{},
					tenant.id,
				);
			} else {
				const response = await sophosCentralApiRequest.call(
					this,
					'GET',
					'/firewall/v1/firewalls',
					{},
					{ page: 1, pageSize: Math.min(100, (limit || 50) - allFirewalls.length), pageTotal: false },
					tenant.id,
				);
				tenantFirewalls = ((response as IDataObject).items as IDataObject[]) || [];
			}

			// Add tenant info to each firewall
			for (const firewall of tenantFirewalls) {
				firewall.tenantId = tenant.id;
				firewall.tenant = {
					id: tenant.id,
					name: tenant.name,
					dataRegion: tenant.dataRegion,
				};
			}

			allFirewalls.push(...tenantFirewalls);
		} catch {
			// If a tenant fails (e.g., no firewall access), continue with other tenants
			continue;
		}
	}

	return allFirewalls;
}

declare const setTimeout: (handler: () => void, timeout: number) => unknown;

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
