import { NextRequest, NextResponse } from "next/server";

const FLAP_API = "https://flap.sh/api";

interface NFAMetadata {
  name: string;
  description: string;
  image: string; // IPFS hash or URL
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  persona?: string;
  voice?: string;
  animation?: string;
}

/**
 * POST /api/nfa/metadata
 * Upload NFA metadata to IPFS
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<NFAMetadata>;

    // Validate required fields
    if (!body.name || !body.description || !body.image) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, image" },
        { status: 400 }
      );
    }

    // Build metadata object (ERC-721 compatible)
    const metadata: NFAMetadata = {
      name: body.name,
      description: body.description,
      image: body.image.startsWith("ipfs://") 
        ? body.image 
        : `ipfs://${body.image}`,
      external_url: body.external_url || `https://synthlaunch.fun/nfa/${body.name}`,
      attributes: body.attributes || [
        { trait_type: "Type", value: "Non-Fungible Agent" },
        { trait_type: "Standard", value: "BAP-578" },
      ],
      persona: body.persona,
      voice: body.voice,
      animation: body.animation,
    };

    // Upload to IPFS via Flap API
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }),
      "metadata.json"
    );

    const response = await fetch(`${FLAP_API}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("IPFS upload failed:", error);
      return NextResponse.json(
        { error: "Failed to upload metadata to IPFS" },
        { status: 500 }
      );
    }

    const result = await response.json();
    
    // Result format from Flap: { cid: "...", url: "..." }
    return NextResponse.json({
      success: true,
      cid: result.cid || result.IpfsHash,
      uri: `ipfs://${result.cid || result.IpfsHash}`,
      gateway: `https://gateway.pinata.cloud/ipfs/${result.cid || result.IpfsHash}`,
      metadata,
    });
  } catch (error: any) {
    console.error("NFA metadata upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
