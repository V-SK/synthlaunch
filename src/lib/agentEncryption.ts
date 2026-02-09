function getAgentEncryptionKey(): Buffer {
  const key = process.env.AGENT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('AGENT_ENCRYPTION_KEY environment variable is not set');
  }
  return Buffer.from(key, 'utf8');
}

export function xorEncrypt(plaintext: string): string {
  const key = getAgentEncryptionKey();
  if (key.length === 0) {
    throw new Error('AGENT_ENCRYPTION_KEY must not be empty');
  }

  const input = Buffer.from(plaintext, 'utf8');
  const output = Buffer.alloc(input.length);

  for (let i = 0; i < input.length; i += 1) {
    output[i] = input[i] ^ key[i % key.length];
  }

  return output.toString('base64');
}

export function xorDecrypt(ciphertextBase64: string): string {
  const key = getAgentEncryptionKey();
  if (key.length === 0) {
    throw new Error('AGENT_ENCRYPTION_KEY must not be empty');
  }

  const input = Buffer.from(ciphertextBase64, 'base64');
  const output = Buffer.alloc(input.length);

  for (let i = 0; i < input.length; i += 1) {
    output[i] = input[i] ^ key[i % key.length];
  }

  return output.toString('utf8');
}
