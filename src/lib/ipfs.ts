export interface TokenMeta {
  name: string;
  symbol: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

/**
 * Upload image + metadata to IPFS via our proxy API route (/api/upload).
 * Returns the IPFS CID string.
 */
export async function uploadToFlap(file: File, meta: TokenMeta): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', meta.name);
  formData.append('symbol', meta.symbol);
  formData.append('description', meta.description);
  if (meta.website) formData.append('website', meta.website);
  if (meta.twitter) formData.append('twitter', meta.twitter);
  if (meta.telegram) formData.append('telegram', meta.telegram);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  const data = await res.json();

  if (!data.cid) {
    throw new Error('Upload returned no CID');
  }

  return data.cid;
}
