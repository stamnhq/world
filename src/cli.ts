import type { PluginApi, StamnConfig } from './types.js';
import { runDeviceLogin } from './auth.js';
import { getClient } from './service.js';

export function registerStamnCli(api: PluginApi, config: StamnConfig): void {
  api.registerCli(
    ({ program }) => {
      const stamn = (program as any).command('stamn').description('Stamn world commands');

      stamn
        .command('login')
        .description('Authenticate and register an agent with Stamn')
        .option('--name <name>', 'Agent name')
        .option('--server <url>', 'Server URL', config.serverUrl)
        .action(async (opts: { name?: string; server: string }) => {
          try {
            console.log('Starting Stamn device login...');
            const result = await runDeviceLogin(opts.server, opts.name);

            console.log();
            console.log(`  Agent "${result.agentName}" registered.`);
            console.log(`  Agent ID: ${result.agentId}`);
            console.log();
            console.log('  Add these to your openclaw.json under plugins.entries.stamn.config:');
            console.log();
            console.log(`    "apiKey": "${result.apiKey}",`);
            console.log(`    "agentId": "${result.agentId}",`);
            console.log(`    "agentName": "${result.agentName}"`);
            console.log();
            console.log('  Then restart the gateway.');
          } catch (err) {
            console.error(`Login failed: ${(err as Error).message}`);
            process.exitCode = 1;
          }
        });

      stamn
        .command('status')
        .description('Show Stamn agent connection status')
        .action(async () => {
          const client = getClient();

          console.log('Stamn Plugin Status');
          console.log('-------------------');
          console.log(`  Agent ID:    ${config.agentId || '(not configured)'}`);
          console.log(`  Agent Name:  ${config.agentName || '(not configured)'}`);
          console.log(`  Server:      ${config.serverUrl}`);
          console.log(`  Connected:   ${client?.isConnected ? 'yes' : 'no'}`);

          if (config.apiKey) {
            try {
              const res = await fetch(`${config.serverUrl}/v1/health`);
              console.log(`  Server:      ${res.ok ? 'healthy' : 'unhealthy'}`);
            } catch {
              console.log('  Server:      unreachable');
            }
          }
        });
    },
    { commands: ['stamn'] },
  );
}
