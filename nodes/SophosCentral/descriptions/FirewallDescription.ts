import type { INodeProperties } from 'n8n-workflow';

export const firewallOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['firewall'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single firewall',
				action: 'Get a firewall',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get multiple firewalls',
				action: 'Get many firewalls',
			},
		],
		default: 'get',
	},
];

export const firewallFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on (required for Partner credentials)',
		displayOptions: {
			show: {
				resource: ['firewall'],
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
				placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
				hint: 'Use {{ $json.tenantId }} to reference from previous step',
			},
		],
	},
	{
		displayName: 'Firewall',
		name: 'firewallId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Firewall to get',
		displayOptions: {
			show: {
				resource: ['firewall'],
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
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
							errorMessage: 'Not a valid firewall ID (must be UUID format)',
						},
					},
				],
				placeholder: 'e.g. 12345678-1234-1234-1234-123456789abc',
				hint: 'Use {{ $json.firewallId }} to reference from previous step',
			},
			{
				displayName: 'By URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://api-us01.central.sophos.com/firewall/v1/firewalls/...',
				extractValue: {
					type: 'regex',
					regex: 'firewalls/([a-f0-9-]+)',
				},
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['firewall'],
				operation: ['getAll'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['firewall'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 1000,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['firewall'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Name Contains',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Filter by firewall name (client-side)',
				placeholder: 'e.g. Branch or {{ $json.nameFilter }}',
			},
			{
				displayName: 'Serial Contains',
				name: 'serial',
				type: 'string',
				default: '',
				description: 'Filter by serial number (client-side)',
				placeholder: 'e.g. C0123456789 or {{ $json.serialFilter }}',
			},
			{
				displayName: 'Firmware Version',
				name: 'firmwareVersion',
				type: 'string',
				default: '',
				description: 'Filter by exact firmware version (client-side)',
				placeholder: 'e.g. 19.5.3 or {{ $json.currentVersion }}',
			},
		],
	},
];
