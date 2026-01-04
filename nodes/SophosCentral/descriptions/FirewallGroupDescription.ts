import type { INodeProperties } from 'n8n-workflow';

export const firewallGroupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['firewallGroup'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a firewall group',
				action: 'Get a firewall group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many firewall groups',
				action: 'Get many firewall groups',
			},
			{
				name: 'Get Sync Status',
				value: 'getSyncStatus',
				description: 'Get sync status of firewalls in a group',
				action: 'Get sync status',
			},
		],
		default: 'get',
	},
];

export const firewallGroupFields: INodeProperties[] = [
	{
		displayName: 'Tenant',
		name: 'tenantId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Tenant to perform the operation on',
		displayOptions: {
			show: {
				resource: ['firewallGroup'],
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
		displayName: 'Group',
		name: 'firewallGroupId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Select the Firewall Group',
		displayOptions: {
			show: {
				resource: ['firewallGroup'],
				operation: ['get', 'getSyncStatus'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'firewallGroupSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12345678-1234-1234-1234-123456789abc',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['firewallGroup'],
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
				resource: ['firewallGroup'],
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
];
