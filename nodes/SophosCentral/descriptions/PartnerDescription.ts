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
				description: 'Get monthly billing usage report for all tenants',
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
				description: 'Get all available partner roles and permissions',
				action: 'Get many roles',
			},
		],
		default: 'getBillingUsage',
	},
];

export const partnerFields: INodeProperties[] = [
	// Partner Notice
	{
		displayName: 'Partner Account Required',
		name: 'partnerNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['partner'],
			},
		},
		description: 'Partner operations require Partner API credentials configured in your Sophos Central credentials.',
	},
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
		default: '={{ new Date().getFullYear() }}',
		description: 'Year for billing report (e.g., 2026)',
		typeOptions: {
			minValue: 2020,
			maxValue: 2099,
		},
	},
	{
		displayName: 'Month',
		name: 'month',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getBillingUsage'],
			},
		},
		options: [
			{ name: 'January', value: 1 },
			{ name: 'February', value: 2 },
			{ name: 'March', value: 3 },
			{ name: 'April', value: 4 },
			{ name: 'May', value: 5 },
			{ name: 'June', value: 6 },
			{ name: 'July', value: 7 },
			{ name: 'August', value: 8 },
			{ name: 'September', value: 9 },
			{ name: 'October', value: 10 },
			{ name: 'November', value: 11 },
			{ name: 'December', value: 12 },
		],
		default: 1,
		description: 'Month for billing report',
	},
	{
		displayName: 'Filters',
		name: 'billingFilters',
		type: 'collection',
		placeholder: 'Add Filter',
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
				placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
				description: 'Filter billing report for a specific tenant',
			},
		],
	},
	// Admin List Fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getAllAdmins', 'getAllRoles'],
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
				operation: ['getAllAdmins', 'getAllRoles'],
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
