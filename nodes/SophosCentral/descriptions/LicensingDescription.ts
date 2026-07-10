import type { INodeProperties } from 'n8n-workflow';

export const licensingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['licensing'],
			},
		},
		options: [
			{
				name: 'Get Firewall License by Serial Number',
				value: 'getFirewallLicense',
				description: 'Get licensing details for a specific firewall by serial number',
				action: 'Get firewall license by serial number',
			},
			{
				name: 'Get Many Firewall Licenses',
				value: 'getFirewallLicenses',
				description: 'Get licensing and subscription details for all managed firewalls',
				action: 'Get many firewall licenses',
			},
			{
				name: 'Get Many Tenant Licenses',
				value: 'getAllLicenses',
				description: 'Get all tenant product licenses for the account',
				action: 'Get many tenant licenses',
			},
		],
		default: 'getFirewallLicenses',
	},
];

export const licensingFields: INodeProperties[] = [
	{
		displayName: 'Serial Number',
		name: 'serialNumber',
		type: 'string',
		required: true,
		default: '',
		description: 'Serial number of the firewall to look up',
		placeholder: 'e.g. X12304HYRF2BQ6D',
		displayOptions: {
			show: {
				resource: ['licensing'],
				operation: ['getFirewallLicense'],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['licensing'],
				operation: ['getFirewallLicenses', 'getAllLicenses'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results to return',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		displayOptions: {
			show: {
				resource: ['licensing'],
				operation: ['getFirewallLicenses', 'getAllLicenses'],
				returnAll: [false],
			},
		},
	},
];
