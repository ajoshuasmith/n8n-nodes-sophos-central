import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class SophosCentralApi implements ICredentialType {
	name = 'sophosCentralApi';
	displayName = 'Sophos Central API';
	icon: Icon = 'file:../nodes/SophosCentral/images/sophos-central.svg';
	documentationUrl = 'https://developer.sophos.com/getting-started';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Account Type',
			name: 'accountType',
			type: 'options',
			options: [
				{
					name: 'Partner (Multi-Tenant)',
					value: 'partner',
					description: 'For MSPs managing multiple customer tenants',
				},
				{
					name: 'Organization (Single Tenant)',
					value: 'organization',
					description: 'For a single organization',
				},
			],
			default: 'partner',
		},
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					accountType: ['organization'],
				},
			},
			description: 'Tenant ID for Organization accounts (UUID)',
			placeholder: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: 'https://id.sophos.com/api/v2/oauth2/token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: '={{"grant_type=client_credentials&scope=token&client_id=" + encodeURIComponent($credentials.clientId) + "&client_secret=" + encodeURIComponent($credentials.clientSecret)}}',
			json: true,
		},
	};
}
