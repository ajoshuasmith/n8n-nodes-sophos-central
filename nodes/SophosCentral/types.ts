import type { IDataObject } from 'n8n-workflow';

export interface ISophosCentralCredentials {
	clientId: string;
	clientSecret: string;
	accountType: 'partner' | 'organization';
	tenantId?: string;
}

export interface IAuthToken {
	token: string;
	expiresAt: number;
	partnerId?: string;
	idType?: string;
	dataRegion: string;
}

export interface ITenant {
	id: string;
	name: string;
	showAs?: string;
	dataGeography?: string;
	dataRegion: string;
	apiHost: string;
	status: string;
	billingType?: string;
}

export interface IFirewall {
	id: string;
	name: string;
	serial: string;
	model: string;
	firmwareVersion: string;
	status: 'online' | 'offline';
	group?: string;
	tags?: string[];
	lastSeen?: string;
}

export interface IFirmwareVersion {
	version: string;
	releaseDate: string;
	releaseNotes?: string;
	releaseNotesUrl?: string;
	upgradeType: 'automatic' | 'manual';
}

export interface IFirmwareInfo {
	currentVersion: string;
	availableVersions: IFirmwareVersion[];
	upgradeStatus:
		| 'idle'
		| 'downloading'
		| 'installing'
		| 'rebooting'
		| 'complete'
		| 'failed';
}

export interface IUpgradeStatus {
	status: 'pending' | 'downloading' | 'installing' | 'rebooting' | 'complete' | 'failed';
	progress: number;
	currentStep: string;
	estimatedCompletion?: string;
	error?: string;
}

export interface IBackup {
	id: string;
	description: string;
	timestamp: string;
	size?: number;
	status: 'creating' | 'completed' | 'failed';
}

export interface IHealthStatus {
	status: 'healthy' | 'warning' | 'critical';
	cpu: number;
	memory: number;
	disk: number;
	services: IDataObject;
	interfaces: IDataObject;
}

export interface ILogEntry {
	timestamp: string;
	severity: 'critical' | 'error' | 'warning' | 'info';
	message: string;
	component: string;
}
