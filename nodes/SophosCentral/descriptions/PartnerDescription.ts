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
				name: 'Create Admin',
				value: 'createAdmin',
				description: 'Create a new partner administrator',
				action: 'Create an admin',
			},
			{
				name: 'Delete Role Assignment',
				value: 'deleteRoleAssignment',
				description: 'Remove a role assignment from an admin',
				action: 'Delete a role assignment',
			},
			{
				name: 'Get Admin',
				value: 'getAdmin',
				description: 'Get a specific partner administrator',
				action: 'Get an admin',
			},
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
			{
				name: 'Get Role Assignments',
				value: 'getRoleAssignments',
				description: 'Get all role assignments for an admin',
				action: 'Get role assignments',
			},
		],
		default: 'getAllAdmins',
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
		description: 'Partner operations require Partner API credentials configured in your Sophos Central credentials',
	},
	// Admin ID field (for get, getRoleAssignments, deleteRoleAssignment)
	{
		displayName: 'Admin ID',
		name: 'adminId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['getAdmin', 'getRoleAssignments', 'deleteRoleAssignment'],
			},
		},
		default: '',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'The ID of the administrator',
	},
	// Role Assignment ID (for delete)
	{
		displayName: 'Role Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['deleteRoleAssignment'],
			},
		},
		default: '',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'The ID of the role assignment to delete',
	},
	// Create Admin fields
	{
		displayName: 'Email (Username)',
		name: 'email',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['createAdmin'],
			},
		},
		default: '',
		placeholder: 'admin@example.com',
		description: 'Email address (used as username) for the new administrator',
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['createAdmin'],
			},
		},
		default: '',
		description: 'First name of the administrator',
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['createAdmin'],
			},
		},
		default: '',
		description: 'Last name of the administrator',
	},
	{
		displayName: 'Role ID',
		name: 'roleId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['createAdmin'],
			},
		},
		default: '',
		placeholder: 'Use "Get Many Roles" to find role IDs',
		description: 'The ID of the role to assign to this administrator',
	},
	{
		displayName: 'Admin Options',
		name: 'adminOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['partner'],
				operation: ['createAdmin'],
			},
		},
		options: [
			{ name: 'Current Month', value: 7 },
			{
				displayName: 'Tenant IDs',
				name: 'tenantIds',
				type: 'string',
				default: '',
				placeholder: 'tenant-ID-1,tenant-ID-2',
				description: 'Comma-separated list of tenant IDs for scoped access. Leave empty for all tenants.',
			},
		],
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
		default: 2026,
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
		default: 7,
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
	// Return All and Limit fields
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
