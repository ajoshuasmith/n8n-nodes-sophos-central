import type { INodeProperties } from 'n8n-workflow';

export const firmwareOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['firmware'],
			},
		},
		options: [
			{
				name: 'Cancel Upgrade',
				value: 'cancelUpgrade',
				description: 'Cancel a scheduled firmware upgrade',
				action: 'Cancel firmware upgrade',
			},
			{
				name: 'Check Upgrades',
				value: 'getCurrent',
				description: 'Check firmware version and available upgrades for a firewall',
				action: 'Check firmware upgrades',
			},
			{
				name: 'Upgrade',
				value: 'upgrade',
				description: 'Trigger a firmware upgrade for a firewall',
				action: 'Upgrade firmware',
			},
		],
		default: 'getCurrent',
	},
];

export const firmwareFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on',
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade', 'cancelUpgrade'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'tenantSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. {{ $json.tenantId }}',
			},
		],
	},
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Leave empty to check ALL tenants (Partner accounts only). Select a specific tenant to filter results.',
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['getCurrent', 'getUpgradeStatus'],
			},
		},
		modes: [
			{
				displayName: 'All Tenants',
				name: 'all',
				type: 'string',
				placeholder: 'Leave empty for all tenants',
				hint: 'Leave this field empty to check firewalls from all tenants',
			},
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'tenantSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
			},
		],
	},
	{
		displayName: 'Firewall',
		name: 'firewallId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Select from the list or provide the Firewall UUID (not Serial Number). The list displays names/serials for readability but uses UUIDs internally.',
		displayOptions: {
			show: {
				resource: ['firmware'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'firewallSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. {{ $json.firewallId }}',
			},
		],
	},
	{
		displayName: 'Target Version',
		name: 'targetVersion',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'firmwareVersionSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By Version',
				name: 'version',
				type: 'string',
				placeholder: 'e.g. 19.5.4 MR-4 or {{ $json.targetVersion }}',
			},
		],
	},
	{
		displayName: 'Schedule Type',
		name: 'scheduleType',
		type: 'options',
		options: [
			{
				name: 'Immediate',
				value: 'immediate',
				description: 'Start upgrade immediately',
			},
			{
				name: 'Scheduled',
				value: 'scheduled',
				description: 'Schedule upgrade for later',
			},
		],
		default: 'immediate',
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
			},
		},
	},
	{
		displayName: 'Scheduled Time',
		name: 'scheduledTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
				scheduleType: ['scheduled'],
			},
		},
		description: 'When to start the upgrade (ISO 8601 format)',
		placeholder: 'e.g. 2026-01-20T02:00:00Z or {{ $json.maintenanceWindow }}',
	},
	{
		displayName: 'Create Backup Before Upgrade',
		name: 'createBackup',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
			},
		},
		description: 'Whether to create a backup before upgrading (not supported by Sophos Central Firewall API v1)',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
			},
		},
		description: 'Whether to wait for completion by polling until the firewall reports the target firmware version',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['upgrade'],
			},
		},
		options: [
			{
				displayName: 'Auto Revert on Failure',
				name: 'autoRevert',
				type: 'boolean',
				default: true,
				description: 'Whether to automatically revert on failure (not supported by Sophos Central Firewall API v1)',
			},
			{
				displayName: 'Backup Description',
				name: 'backupDescription',
				type: 'string',
				default: '=Pre-upgrade backup - {{ $now.toFormat("yyyy-MM-dd HH:mm") }}',
				description: 'Unused unless backup is supported in the future',
				displayOptions: {
					show: {
						'/createBackup': [true],
					},
				},
			},
			{
				displayName: 'Polling Interval (Seconds)',
				name: 'pollingInterval',
				type: 'number',
				default: 30,
				typeOptions: {
					minValue: 10,
					maxValue: 300,
				},
				description: 'How often to check the firewall firmware version (seconds)',
				displayOptions: {
					show: {
						'/waitForCompletion': [true],
					},
				},
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeout',
				type: 'number',
				default: 1800,
				typeOptions: {
					minValue: 60,
					maxValue: 7200,
				},
				description: 'Maximum time to wait (seconds)',
				displayOptions: {
					show: {
						'/waitForCompletion': [true],
					},
				},
			},
		],
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		displayOptions: {
			show: {
				resource: ['firmware'],
				operation: ['getUpgradeHistory'],
			},
		},
		description: 'Max number of results to return',
	},
];
