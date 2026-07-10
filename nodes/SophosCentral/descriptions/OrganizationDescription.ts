import type { INodeProperties } from 'n8n-workflow';

export const organizationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['organization'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new tenant organization (Partner accounts only)',
				action: 'Create an organization',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single tenant organization',
				action: 'Get an organization',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many tenant organizations',
				action: 'Get many organizations',
			},
		],
		default: 'getAll',
	},
];

export const organizationFields: INodeProperties[] = [
	{
		displayName: 'Tenant ID',
		name: 'tenantId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['get'],
			},
		},
		default: '',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'The ID of the tenant to retrieve',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'e.g. Acme Corporation',
		description: 'The name of the tenant (cannot be changed after creation)',
	},
	{
		displayName: 'Data Geography',
		name: 'dataGeography',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		options: [
			{ name: 'Australia', value: 'AU' },
			{ name: 'Canada', value: 'CA' },
			{ name: 'Germany', value: 'DE' },
			{ name: 'Ireland', value: 'IE' },
			{ name: 'Japan', value: 'JP' },
			{ name: 'United States', value: 'US' },
		],
		default: 'US',
		description: 'The geographical location where tenant data will be stored',
	},
	{
		displayName: 'Billing Type',
		name: 'billingType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		options: [
			{ name: 'Trial', value: 'trial' },
			{ name: 'Usage', value: 'usage' },
		],
		default: 'usage',
		description: 'The billing type for the tenant',
	},
	{
		displayName: 'Contact First Name',
		name: 'contactFirstName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		description: 'Primary contact first name',
	},
	{
		displayName: 'Contact Last Name',
		name: 'contactLastName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		description: 'Primary contact last name',
	},
	{
		displayName: 'Contact Email',
		name: 'contactEmail',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'e.g. admin@example.com',
		description: 'Primary contact email address',
	},
	{
		displayName: 'Contact Phone',
		name: 'contactPhone',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'e.g. +1-555-123-4567',
		description: 'Primary contact phone number',
	},
	{
		displayName: 'Address Line 1',
		name: 'addressLine1',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		description: 'Street address',
	},
	{
		displayName: 'City',
		name: 'city',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
	},
	{
		displayName: 'Country Code',
		name: 'countryCode',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: 'US',
		placeholder: 'e.g. US, GB, CA',
		description: 'Two-letter ISO country code',
	},
	{
		displayName: 'Postal Code',
		name: 'postalCode',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		default: '',
		description: 'Postal/ZIP code',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['organization'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Display Name',
				name: 'showAs',
				type: 'string',
				default: '',
				description: 'The tenant display name (defaults to name if not provided)',
			},
			{
				displayName: 'Address Line 2',
				name: 'addressLine2',
				type: 'string',
				default: '',
				description: 'Additional address information',
			},
			{
				displayName: 'State/Province',
				name: 'state',
				type: 'string',
				default: '',
				description: 'State or province',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['organization'],
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
				resource: ['organization'],
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
