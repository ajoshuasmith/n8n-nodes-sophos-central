import type { INodeProperties } from 'n8n-workflow';

export const backupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['backup'],
			},
		},
		options: [
			{
				name: 'Create (Not Supported)',
				value: 'create',
				description: 'Not supported by Sophos Central Firewall API v1',
				action: 'Create a backup',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Not supported by Sophos Central Firewall API v1',
				action: 'Get many backups',
			},
		],
		default: 'create',
	},
];

export const backupFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on (required for Partner credentials)',
		displayOptions: {
			show: {
				resource: ['backup'],
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
		displayName: 'Firewall',
		name: 'firewallId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Firewall to operate on',
		displayOptions: {
			show: {
				resource: ['backup'],
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
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '=Backup - {{ $now.toFormat("yyyy-MM-dd HH:mm") }}',
		displayOptions: {
			show: {
				resource: ['backup'],
				operation: ['create'],
			},
		},
		description: 'Unused (operation not supported)',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['backup'],
				operation: ['getAll'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
			maxValue: 1000,
		},
		displayOptions: {
			show: {
				resource: ['backup'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
];
