import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Simple file-based storage in /tmp (Vercel ephemeral) or local dev
// For production, swap this for Supabase/Vercel KV
const DB_PATH = path.join('/tmp', 'alice-bindings.json');

interface Binding {
  bscAddress: string;
  aliceAddress: string;
  signature: string;
  message: string;
  createdAt: string;
}

function readDB(): Binding[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return [];
}

function writeDB(bindings: Binding[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(bindings, null, 2));
}

export async function GET(req: NextRequest) {
  const bscAddress = req.nextUrl.searchParams.get('bsc')?.toLowerCase();
  if (!bscAddress) {
    return NextResponse.json({ error: 'missing bsc param' }, { status: 400 });
  }
  const bindings = readDB();
  const found = bindings.find((b) => b.bscAddress === bscAddress);
  return NextResponse.json({ binding: found ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { bscAddress, aliceAddress, signature, message } = body;

  if (!bscAddress || !aliceAddress || !signature || !message) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Verify signature on-chain (viem verifyMessage)
  const { verifyMessage } = await import('viem');
  let valid = false;
  try {
    valid = await verifyMessage({
      address: bscAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 });
  }

  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  }

  const bindings = readDB();
  const existing = bindings.findIndex((b) => b.bscAddress === bscAddress.toLowerCase());
  const entry: Binding = {
    bscAddress: bscAddress.toLowerCase(),
    aliceAddress,
    signature,
    message,
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    bindings[existing] = entry;
  } else {
    bindings.push(entry);
  }

  writeDB(bindings);
  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
