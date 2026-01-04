import type { INodeProperties } from 'n8n-workflow';

export const alertOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['alert'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single alert',
				action: 'Get an alert',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many alerts',
				action: 'Get many alerts',
			},
			{
				name: 'Perform Action',
				value: 'performAction',
				description: 'Acknowledge or resolve an alert',
				action: 'Perform action on alert',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Action',
		name: 'action',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['performAction'],
				resource: ['alert'],
			},
		},
		options: [
			{
				name: 'Acknowledge',
				value: 'acknowledge',
				description: 'Acknowledge an alert',
				action: 'Acknowledge an alert',
			},
			{
				name: 'Resolve',
				value: 'resolve',
				description: 'Resolve an alert',
				action: 'Resolve an alert',
			},
		],
		default: 'acknowledge',
		description: 'Action to perform on the alert',
	},
];

export const alertFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on',
		displayOptions: {
			show: {
				resource: ['alert'],
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
		displayName: 'Alert ID',
		name: 'alertId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['alert'],
				operation: ['get', 'performAction'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'alertSearch',
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
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['alert'],
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
				resource: ['alert'],
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
				resource: ['alert'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Severity',
				name: 'severity',
				type: 'multiOptions',
				options: [
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
					{ name: 'High', value: 'high' },
				],
				default: [],
				description: 'Filter by alert severity',
			},
			{
				displayName: 'Product',
				name: 'product',
				type: 'options',
				options: [
					{ name: 'Endpoint', value: 'endpoint' },
					{ name: 'Server', value: 'server' },
					{ name: 'Mobile', value: 'mobile' },
					{ name: 'Encryption', value: 'encryption' },
					{ name: 'Email', value: 'email' },
					{ name: 'Gateway', value: 'gateway' },
					{ name: 'Wifi', value: 'wifi' },
					{ name: 'Phish Threat', value: 'phish_threat' },
					{ name: 'Cloud Optix', value: 'cloud_optix' },
					{ name: 'Firewall', value: 'firewall' },
				],
				default: 'firewall',
				description: 'Filter by product type',
			},
			{
				displayName: 'Start Date',
				name: 'from',
				type: 'dateTime',
				default: '',
				description: 'Filter alerts created after this date',
			},
		],
	},
];
