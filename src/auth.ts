const POLL_INTERVAL_MS = 5_000;
const AUTH_TIMEOUT_MS = 300_000; // 5 minutes

interface DeviceFlowData {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

interface DeviceLoginResult {
  apiKey: string;
  agentId: string;
  agentName: string;
}

export async function runDeviceLogin(
  serverUrl: string,
  agentName?: string,
): Promise<DeviceLoginResult> {
  // Step 1: Initiate device flow
  const initRes = await fetch(`${serverUrl}/v1/auth/device-codes`, {
    method: 'POST',
  });

  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`Failed to initiate device flow: ${body || initRes.status}`);
  }

  const { data: flow } = (await initRes.json()) as { data: DeviceFlowData };

  console.log();
  console.log(`  Open: ${flow.verificationUri}`);
  console.log(`  Code: ${flow.userCode}`);
  console.log();
  console.log('  Waiting for approval...');

  // Step 2: Poll for approval
  const apiKey = await pollForApproval(serverUrl, flow.deviceCode);

  // Step 3: Register agent
  const registerRes = await fetch(`${serverUrl}/v1/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: agentName || undefined,
      platform: `${process.platform}-${process.arch}`,
    }),
  });

  if (!registerRes.ok) {
    const body = await registerRes.text();
    let message = `HTTP ${registerRes.status}`;
    try {
      const parsed = JSON.parse(body);
      message = Array.isArray(parsed.message)
        ? parsed.message.join('. ')
        : parsed.message ?? message;
    } catch {
      if (body) message = body;
    }
    throw new Error(`Agent registration failed: ${message}`);
  }

  const { data: agent } = (await registerRes.json()) as {
    data: { id: string; name: string };
  };

  return {
    apiKey,
    agentId: agent.id,
    agentName: agent.name,
  };
}

async function pollForApproval(
  serverUrl: string,
  deviceCode: string,
): Promise<string> {
  const deadline = Date.now() + AUTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const res = await fetch(`${serverUrl}/v1/auth/device-codes/${deviceCode}`);
      if (!res.ok) continue;

      const { data } = (await res.json()) as {
        data: { status: string; apiKey?: string };
      };

      if (data.status === 'approved' && data.apiKey) {
        return data.apiKey;
      }

      if (data.status === 'expired') {
        throw new Error('Login code expired. Try again.');
      }
    } catch (err) {
      if ((err as Error).message.includes('expired')) throw err;
      // Silently retry on network errors
    }
  }

  throw new Error('Login timed out. Try again.');
}
