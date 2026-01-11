
import { alertFields, alertOperations } from './AlertDescription';
import { firewallFields, firewallOperations } from './FirewallDescription';
import { firewallGroupFields, firewallGroupOperations } from './FirewallGroupDescription';
import { firmwareFields, firmwareOperations } from './FirmwareDescription';
import { healthFields, healthOperations } from './HealthDescription';
import { organizationFields, organizationOperations } from './OrganizationDescription';
import { partnerFields, partnerOperations } from './PartnerDescription';

export const operationFields = [
	...alertOperations,
	...firewallOperations,
	...firewallGroupOperations,
	...firmwareOperations,
	...healthOperations,
	...organizationOperations,
	...partnerOperations,
];

export const resourceFields = [
	...alertFields,
	...firewallFields,
	...firewallGroupFields,
	...firmwareFields,
	...healthFields,
	...organizationFields,
	...partnerFields,
];
