import { randomUUID } from 'crypto';
import type { PluginApi, MoveDirection, SpendRequestPayload } from './types.js';
import { getClient } from './service.js';

export function registerStamnTools(api: PluginApi): void {
  // ── stamn_move ──────────────────────────────────────────────────────────

  api.registerCommand({
    name: 'stamn_move',
    description: 'Move agent on the Stamn world grid (direction: up/down/left/right)',
    acceptsArgs: true,
    handler: ({ args }) => {
      const client = getClient();
      if (!client?.isConnected) {
        return { text: 'Not connected to Stamn server.' };
      }

      const direction = args?.trim().toLowerCase();
      const valid: MoveDirection[] = ['up', 'down', 'left', 'right'];
      if (!direction || !valid.includes(direction as MoveDirection)) {
        return { text: `Invalid direction. Use: ${valid.join(', ')}` };
      }

      client.move(direction as MoveDirection);
      return { text: `Moved ${direction}.` };
    },
  });

  // ── stamn_claim_land ────────────────────────────────────────────────────

  api.registerCommand({
    name: 'stamn_claim',
    description: 'Claim the land parcel at your current position on the Stamn grid',
    handler: () => {
      const client = getClient();
      if (!client?.isConnected) {
        return { text: 'Not connected to Stamn server.' };
      }

      client.claimLand();
      return { text: 'Land claim request sent.' };
    },
  });

  // ── stamn_offer_land ────────────────────────────────────────────────────

  api.registerCommand({
    name: 'stamn_offer_land',
    description: 'Offer to sell a land parcel (args: x y toAgentId priceCents)',
    acceptsArgs: true,
    handler: ({ args }) => {
      const client = getClient();
      if (!client?.isConnected) {
        return { text: 'Not connected to Stamn server.' };
      }

      const parts = args?.trim().split(/\s+/) ?? [];
      if (parts.length < 4) {
        return { text: 'Usage: /stamn_offer_land <x> <y> <toAgentId> <priceCents>' };
      }

      const [xStr, yStr, toAgentId, priceStr] = parts;
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const priceCents = parseInt(priceStr, 10);

      if (isNaN(x) || isNaN(y) || isNaN(priceCents)) {
        return { text: 'x, y, and priceCents must be numbers.' };
      }

      client.offerLand(x, y, toAgentId, priceCents);
      return { text: `Offered land (${x}, ${y}) to ${toAgentId} for ${priceCents} cents.` };
    },
  });

  // ── stamn_spend ─────────────────────────────────────────────────────────

  api.registerCommand({
    name: 'stamn_spend',
    description: 'Request a spend from the agent wallet (args: amountCents vendor description)',
    acceptsArgs: true,
    handler: ({ args }) => {
      const client = getClient();
      if (!client?.isConnected) {
        return { text: 'Not connected to Stamn server.' };
      }

      const parts = args?.trim().split(/\s+/) ?? [];
      if (parts.length < 3) {
        return { text: 'Usage: /stamn_spend <amountCents> <vendor> <description...>' };
      }

      const amountCents = parseInt(parts[0], 10);
      if (isNaN(amountCents) || amountCents <= 0) {
        return { text: 'amountCents must be a positive number.' };
      }

      const vendor = parts[1];
      const description = parts.slice(2).join(' ');
      const requestId = randomUUID();

      const payload: SpendRequestPayload = {
        requestId,
        amountCents,
        currency: 'USDC',
        category: 'api',
        rail: 'internal',
        vendor,
        description,
      };

      client.requestSpend(payload);
      return { text: `Spend request sent: ${amountCents} cents to ${vendor} — "${description}"` };
    },
  });

  // ── stamn_status ────────────────────────────────────────────────────────

  api.registerCommand({
    name: 'stamn_status',
    description: 'Show Stamn agent connection status',
    handler: () => {
      const client = getClient();
      if (!client) {
        return { text: 'Stamn plugin not initialized. Check config.' };
      }
      return {
        text: client.isConnected
          ? 'Connected to Stamn world.'
          : 'Disconnected from Stamn world (reconnecting...).',
      };
    },
  });
}
