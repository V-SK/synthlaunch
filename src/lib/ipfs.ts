const UPLOAD_URL = 'https://funcs.flap.sh/api/upload';

export async function uploadToIPFS(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.cid || data.hash || data.IpfsHash;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export async function uploadMetadata(meta: TokenMetadata): Promise<string> {
  const json: Record<string, string> = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image: meta.image,
  };
  if (meta.website) json.website = meta.website;
  if (meta.twitter) json.twitter = meta.twitter;
  if (meta.telegram) json.telegram = meta.telegram;

  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  return uploadToIPFS(blob);
}
