import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface SecretsCache {
  ezpay?: string;
  slack?: string;
  encKey?: string;
}

let secretsCache: SecretsCache = {};
let loaded = false;

async function fetchSecret(
  client: SecretsManagerClient,
  secretName: string,
): Promise<string | undefined> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );
    return response.SecretString;
  } catch (error) {
    console.warn(`Failed to fetch secret ${secretName}:`, error.message);
    return undefined;
  }
}

export async function loadSecrets(): Promise<SecretsCache> {
  if (loaded) return secretsCache;

  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new SecretsManagerClient({ region });

  const [ezpay, slack, encKey] = await Promise.all([
    fetchSecret(client, '/sandbox/ezpay/api-key'),
    fetchSecret(client, '/sandbox/slack/bot-token'),
    fetchSecret(client, '/sandbox/app/encryption-key'),
  ]);

  secretsCache = { ezpay, slack, encKey };
  loaded = true;

  console.log('Secrets Manager: loaded sandbox secrets');
  return secretsCache;
}

export function getSecrets(): SecretsCache {
  return secretsCache;
}

export function getEzpayApiKey(): string {
  return secretsCache.ezpay ?? process.env.EZPAY_API_KEY ?? '';
}

export function getSlackBotToken(): string {
  return secretsCache.slack ?? process.env.SLACK_BOT_TOKEN ?? '';
}

export function getEncryptionKey(): string {
  return secretsCache.encKey ?? process.env.FORM_DATA_ENCRYPTION_KEY ?? '';
}
