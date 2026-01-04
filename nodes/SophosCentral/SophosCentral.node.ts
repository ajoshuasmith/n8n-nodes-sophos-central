import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import {
	getTenantList,
	resolveTenantId,
	sleep,
	sophosCentralApiRequest,
	sophosCentralApiRequestAllItems,
} from './GenericFunctions';

import { operationFields, resourceFields } from './descriptions';

import type { ISophosCentralCredentials } from './types';

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
		icon: 'file:images/sophos-central.svg',
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
						name: 'Firewall',
						value: 'firewall',
					},
					{
						name: 'Firmware',
						value: 'firmware',
					},
					{
						name: 'Backup',
						value: 'backup',
					},
					{
						name: 'Health',
						value: 'health',
					},
				],
				default: 'firewall',
			},
			...operationFields,
			...resourceFields,
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
				const page = paginationToken ? parseInt(paginationToken, 10) : 1;
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

				const tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);

				const page = paginationToken ? parseInt(paginationToken, 10) : 1;
				const response = await sophosCentralApiRequest.call(
					this,
					'GET',
					'/firewall/v1/firewalls',
					{},
					{ page, pageSize: 100, pageTotal: true },
					tenantId,
				);

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

				const tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);

				const check = (await sophosCentralApiRequest.call(
					this,
					'POST',
					'/firewall/v1/firewalls/actions/firmware-upgrade-check',
					{ firewalls: [firewallId] },
					{},
					tenantId,
				)) as FirmwareUpgradeCheckResponse;

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
				const page = paginationToken ? parseInt(paginationToken, 10) : 1;
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
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const tenantIdRaw = getResourceLocatorValue(
					this.getNodeParameter('tenantId', i) as unknown,
				);
				const tenantId = await resolveTenantId.call(this, tenantIdRaw || undefined);

				if (resource === 'firewall') {
					if (operation === 'get') {
						const firewallId = getResourceLocatorValue(
							this.getNodeParameter('firewallId', i) as unknown,
						);

						if (!firewallId) {
							throw new NodeOperationError(this.getNode(), 'Firewall is required');
						}

						const responseData = await sophosCentralApiRequest.call(
							this,
							'GET',
							`/firewall/v1/firewalls/${firewallId}`,
							{},
							{},
							tenantId,
						);

						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						type FirewallFilters = { name?: string; serial?: string; firmwareVersion?: string };

						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i, {}) as FirewallFilters;

						let responseItems: IDataObject[];
						if (returnAll) {
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
						firmwareVersion?: string;
						upgradeToVersion?: string[];
					};
					type FirmwareUpgradeCheckResponse = {
						firewalls?: FirmwareCheckFirewall[];
						firmwareVersions?: Array<{ version: string; size?: string }>;
					};

					const firewallId = getResourceLocatorValue(
						this.getNodeParameter('firewallId', i) as unknown,
					);

					if (!firewallId) {
						throw new NodeOperationError(this.getNode(), 'Firewall is required');
					}

					if (operation === 'getCurrent' || operation === 'getUpgradeStatus') {
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

					if (operation === 'upgrade') {
						type UpgradeAdditionalFields = {
							autoRevert?: boolean;
							pollingInterval?: number;
							timeout?: number;
						};
						type UpgradeInfo = { id: string; upgradeToVersion: string; upgradeAt?: string };

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

							upgradeInfo.upgradeAt = scheduledTime;
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

						const responseData = await sophosCentralApiRequest.call(
							this,
							'GET',
							`/firewall/v1/firewalls/${firewallId}`,
							{},
							{},
							tenantId,
						);

						returnData.push({ json: responseData, pairedItem: { item: i } });
					}

					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						let responseItems: IDataObject[];

						if (returnAll) {
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
