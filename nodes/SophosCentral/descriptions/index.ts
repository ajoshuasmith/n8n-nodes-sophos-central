import { backupFields, backupOperations } from './BackupDescription';
import { firewallFields, firewallOperations } from './FirewallDescription';
import { firmwareFields, firmwareOperations } from './FirmwareDescription';
import { healthFields, healthOperations } from './HealthDescription';

export const operationFields = [
	...firewallOperations,
	...firmwareOperations,
	...backupOperations,
	...healthOperations,
];

export const resourceFields = [
	...firewallFields,
	...firmwareFields,
	...backupFields,
	...healthFields,
];
