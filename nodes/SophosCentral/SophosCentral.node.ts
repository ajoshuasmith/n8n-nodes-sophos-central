import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	getAuthContext,
	getAllTenantsFirewalls,
	getTenantList,
	resolveTenantId,
	sleep,
	sophosCentralApiRequest,
	sophosCentralApiRequestAllItems,
	sophosCentralLicensingApiRequest,
	sophosCentralLicensingApiRequestAllItems,
} from './GenericFunctions';

import { operationFields, resourceFields } from './descriptions';

import type { ISophosCentralCredentials, ITenant } from './types';

interface IPagination {
	total?: number;
}

interface IListResponse<TItem> {
	items?: TItem[];
	pages?: IPagination;
}

function getResourceLocatorValue(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	if (value && typeof value === 'object' && 'value' in value) {
		const v = (value as { value?: unknown }).value;
		return v === undefined || v === null ? '' : String(v);
	}

	return '';
}

export class SophosCentral implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sophos Central',
		name: 'sophosCentral',
		icon: 'file:sophosCentral.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Sophos Central Firewall Management API',
		usableAsTool: true,
		defaults: {
			name: 'Sophos Central',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sophosCentralApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Alert',
						value: 'alert',
					},
					{
						name: 'Diagnostic',
						value: 'diagnostic',
						description: 'Validate account scope, tenant access, and API routing',
					},
					{
						name: 'Firewall',
						value: 'firewall',
					},
					{
						name: 'Firewall Group',
						value: 'firewallGroup',
					},
					{
						name: 'Firmware',
						value: 'firmware',
					},
					{
						name: 'Health',
						value: 'health',
					},
					{
						name: 'Licensing',
						value: 'licensing',
						description: 'Firewall licensing and subscription information',
					},
					{
						name: 'Organization',
						value: 'organization',
					},
					{
						name: 'Partner',
						value: 'partner',
						description: 'Partner billing, admins, and roles (Partner accounts only)',
					},
				],
				default: 'firewall',
			},
			...operationFields,
			...resourceFields,
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'connectionCheck',
				displayOptions: { show: { resource: ['diagnostic'] } },
				options: [{ name: 'Connection Check', value: 'connectionCheck', action: 'Run connection diagnostics' }],
			},
		],
	};

	methods = {
		listSearch: {
			tenantSearch: async function (
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const credentials = (await this.getCredentials(
					'sophosCentralApi',
				)) as unknown as ISophosCentralCredentials;

				if (credentials.accountType !== 'partner') {
					return { results: [] };
				}

				const tenants = await getTenantList.call(this, credentials);
				const normalizedFilter = filter?.toLowerCase();

				const filtered = normalizedFilter
					? tenants.filter(
							(t) =>
								t.name.toLowerCase().includes(normalizedFilter) ||
								t.id.toLowerCase().includes(normalizedFilter),
						)
					: tenants;

				const pageSize = 100;
				// Validate pagination token with safe fallback
				const page = paginationToken ? Math.max(1, parseInt(paginationToken, 10) || 1) : 1;
				const start = (page - 1) * pageSize;
				const end = start + pageSize;
				const pageItems = filtered.slice(start, end);
				const nextToken = end < filtered.length ? String(page + 1) : undefined;

				return {
					results: pageItems.map((tenant) => ({
						name: tenant.name,
						value: tenant.id,
						description: tenant.dataRegion ? `Region: ${tenant.dataRegion}` : undefined,
					})),
					paginationToken: nextToken,
				};
			},

			firewallSearch: async function (
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				type FirewallListItem = {
					id: string;
					name?: string;
					hostname?: string;
					serialNumber?: string;
					firmwareVersion?: string;
				};

				const tenantIdRaw = getResourceLocatorValue(
					this.getNodeParameter('tenantId', 0) as unknown,
				);

				const credentials = (await this.getCredentials(
					'sophosCentralApi',
				)) as unknown as ISophosCentralCredentials;

				if (credentials.accountType === 'partner' && !tenantIdRaw) {
					return { results: [] };
				}

				let tenantId: string;
				try {
					tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);
				} catch {
					// If tenant resolution fails, return empty results
					return { results: [] };
				}

				// Validate pagination token with safe fallback
				const page = paginationToken ? Math.max(1, parseInt(paginationToken, 10) || 1) : 1;
				let response: IDataObject;
				try {
					response = await sophosCentralApiRequest.call(
						this,
						'GET',
						'/firewall/v1/firewalls',
						{},
						{ page, pageSize: 100, pageTotal: true },
						tenantId,
					);
					} catch {
						// If the API call fails (e.g., tenant doesn't have firewall access),
					// return empty results so user can still manually enter a firewall ID
					return { results: [] };
				}

				const responseData = response as IListResponse<FirewallListItem>;
				const items = responseData.items || [];
				const normalizedFilter = filter?.toLowerCase();

				const filtered = normalizedFilter
					? items.filter((f) => {
							const name = String(f.name || '').toLowerCase();
							const serial = String(f.serialNumber || '').toLowerCase();
							const hostname = String(f.hostname || '').toLowerCase();
							return (
								name.includes(normalizedFilter) ||
								serial.includes(normalizedFilter) ||
								hostname.includes(normalizedFilter)
							);
						})
					: items;

				const totalPages =
					typeof responseData.pages?.total === 'number' ? responseData.pages.total : page;
				const nextToken = page < totalPages ? String(page + 1) : undefined;

				return {
					results: filtered.map((firewall) => ({
						name: `${firewall.name || firewall.hostname || firewall.id} (${firewall.serialNumber || 'n/a'})`,
						value: firewall.id,
						description: firewall.firmwareVersion
							? `Firmware: ${firewall.firmwareVersion}`
							: undefined,
					})),
					paginationToken: nextToken,
				};
			},

			firmwareVersionSearch: async function (
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				type UpgradeCheckFirewall = { upgradeToVersion?: string[] };
				type FirmwareVersionItem = { version: string; size?: string };
				type FirmwareUpgradeCheckResponse = {
					firewalls?: UpgradeCheckFirewall[];
					firmwareVersions?: FirmwareVersionItem[];
				};

				const tenantIdRaw = getResourceLocatorValue(
					this.getNodeParameter('tenantId', 0) as unknown,
				);

				const firewallId = getResourceLocatorValue(
					this.getNodeParameter('firewallId', 0) as unknown,
				);

				if (!firewallId) {
					return { results: [] };
				}

				const credentials = (await this.getCredentials(
					'sophosCentralApi',
				)) as unknown as ISophosCentralCredentials;

				if (credentials.accountType === 'partner' && !tenantIdRaw) {
					return { results: [] };
				}

				let tenantId: string;
				try {
					tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);
				} catch {
					return { results: [] };
				}

				let check: FirmwareUpgradeCheckResponse;
				try {
					check = (await sophosCentralApiRequest.call(
						this,
						'POST',
						'/firewall/v1/firewalls/actions/firmware-upgrade-check',
						{ firewalls: [firewallId] },
						{},
						tenantId,
					)) as FirmwareUpgradeCheckResponse;
				} catch {
					// If API call fails, return empty results so user can manually enter version
					return { results: [] };
				}

				const firewall = Array.isArray(check.firewalls) ? check.firewalls[0] : undefined;
				const allowed = new Set<string>(
					Array.isArray(firewall?.upgradeToVersion) ? firewall.upgradeToVersion : [],
				);
				const versions = Array.isArray(check.firmwareVersions) ? check.firmwareVersions : [];

				const normalizedFilter = filter?.toLowerCase();
				const filtered = versions
					.filter((v) => (!allowed.size ? true : allowed.has(v.version)))
					.filter((v) =>
						normalizedFilter ? v.version.toLowerCase().includes(normalizedFilter) : true,
					);

				const pageSize = 100;
				// Validate pagination token with safe fallback
				const page = paginationToken ? Math.max(1, parseInt(paginationToken, 10) || 1) : 1;
				const start = (page - 1) * pageSize;
				const end = start + pageSize;
				const pageItems = filtered.slice(start, end);
				const nextToken = end < filtered.length ? String(page + 1) : undefined;

				return {
					results: pageItems.map((v) => ({
						name: v.version,
						value: v.version,
						description: v.size ? `Size: ${v.size}` : undefined,
					})),
					paginationToken: nextToken,
				};
			},

			alertSearch: async function (
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const tenantIdRaw = getResourceLocatorValue(
					this.getNodeParameter('tenantId', 0) as unknown,
				);

				let tenantId: string;
				try {
					tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);
				} catch {
					return { results: [] };
				}

				// Validate pagination token with safe fallback
				const page = paginationToken ? Math.max(1, parseInt(paginationToken, 10) || 1) : 1;
				let response: IDataObject;
				try {
					const qs: IDataObject = { page, pageSize: 100, pageTotal: true };
					qs.sort = 'createdAt:desc';

					response = await sophosCentralApiRequest.call(
						this,
						'GET',
						'/common/v1/alerts',
						{},
						qs,
						tenantId,
					);
				} catch {
					return { results: [] };
				}

				const responseData = response as IListResponse<IDataObject>;
				const items = responseData.items || [];
				const normalizedFilter = filter?.toLowerCase();

				const filtered = normalizedFilter
					? items.filter(
							(a) =>
								String(a.description || '')
									.toLowerCase()
									.includes(normalizedFilter) ||
								String(a.type || '')
									.toLowerCase()
									.includes(normalizedFilter),
						)
					: items;

				const totalPages =
					typeof responseData.pages?.total === 'number' ? responseData.pages.total : page;
				const nextToken = page < totalPages ? String(page + 1) : undefined;

				return {
					results: filtered.map((alert) => {
						const actions = Array.isArray(alert.allowedActions) ? alert.allowedActions : [];
						const actionTag = actions.length > 0 ? '[Actionable]' : '[Info Only]';
						const baseName =
							(alert.description as string) || (alert.type as string) || (alert.id as string);
						return {
							name: `${actionTag} ${baseName}`,
							value: alert.id as string,
							description: alert.severity
								? `Severity: ${alert.severity} | Actions: ${actions.join(', ') || 'None'}`
								: undefined,
						};
					}),
					paginationToken: nextToken,
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				// Organization, Partner, and Licensing resources don't use tenant context parameter
				const tenantIdRaw =
					resource === 'organization' || resource === 'partner' || resource === 'licensing'
						? undefined
						: getResourceLocatorValue(this.getNodeParameter('tenantId', i) as unknown);

				let tenantId: string | undefined;
				if (resource !== 'organization' && resource !== 'partner' && resource !== 'licensing') {
					try {
						tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);
					} catch {
						// Fallthrough: tenantId remains undefined for "All Tenants" mode (Partner)
						// Individual operations will validate if they strictly require a tenantId
					}
				}

				if (resource === 'diagnostic') {
					const credentials = (await this.getCredentials('sophosCentralApi')) as unknown as ISophosCentralCredentials;
					const ctx = await getAuthContext.call(this, credentials);
					const tenants = credentials.accountType === 'partner' ? await getTenantList.call(this, credentials) : [];
					const regions = [...new Set(tenants.map((tenant) => tenant.dataRegion))];
					returnData.push({ json: { accountType: credentials.accountType, sophosIdType: ctx.idType, partnerId: ctx.partnerId, apiHost: ctx.dataRegion, tenantCount: tenants.length, regions, licensingMode: credentials.accountType === 'partner' ? 'tenant-scoped fallback' : 'tenant-scoped' }, pairedItem: { item: i } });
				}

				if (resource === 'firewall') {
					if (operation === 'get') {
						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);

						if (!firewallId) {
							throw new NodeOperationError(this.getNode(), 'Firewall is required');
						}

						/*
						 * Workaround for Partner API 404s:
						 * Direct GET /firewalls/{id} often fails with 404 for Partner credentials
						 * even when the firewall exists. We use the list endpoint with local filtering instead.
						 */
						const allFirewalls = await sophosCentralApiRequestAllItems.call(
							this,
							'GET',
							'/firewall/v1/firewalls',
							{},
							{}, // No filters supported by API directly, so we fetch all and find
							tenantId,
						);

						const firewall = allFirewalls.find((f: IDataObject) => f.id === firewallId);

						if (!firewall) {
							throw new NodeApiError(
								this.getNode(),
								{ message: 'Firewall not found in tenant' },
								{ httpCode: '404' },
							);
						}

						returnData.push({ json: firewall, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						type FirewallFilters = { name?: string; serial?: string; firmwareVersion?: string };

						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i, {}) as FirewallFilters;

						let responseItems: IDataObject[];

						// Check if we should fetch from all tenants
						if (!tenantId) {
							const credentials = (await this.getCredentials(
								'sophosCentralApi',
							)) as unknown as ISophosCentralCredentials;

							if (credentials.accountType !== 'partner') {
								throw new NodeOperationError(
									this.getNode(),
									'Fetching firewalls from all tenants is only available for Partner accounts.',
								);
							}

							const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
							responseItems = await getAllTenantsFirewalls.call(
								this,
								credentials,
								returnAll,
								limit,
							);
						} else if (returnAll) {
							responseItems = await sophosCentralApiRequestAllItems.call(
								this,
								'GET',
								'/firewall/v1/firewalls',
								{},
								{},
								tenantId,
							);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = await sophosCentralApiRequest.call(
								this,
								'GET',
								'/firewall/v1/firewalls',
								{},
								{ page: 1, pageSize: limit, pageTotal: false },
								tenantId,
							);
							responseItems = (response as IListResponse<IDataObject>).items || [];
						}

						if (filters.name) {
							const nf = String(filters.name).toLowerCase();
							responseItems = responseItems.filter((f) =>
								String(f.name || '')
									.toLowerCase()
									.includes(nf),
							);
						}
						if (filters.serial) {
							const sf = String(filters.serial).toLowerCase();
							responseItems = responseItems.filter((f) =>
								String((f as IDataObject).serialNumber || '')
									.toLowerCase()
									.includes(sf),
							);
						}
						if (filters.firmwareVersion) {
							responseItems = responseItems.filter(
								(f) =>
									String((f as IDataObject).firmwareVersion || '') ===
									String(filters.firmwareVersion),
							);
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}
				}

				if (resource === 'firmware') {
					type FirmwareCheckFirewall = {
						id?: string;
						firmwareVersion?: string;
						upgradeToVersion?: string[];
					};
					type FirmwareUpgradeCheckResponse = {
						firewalls?: FirmwareCheckFirewall[];
						firmwareVersions?: Array<{ version: string; size?: string }>;
					};

					if (operation === 'getCurrent' || operation === 'getUpgradeStatus') {
						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);

						// Single firewall mode (existing logic)
						if (firewallId) {
							if (!tenantId) {
								throw new NodeOperationError(
									this.getNode(),
									'Tenant ID is required when checking a specific firewall.',
								);
							}
							const responseData = await sophosCentralApiRequest.call(
								this,
								'POST',
								'/firewall/v1/firewalls/actions/firmware-upgrade-check',
								{ firewalls: [firewallId] },
								{},
								tenantId,
							);
							returnData.push({ json: responseData, pairedItem: { item: i } });
						}
						// Multi-tenant / All firewalls mode
						else {
							const credentials = (await this.getCredentials(
								'sophosCentralApi',
							)) as unknown as ISophosCentralCredentials;

							if (credentials.accountType !== 'partner' && !tenantId) {
								throw new NodeOperationError(
									this.getNode(),
									'Tenant ID is required for Organization accounts.',
								);
							}

							let firewallsToCheck: IDataObject[] = [];

							if (tenantId) {
								// Get all firewalls for specific tenant
								firewallsToCheck = await sophosCentralApiRequestAllItems.call(
									this,
									'GET',
									'/firewall/v1/firewalls',
									{},
									{},
									tenantId,
								);
								// Add tenantId to each for the next step
								firewallsToCheck.forEach((f) => (f.tenantId = tenantId));
							} else {
								// Get all firewalls for all tenants
								firewallsToCheck = await getAllTenantsFirewalls.call(this, credentials, true);
								// getAllTenantsFirewalls adds .tenant object, we need flattened tenantId for next step
								firewallsToCheck.forEach((f) => (f.tenantId = (f.tenant as ITenant).id));
							}

							// Group by tenant because the check endpoint is per-tenant
							const firewallsByTenant: { [key: string]: string[] } = {};
							for (const fw of firewallsToCheck) {
								const tid = fw.tenantId as string;
								if (!firewallsByTenant[tid]) firewallsByTenant[tid] = [];
								firewallsByTenant[tid].push(fw.id as string);
							}

							// Check upgrades for each tenant's firewalls
							for (const [tid, fwIds] of Object.entries(firewallsByTenant)) {
								// Batch in groups of 100 (API limit)
								for (let j = 0; j < fwIds.length; j += 100) {
									const batch = fwIds.slice(j, j + 100);
									try {
										const response = await sophosCentralApiRequest.call(
											this,
											'POST',
											'/firewall/v1/firewalls/actions/firmware-upgrade-check',
											{ firewalls: batch },
											{},
											tid,
										);

										// Process results to add tenant info back
										const results = (response as FirmwareUpgradeCheckResponse).firewalls || [];
										for (const result of results) {
											// Match result to original firewall to get name/hostname if needed
											const original = firewallsToCheck.find((f) => f.id === result.id); // API returns ID in result
											const combined = {
												...result,
												tenantId: tid,
												firewallName: original?.name,
												firewallHostname: original?.hostname,
											};
											returnData.push({ json: combined as IDataObject, pairedItem: { item: i } });
										}
									} catch {
										// Continue if one tenant fails
										continue;
									}
								}
							}
						}
					}

					if (operation === 'upgrade') {
						type UpgradeAdditionalFields = {
							autoRevert?: boolean;
							pollingInterval?: number;
							timeout?: number;
						};
						type UpgradeInfo = { id: string; upgradeToVersion: string; upgradeAt?: string };

						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);

						const targetVersion = getResourceLocatorValue(
							this.getNodeParameter('targetVersion', i) as unknown,
						);

						if (!targetVersion) {
							throw new NodeOperationError(this.getNode(), 'Target version is required');
						}

						const scheduleType = this.getNodeParameter('scheduleType', i) as string;
						const createBackup = this.getNodeParameter('createBackup', i) as boolean;
						const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;
						const additionalFields = this.getNodeParameter(
							'additionalFields',
							i,
							{},
						) as UpgradeAdditionalFields;

						if (createBackup) {
							throw new NodeOperationError(
								this.getNode(),
								'Sophos Central Firewall API v1 does not currently expose backup endpoints. Disable "Create Backup Before Upgrade" to proceed.',
							);
						}

						const upgradeInfo: UpgradeInfo = {
							id: firewallId,
							upgradeToVersion: targetVersion,
						};

						if (scheduleType === 'scheduled') {
							const scheduledTime = this.getNodeParameter('scheduledTime', i) as string;

							if (!scheduledTime) {
								throw new NodeOperationError(this.getNode(), 'Scheduled time is required');
							}

							// Transform to ISO 8601 format required by Sophos API
							const date = new Date(scheduledTime);
							if (isNaN(date.getTime())) {
								throw new NodeOperationError(this.getNode(), 'Invalid scheduled time format');
							}
							upgradeInfo.upgradeAt = date.toISOString();
						}

						const upgradeResponse = await sophosCentralApiRequest.call(
							this,
							'POST',
							'/firewall/v1/firewalls/actions/firmware-upgrade',
							{ firewalls: [upgradeInfo] },
							{},
							tenantId,
						);

						if (!waitForCompletion) {
							returnData.push({
								json: {
									...upgradeResponse,
									requestedOptions: {
										autoRevert: additionalFields.autoRevert,
									},
								},
								pairedItem: { item: i },
							});
						} else {
							const pollingIntervalMs =
								(typeof additionalFields.pollingInterval === 'number'
									? additionalFields.pollingInterval
									: 30) * 1000;
							const timeoutMs =
								(typeof additionalFields.timeout === 'number' ? additionalFields.timeout : 1800) *
								1000;

							const startTime = Date.now();
							let lastCheck: FirmwareUpgradeCheckResponse | undefined;

							while (true) {
								if (Date.now() - startTime > timeoutMs) {
									throw new NodeOperationError(this.getNode(), 'Upgrade timeout exceeded');
								}

								await sleep(pollingIntervalMs);

								lastCheck = (await sophosCentralApiRequest.call(
									this,
									'POST',
									'/firewall/v1/firewalls/actions/firmware-upgrade-check',
									{ firewalls: [firewallId] },
									{},
									tenantId,
								)) as FirmwareUpgradeCheckResponse;

								const fw = Array.isArray(lastCheck.firewalls) ? lastCheck.firewalls[0] : undefined;
								const current = fw?.firmwareVersion;

								if (current) {
									this.sendMessageToUI(`Firmware version: ${current}`);
								}

								if (current && String(current) === String(targetVersion)) {
									break;
								}
							}

							returnData.push({
								json: {
									upgradeResponse,
									finalCheck: lastCheck,
									requestedOptions: {
										autoRevert: additionalFields.autoRevert,
									},
								},
								pairedItem: { item: i },
							});
						}
					}

					if (operation === 'cancelUpgrade') {
						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);
						const responseData = await sophosCentralApiRequest.call(
							this,
							'DELETE',
							'/firewall/v1/firewalls/actions/firmware-upgrade',
							{},
							{ ids: firewallId },
							tenantId,
						);

						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getUpgradeHistory') {
						throw new NodeOperationError(
							this.getNode(),
							'Sophos Central Firewall API v1 does not provide a firmware upgrade history endpoint.',
						);
					}
				}

				if (resource === 'backup') {
					throw new NodeOperationError(
						this.getNode(),
						'Sophos Central Firewall API v1 does not currently expose backup endpoints. Use Sophos Firewall local API via Central Orchestration if backups are required.',
					);
				}

				if (resource === 'health') {
					if (operation === 'get') {
						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);

						if (!firewallId) {
							throw new NodeOperationError(this.getNode(), 'Firewall is required');
						}

						/*
						 * Workaround for Partner API 404s:
						 * Direct GET /firewalls/{id} often fails with 404 for Partner credentials.
						 * We use the list endpoint with local filtering instead.
						 */
						const allFirewalls = await sophosCentralApiRequestAllItems.call(
							this,
							'GET',
							'/firewall/v1/firewalls',
							{},
							{},
							tenantId,
						);

						const firewall = allFirewalls.find((f: IDataObject) => f.id === firewallId);

						if (!firewall) {
							throw new NodeApiError(
								this.getNode(),
								{ message: 'Firewall not found in tenant' },
								{ httpCode: '404' },
							);
						}

						returnData.push({ json: firewall, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						// Check if we should fetch from all tenants
						if (!tenantId) {
							const credentials = (await this.getCredentials(
								'sophosCentralApi',
							)) as unknown as ISophosCentralCredentials;

							if (credentials.accountType !== 'partner') {
								throw new NodeOperationError(
									this.getNode(),
									'Fetching health from all tenants is only available for Partner accounts.',
								);
							}

							const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
							responseItems = await getAllTenantsFirewalls.call(
								this,
								credentials,
								returnAll,
								limit,
							);
						} else if (returnAll) {
							responseItems = await sophosCentralApiRequestAllItems.call(
								this,
								'GET',
								'/firewall/v1/firewalls',
								{},
								{},
								tenantId,
							);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = await sophosCentralApiRequest.call(
								this,
								'GET',
								'/firewall/v1/firewalls',
								{},
								{ page: 1, pageSize: limit, pageTotal: false },
								tenantId,
							);
							responseItems = (response as IListResponse<IDataObject>).items || [];
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}
				}

				if (resource === 'firewallGroup') {
					if (operation === 'get') {
						const groupId = getResourceLocatorValue(
							this.getNodeParameter('firewallGroupId', i) as unknown,
						);
						const groups = await sophosCentralApiRequestAllItems.call(
							this,
							'GET',
							'/firewall/v1/firewall-groups',
							{},
							{},
							tenantId,
						);
						const group = groups.find((item) => item.id === groupId);

						if (!group) {
							throw new NodeApiError(
								this.getNode(),
								{ message: 'Firewall group not found in tenant' },
								{ httpCode: '404' },
							);
						}

						returnData.push({ json: group, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						if (returnAll) {
							responseItems = await sophosCentralApiRequestAllItems.call(
								this,
								'GET',
								'/firewall/v1/firewall-groups',
								{},
								{},
								tenantId,
							);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = await sophosCentralApiRequest.call(
								this,
								'GET',
								'/firewall/v1/firewall-groups',
								{},
								{ page: 1, pageSize: limit, pageTotal: false },
								tenantId,
							);
							responseItems = (response as IListResponse<IDataObject>).items || [];
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}

					if (operation === 'getSyncStatus') {
						const groupId = getResourceLocatorValue(
							this.getNodeParameter('firewallGroupId', i) as unknown,
						);
						// Endpoint: /firewall-groups/{groupId}/firewalls/sync-status
						// Note: This often returns 202 Accepted + Location header for async status,
						// but simpler method gets immediate list if available.
						// Checking documentation: The sync-status endpoint is synchronous for list.
						const responseData = await sophosCentralApiRequest.call(
							this,
							'GET',
							`/firewall/v1/firewall-groups/${groupId}/firewalls/sync-status`,
							{},
							{},
							tenantId,
						);

						// The response items are firewalls with their sync status
						const items = (responseData.items as IDataObject[]) || [];
						for (const item of items) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}
				}

				if (resource === 'alert') {
					// Common API (Alerts)
					const baseUrl = '/common/v1/alerts';

					if (operation === 'get') {
						const alertId = this.getNodeParameter('alertId', i) as string;
						const responseData = await sophosCentralApiRequest.call(
							this,
							'GET',
							`${baseUrl}/${alertId}`,
							{},
							{},
							tenantId,
						);
						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i, {}) as {
							onlyActionable?: boolean;
							severity?: string[];
							product?: string;
							from?: string;
						};

						const qs: IDataObject = {};
						// Sophos API expects severity as comma-separated string (e.g., "high,medium")
						if (filters.severity && filters.severity.length > 0) {
							qs.severity = filters.severity.join(',');
						}
						if (filters.product) qs.product = filters.product;
						if (filters.from) qs.from = filters.from;

						let responseItems: IDataObject[];

						if (returnAll) {
							responseItems = await sophosCentralApiRequestAllItems.call(
								this,
								'GET',
								baseUrl,
								{},
								qs,
								tenantId,
							);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							qs.page = 1;
							qs.pageSize = limit;
							qs.pageTotal = false;

							const response = await sophosCentralApiRequest.call(
								this,
								'GET',
								baseUrl,
								{},
								qs,
								tenantId,
							);
							responseItems = (response as IListResponse<IDataObject>).items || [];
						}

						// Apply onlyActionable filter and add computed fields
						let filteredItems = responseItems;
						if (filters.onlyActionable) {
							filteredItems = responseItems.filter((alert) => {
								const actions = Array.isArray(alert.allowedActions) ? alert.allowedActions : [];
								return actions.length > 0;
							});
						}

						// Add computed fields to each alert
						for (const item of filteredItems) {
							const actions = Array.isArray(item.allowedActions) ? item.allowedActions : [];
							const enrichedItem = {
								...item,
								isActionable: actions.length > 0,
								actionCount: actions.length,
								hasBeenActioned: actions.length === 0,
							};
							returnData.push({ json: enrichedItem, pairedItem: { item: i } });
						}
					}

					if (operation === 'performAction') {
						const alertIdsRaw = getResourceLocatorValue(
							this.getNodeParameter('alertId', i) as unknown,
						);
						const action = this.getNodeParameter('action', i) as string;

						// Support comma-separated IDs for batch operations
						const alertIds = alertIdsRaw
							.split(',')
							.map((id) => id.trim())
							.filter((id) => id);

						for (const alertId of alertIds) {
							const responseData = await sophosCentralApiRequest.call(
								this,
								'POST',
								`${baseUrl}/${alertId}/actions`,
								{ action },
								{},
								tenantId,
							);
							returnData.push({ json: responseData, pairedItem: { item: i } });
						}
					}
				}

				if (resource === 'licensing') {
					const credentials = (await this.getCredentials(
						'sophosCentralApi',
					)) as unknown as ISophosCentralCredentials;

					const returnAll = this.getNodeParameter('returnAll', i) as boolean;

					if (operation === 'getFirewallLicense') {
						const serialNumber = this.getNodeParameter('serialNumber', i) as string;
						let found: IDataObject | undefined;
						const tenantIds =
							credentials.accountType === 'partner'
								? (await getTenantList.call(this, credentials)).map((tenant) => tenant.id)
								: [undefined];

						for (const tenantId of tenantIds) {
							const items = await sophosCentralLicensingApiRequestAllItems.call(
								this,
								'/licenses/firewalls',
								tenantId,
							);
							found = items.find((fw) => (fw.serialNumber as string) === serialNumber);
							if (found) break;
						}

						if (found) {
							returnData.push({ json: found, pairedItem: { item: i } });
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`No firewall found with serial number '${serialNumber}'`,
							);
						}
					}

					if (operation === 'getFirewallLicenses') {
						const tenantIds =
							credentials.accountType === 'partner'
								? (await getTenantList.call(this, credentials)).map((tenant) => tenant.id)
								: [undefined];

						if (returnAll) {
							for (const tenantId of tenantIds) {
								const items = await sophosCentralLicensingApiRequestAllItems.call(
									this,
									'/licenses/firewalls',
									tenantId,
								);
								for (const item of items) {
									returnData.push({ json: item, pairedItem: { item: i } });
								}
							}
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							let returned = 0;
							for (const tenantId of tenantIds) {
								if (returned >= limit) break;
								const response = await sophosCentralLicensingApiRequest.call(
									this,
									'/licenses/firewalls',
									{ page: 1, pageSize: Math.min(100, limit - returned), pageTotal: false },
									tenantId,
								);
								const items = (response.items as IDataObject[]) || [];
								for (const item of items) {
									returnData.push({ json: item, pairedItem: { item: i } });
									returned += 1;
								}
							}
						}
					}

					if (operation === 'getAllLicenses') {
						const tenantIds =
							credentials.accountType === 'partner'
								? (await getTenantList.call(this, credentials)).map((tenant) => tenant.id)
								: [credentials.tenantId];
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
						let returned = 0;

						for (const tenantId of tenantIds) {
							if (!tenantId || (limit !== undefined && returned >= limit)) break;
							const response = await sophosCentralLicensingApiRequest.call(
								this,
								'/licenses',
								{},
								tenantId,
							);
							const licenses = (response.licenses as IDataObject[]) || [];

							for (const license of licenses) {
								if (limit !== undefined && returned >= limit) break;
								returnData.push({
									json: { ...license, tenant: response.tenant },
									pairedItem: { item: i },
								});
								returned += 1;
							}
						}
					}
				}

				if (resource === 'organization') {
					// Get auth context for Partner API
					const credentials = (await this.getCredentials(
						'sophosCentralApi',
					)) as unknown as ISophosCentralCredentials;
					const ctx = await getAuthContext.call(this, credentials);

					if (operation === 'create') {
						const name = this.getNodeParameter('name', i) as string;
						const dataGeography = this.getNodeParameter('dataGeography', i) as string;
						const billingType = this.getNodeParameter('billingType', i) as string;
						const contactFirstName = this.getNodeParameter('contactFirstName', i) as string;
						const contactLastName = this.getNodeParameter('contactLastName', i) as string;
						const contactEmail = this.getNodeParameter('contactEmail', i) as string;
						const contactPhone = this.getNodeParameter('contactPhone', i) as string;
						const addressLine1 = this.getNodeParameter('addressLine1', i) as string;
						const city = this.getNodeParameter('city', i) as string;
						const countryCode = this.getNodeParameter('countryCode', i) as string;
						const postalCode = this.getNodeParameter('postalCode', i) as string;
						const additionalFields = this.getNodeParameter(
							'additionalFields',
							i,
							{},
						) as IDataObject;

						const body: IDataObject = {
							name,
							dataGeography,
							billingType,
							contact: {
								firstName: contactFirstName,
								lastName: contactLastName,
								email: contactEmail,
								phone: contactPhone,
								address: {
									address1: addressLine1,
									city,
									countryCode,
									postalCode,
								},
							},
						};

						if (additionalFields.showAs) body.showAs = additionalFields.showAs;
						if (additionalFields.addressLine2) {
							const contact = body.contact as IDataObject;
							const address = contact.address as IDataObject;
							contact.address = { ...address, address2: additionalFields.addressLine2 };
						}
						if (additionalFields.state) {
							const contact = body.contact as IDataObject;
							const address = contact.address as IDataObject;
							contact.address = { ...address, state: additionalFields.state };
						}

						const responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: 'https://api.central.sophos.com/partner/v1/tenants',
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
								'Content-Type': 'application/json',
							},
							body,
							json: true,
						});
						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'get') {
						const orgTenantId = this.getNodeParameter('tenantId', i) as string;
						const responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `https://api.central.sophos.com/partner/v1/tenants/${orgTenantId}`,
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
							},
							json: true,
						});
						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						if (returnAll) {
							responseItems = [];
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
									qs: { page, pageSize, pageTotal: true },
									json: true,
								})) as IDataObject;

								const items = (response.items as IDataObject[]) || [];
								responseItems.push(...items);

								const pages = response.pages as IDataObject | undefined;
								totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
								page += 1;
							} while (page <= totalPages);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = (await this.helpers.httpRequest({
								method: 'GET',
								url: 'https://api.central.sophos.com/partner/v1/tenants',
								headers: {
									Authorization: `Bearer ${ctx.token}`,
									'X-Partner-ID': ctx.partnerId as string,
								},
								qs: { page: 1, pageSize: limit, pageTotal: false },
								json: true,
							})) as IDataObject;
							responseItems = (response.items as IDataObject[]) || [];
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}
				}

				if (resource === 'partner') {
					// Get auth context for Partner API
					const credentials = (await this.getCredentials(
						'sophosCentralApi',
					)) as unknown as ISophosCentralCredentials;
					const ctx = await getAuthContext.call(this, credentials);

					if (operation === 'getBillingUsage') {
						const year = this.getNodeParameter('year', i) as number;
						const month = this.getNodeParameter('month', i) as number;
						const billingFilters = this.getNodeParameter('billingFilters', i, {}) as IDataObject;

						const qs: IDataObject = {};
						if (billingFilters.tenantId) {
							qs.tenantId = billingFilters.tenantId;
						}

						try {
							const responseData = await this.helpers.httpRequest({ method: 'GET', url: `https://api.central.sophos.com/partner/v1/billing/usage/${year}/${month}`, headers: { Authorization: `Bearer ${ctx.token}`, 'X-Partner-ID': ctx.partnerId as string }, qs, json: true });
							returnData.push({ json: responseData, pairedItem: { item: i } });
						} catch (error) {
							const status = (error as { statusCode?: number; response?: { status?: number } }).statusCode || (error as { response?: { status?: number } }).response?.status;
							if (status !== 404) throw error;
							returnData.push({ json: { items: [], empty: true, message: `Sophos has no billing data for ${year}-${String(month).padStart(2, '0')}` }, pairedItem: { item: i } });
						}
					}

					if (operation === 'getAllAdmins') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						if (returnAll) {
							responseItems = [];
							let page = 1;
							const pageSize = 100;
							let totalPages = 1;

							do {
								const response = (await this.helpers.httpRequest({
									method: 'GET',
									url: 'https://api.central.sophos.com/partner/v1/admins',
									headers: {
										Authorization: `Bearer ${ctx.token}`,
										'X-Partner-ID': ctx.partnerId as string,
									},
									qs: { page, pageSize, pageTotal: true },
									json: true,
								})) as IDataObject;

								const items = (response.items as IDataObject[]) || [];
								responseItems.push(...items);

								const pages = response.pages as IDataObject | undefined;
								totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
								page += 1;
							} while (page <= totalPages);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = (await this.helpers.httpRequest({
								method: 'GET',
								url: 'https://api.central.sophos.com/partner/v1/admins',
								headers: {
									Authorization: `Bearer ${ctx.token}`,
									'X-Partner-ID': ctx.partnerId as string,
								},
								qs: { page: 1, pageSize: limit, pageTotal: false },
								json: true,
							})) as IDataObject;
							responseItems = (response.items as IDataObject[]) || [];
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}

					if (operation === 'getAllRoles') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						if (returnAll) {
							responseItems = [];
							let page = 1;
							const pageSize = 100;
							let totalPages = 1;

							do {
								const response = (await this.helpers.httpRequest({
									method: 'GET',
									url: 'https://api.central.sophos.com/partner/v1/roles',
									headers: {
										Authorization: `Bearer ${ctx.token}`,
										'X-Partner-ID': ctx.partnerId as string,
									},
									qs: { page, pageSize, pageTotal: true },
									json: true,
								})) as IDataObject;

								const items = (response.items as IDataObject[]) || [];
								responseItems.push(...items);

								const pages = response.pages as IDataObject | undefined;
								totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
								page += 1;
							} while (page <= totalPages);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = (await this.helpers.httpRequest({
								method: 'GET',
								url: 'https://api.central.sophos.com/partner/v1/roles',
								headers: {
									Authorization: `Bearer ${ctx.token}`,
									'X-Partner-ID': ctx.partnerId as string,
								},
								qs: { page: 1, pageSize: limit, pageTotal: false },
								json: true,
							})) as IDataObject;
							responseItems = (response.items as IDataObject[]) || [];
						}

						for (const item of responseItems) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}

					if (operation === 'getAdmin') {
						const adminId = this.getNodeParameter('adminId', i) as string;
						const responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `https://api.central.sophos.com/partner/v1/admins/${adminId}`,
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
							},
							json: true,
						});
						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'createAdmin') {
						const email = this.getNodeParameter('email', i) as string;
						const firstName = this.getNodeParameter('firstName', i) as string;
						const lastName = this.getNodeParameter('lastName', i) as string;
						const roleId = this.getNodeParameter('roleId', i) as string;
						const adminOptions = this.getNodeParameter('adminOptions', i, {}) as IDataObject;

						const roleAssignment: IDataObject = {
							roleId,
							target: { type: 'partner' },
						};

						// If tenant IDs specified, scope to those tenants
						if (adminOptions.tenantIds) {
							const tenantIds = (adminOptions.tenantIds as string)
								.split(',')
								.map((id) => id.trim());
							roleAssignment.target = {
								type: 'tenants',
								ids: tenantIds,
							};
						}

						const body: IDataObject = {
							username: email,
							profile: {
								fullName: `${firstName} ${lastName}`,
								firstName,
								lastName,
							},
							roleAssignments: [roleAssignment],
						};

						const responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: 'https://api.central.sophos.com/partner/v1/admins',
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
								'Content-Type': 'application/json',
							},
							body,
							json: true,
						});
						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getRoleAssignments') {
						const adminId = this.getNodeParameter('adminId', i) as string;
						const responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `https://api.central.sophos.com/partner/v1/admins/${adminId}/role-assignments`,
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
							},
							json: true,
						});

						// Return items array if present
						const items = ((responseData as IDataObject).items as IDataObject[]) || [responseData];
						for (const item of items) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					}

					if (operation === 'deleteRoleAssignment') {
						const adminId = this.getNodeParameter('adminId', i) as string;
						const assignmentId = this.getNodeParameter('assignmentId', i) as string;

						await this.helpers.httpRequest({
							method: 'DELETE',
							url: `https://api.central.sophos.com/partner/v1/admins/${adminId}/role-assignments/${assignmentId}`,
							headers: {
								Authorization: `Bearer ${ctx.token}`,
								'X-Partner-ID': ctx.partnerId as string,
							},
							json: true,
						});
						returnData.push({
							json: { success: true, deleted: assignmentId },
							pairedItem: { item: i },
						});
					}
				}
							} catch (error) {
					if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
