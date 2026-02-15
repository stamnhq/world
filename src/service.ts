import type { PluginLogger, StamnConfig } from './types.js';
import { StamnWSClient } from './ws-client.js';

let client: StamnWSClient | null = null;

export function getClient(): StamnWSClient | null {
  return client;
}

export function startStamnService(logger: PluginLogger, config: StamnConfig): void {
  if (!config.apiKey || !config.agentId) {
    logger.warn('Stamn plugin: apiKey and agentId required. Run `openclaw stamn login` to configure.');
    return;
  }

  client = new StamnWSClient(config, logger, {
    onConnected: () => {
      logger.info(`Stamn agent "${config.agentName ?? config.agentId}" connected to world`);
    },
    onDisconnect: () => {
      logger.warn('Stamn agent disconnected from world');
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
}
