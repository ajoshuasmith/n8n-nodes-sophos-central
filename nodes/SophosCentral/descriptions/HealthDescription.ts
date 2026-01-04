import type { INodeProperties } from 'n8n-workflow';

export const healthOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['health'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get firewall details that can be used as a basic health signal',
				action: 'Get firewall health',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many firewalls (basic health signals)',
				action: 'Get many firewall health items',
			},
		],
		default: 'get',
	},
];

export const healthFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on (required for Get operation)',
		displayOptions: {
			show: {
				resource: ['health'],
				operation: ['get'],
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
		description: 'Leave empty to get health from ALL tenants (Partner accounts only). Select a specific tenant to filter results.',
		displayOptions: {
			show: {
				resource: ['health'],
				operation: ['getAll'],
			},
		},
		modes: [
			{
				displayName: 'All Tenants',
				name: 'all',
				type: 'string',
				placeholder: 'Leave empty for all tenants',
				hint: 'Leave this field empty to get firewalls from all tenants',
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
		description: 'Firewall to check',
		displayOptions: {
			show: {
				resource: ['health'],
				operation: ['get'],
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
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['health'],
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
				resource: ['health'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
];
