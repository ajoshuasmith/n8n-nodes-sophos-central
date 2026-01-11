#!/bin/bash
# Extract lines 1-1064 (before organization operations)
head -1064 nodes/SophosCentral/SophosCentral.node.ts > /tmp/part1.ts

# Extract lines after organization block (from } catch (error) onwards)
tail -n +1169 nodes/SophosCentral/SophosCentral.node.ts > /tmp/part2.ts

# Create new organization operations
cat > /tmp/org_new.ts << 'ORGCODE'
	if (resource === 'organization') {
		const baseUrl = '/partner/v1/tenants';

		if (operation === 'create') {
			const name = this.getNodeParameter('name', i) as string;
			const dataGeography = this.getNodeParameter('dataGeography', i) as string;
			const billingType = this.getNodeParameter('billingType', i) as string;
			const contactFirstName = this.getNodeParameter('contactFirstName', i) as string;
			const contactLastName = this.getNodeParameter('contactLastName', i) as string;
			const contactEmail = this.getNodeParameter('contactEmail', i) as string;
			const contactPhone = this.getNodeParameter('contactPhone', i) as string;
			const addressLine1 = this.getNodeParameter('addressLine1', i) as string;
			const city = this.getNodeParameter('city', i) as string;
			const countryCode = this.getNodeParameter('countryCode', i) as string;
			const postalCode = this.getNodeParameter('postalCode', i) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

			const body: IDataObject = {
				name,
				dataGeography,
				billingType,
				contact: {
					firstName: contactFirstName,
					lastName: contactLastName,
					email: contactEmail,
					phone: contactPhone,
					address: {
						address1: addressLine1,
						city,
						countryCode,
						postalCode,
					},
				},
			};

			if (additionalFields.showAs) body.showAs = additionalFields.showAs;
			if (additionalFields.addressLine2) {
				const contact = body.contact as IDataObject;
				const address = contact.address as IDataObject;
				contact.address = {
					...address,
					address2: additionalFields.addressLine2,
				};
			}
			if (additionalFields.state) {
				const contact = body.contact as IDataObject;
				const address = contact.address as IDataObject;
				contact.address = {
					...address,
					state: additionalFields.state,
				};
			}

			// Get auth context for Partner API
			const credentials = (await this.getCredentials(
'sophosCentralApi',
)) as unknown as ISophosCentralCredentials;
			const ctx = await getAuthContext.call(this, credentials);

			// Partner API call
			const responseData = await this.helpers.httpRequest({
method: 'POST',
url: 'https://api.central.sophos.com/partner/v1/tenants',
headers: {
Authorization: \`Bearer \${ctx.token}\`,
'X-Partner-ID': ctx.partnerId as string,
'Content-Type': 'application/json',
},
body,
json: true,
});
			returnData.push({ json: responseData, pairedItem: { item: i } });
		}

		if (operation === 'get') {
			const tenantId = this.getNodeParameter('tenantId', i) as string;
			const credentials = (await this.getCredentials(
'sophosCentralApi',
)) as unknown as ISophosCentralCredentials;
			const ctx = await getAuthContext.call(this, credentials);

			const responseData = await this.helpers.httpRequest({
method: 'GET',
url: \`https://api.central.sophos.com/partner/v1/tenants/\${tenantId}\`,
headers: {
Authorization: \`Bearer \${ctx.token}\`,
'X-Partner-ID': ctx.partnerId as string,
},
json: true,
});
			returnData.push({ json: responseData, pairedItem: { item: i } });
		}

		if (operation === 'getAll') {
			const returnAll = this.getNodeParameter('returnAll', i) as boolean;
			const credentials = (await this.getCredentials(
'sophosCentralApi',
)) as unknown as ISophosCentralCredentials;
			const ctx = await getAuthContext.call(this, credentials);

			let responseItems: IDataObject[];

			if (returnAll) {
				responseItems = [];
				let page = 1;
				const pageSize = 100;
				let totalPages = 1;

				do {
					const response = (await this.helpers.httpRequest({
method: 'GET',
url: 'https://api.central.sophos.com/partner/v1/tenants',
headers: {
Authorization: \`Bearer \${ctx.token}\`,
'X-Partner-ID': ctx.partnerId as string,
},
qs: { page, pageSize, pageTotal: true },
json: true,
})) as IDataObject;

					const items = (response.items as IDataObject[]) || [];
					responseItems.push(...items);

					const pages = response.pages as IDataObject | undefined;
					totalPages = typeof pages?.total === 'number' ? (pages.total as number) : page;
					page += 1;
				} while (page <= totalPages);
			} else {
				const limit = this.getNodeParameter('limit', i) as number;
				const response = (await this.helpers.httpRequest({
method: 'GET',
url: 'https://api.central.sophos.com/partner/v1/tenants',
headers: {
Authorization: \`Bearer \${ctx.token}\`,
'X-Partner-ID': ctx.partnerId as string,
},
qs: { page: 1, pageSize: limit, pageTotal: false },
json: true,
})) as IDataObject;
				responseItems = (response.items as IDataObject[]) || [];
			}

			for (const item of responseItems) {
				returnData.push({ json: item, pairedItem: { item: i } });
			}
		}
	}
ORGCODE

# Combine
cat /tmp/part1.ts /tmp/org_new.ts /tmp/part2.ts > nodes/SophosCentral/SophosCentral.node.ts
echo "Done!"
