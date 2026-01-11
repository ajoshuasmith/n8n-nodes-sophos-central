import type { INodeProperties } from 'n8n-workflow';

export const partnerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['partner'],
			},
		},
		options: [
			{
				name: 'Get Billing Usage',
				value: 'getBillingUsage',
				description: 'Get monthly billing usage report',
				action: 'Get billing usage',
			},
			{
				name: 'Get Many Admins',
				value: 'getAllAdmins',
				description: 'Get all partner administrators',
				action: 'Get many admins',
			},
			{
				name: 'Get Many Roles',
				value: 'getAllRoles',
				description: 'Get all available partner roles',
				action: 'Get many roles',
			},
		],
		default: 'getBillingUsage',
	},
];

export const partnerFields: INodeProperties[] = [
	// Billing Usage Fields
	{
		displayName: 'Year',
		name: 'year',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getBillingUsage'],
			},
		},
		default: new Date().getFullYear(),
		description: 'Year for billing report (e.g., 2026)',
		typeOptions: {
			minValue: 2020,
			maxValue: 2099,
		},
	},
	{
		displayName: 'Month',
		name: 'month',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getBillingUsage'],
			},
		},
		default: new Date().getMonth() + 1,
		description: 'Month for billing report (1-12)',
		typeOptions: {
			minValue: 1,
			maxValue: 12,
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getBillingUsage'],
			},
		},
		options: [
			{
				displayName: 'Tenant ID',
				name: 'tenantId',
				type: 'string',
				default: '',
				description: 'Filter billing report for a specific tenant',
			},
		],
	},
	// Admin Management Fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getAllAdmins'],
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
				resource: ['partner'],
				operation: ['getAllAdmins'],
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
	// Roles Fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getAllRoles'],
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
				resource: ['partner'],
				operation: ['getAllRoles'],
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
