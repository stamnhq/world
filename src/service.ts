import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { PluginLogger, StamnConfig } from './types.js';
import { StamnWSClient } from './ws-client.js';

let client: StamnWSClient | null = null;

export function getClient(): StamnWSClient | null {
  return client;
}

// ── Status file (shared between gateway + CLI processes) ─────────────────

function getStatusFilePath(): string {
  return join(homedir(), '.openclaw', 'stamn-status.json');
}

export interface StamnStatusFile {
  connected: boolean;
  agentId: string;
  agentName?: string;
  serverUrl: string;
  connectedAt?: string;
  disconnectedAt?: string;
}

function writeStatusFile(status: StamnStatusFile): void {
  try {
    const dir = join(homedir(), '.openclaw');
    mkdirSync(dir, { recursive: true });
    writeFileSync(getStatusFilePath(), JSON.stringify(status, null, 2) + '\n', 'utf-8');
  } catch {
    // non-critical — don't crash the service
  }
}

export function readStatusFile(): StamnStatusFile | null {
  try {
    const raw = readFileSync(getStatusFilePath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeStatusFile(): void {
  try {
    unlinkSync(getStatusFilePath());
  } catch {
    // already gone
  }
}

// ── Service lifecycle ────────────────────────────────────────────────────

export function startStamnService(logger: PluginLogger, config: StamnConfig): void {
  if (!config.apiKey || !config.agentId) {
    logger.warn('Stamn plugin: apiKey and agentId required. Run `openclaw stamn login` to configure.');
    return;
  }

  client = new StamnWSClient(config, logger, {
    onConnected: () => {
      logger.info(`Stamn agent "${config.agentName ?? config.agentId}" connected to world`);
      writeStatusFile({
        connected: true,
        agentId: config.agentId,
        agentName: config.agentName,
        serverUrl: config.serverUrl,
        connectedAt: new Date().toISOString(),
      });
    },
    onDisconnect: () => {
      logger.warn('Stamn agent disconnected from world');
      writeStatusFile({
        connected: false,
        agentId: config.agentId,
        agentName: config.agentName,
        serverUrl: config.serverUrl,
        disconnectedAt: new Date().toISOString(),
      });
    },
    onCommand: (command, params) => {
      logger.info(`Server command: ${command} ${params ? JSON.stringify(params) : ''}`);
      if (command === 'shutdown') {
        stopStamnService();
      }
    },
    onTransferReceived: (data) => {
      const amount = (data.amountCents / 1_000_000).toFixed(2);
      logger.info(
        `Transfer received: $${amount} ${data.currency} from ${data.fromAgentName} — "${data.description}"`,
      );
    },
    onLandClaimed: (payload) => {
      logger.info(`Land claimed at (${payload.x}, ${payload.y})`);
    },
    onLandClaimDenied: (payload) => {
      logger.warn(`Land claim denied: ${payload.reason} (${payload.code})`);
    },
    onLandTradeComplete: (payload) => {
      logger.info(
        `Land trade complete: (${payload.x}, ${payload.y}) from ${payload.fromAgentId} to ${payload.toAgentId}`,
      );
    },
  });

  client.connect();
}

export function stopStamnService(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
  removeStatusFile();
}
