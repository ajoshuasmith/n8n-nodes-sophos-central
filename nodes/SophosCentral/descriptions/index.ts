
import { alertFields, alertOperations } from './AlertDescription';
import { firewallFields, firewallOperations } from './FirewallDescription';
import { firewallGroupFields, firewallGroupOperations } from './FirewallGroupDescription';
import { firmwareFields, firmwareOperations } from './FirmwareDescription';
import { healthFields, healthOperations } from './HealthDescription';

export const operationFields = [
	...alertOperations,
	...firewallOperations,
	...firewallGroupOperations,
	...firmwareOperations,
	...healthOperations,
];

export const resourceFields = [
	...alertFields,
	...firewallFields,
	...firewallGroupFields,
	...firmwareFields,
	...healthFields,
];
