import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { bsc } from "viem/chains";
import { NFA_ADDRESS, NFA_ABI } from "@/lib/nfa";

const client = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed1.binance.org"),
});

interface NFAPublicInfo {
  id: number;
  name: string;
  persona: string;
  level: number;
  experience: number;
  active: boolean;
  createdAt: number;
  owner: string;
}

/**
 * GET /api/nfa
 * List all NFAs (public explorer)
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 *   - owner: address (filter by owner)
 */
export async function GET(req: NextRequest) {
  try {

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const ownerFilter = url.searchParams.get("owner")?.toLowerCase();

    // Get total minted
    const totalMinted = await client.readContract({
      address: NFA_ADDRESS,
      abi: NFA_ABI,
      functionName: "totalMinted",
    }) as bigint;

    const total = Number(totalMinted);
    if (total === 0) {
      return NextResponse.json({ agents: [], total: 0, limit, offset });
    }

    // Fetch agents
    const agents: NFAPublicInfo[] = [];
    const end = Math.min(offset + limit, total);

    for (let i = offset; i < end; i++) {
      try {
        const [details, owner] = await Promise.all([
          client.readContract({
            address: NFA_ADDRESS,
            abi: NFA_ABI,
            functionName: "getAgentDetails",
            args: [BigInt(i)],
          }),
          client.readContract({
            address: NFA_ADDRESS,
            abi: NFA_ABI,
            functionName: "ownerOf",
            args: [BigInt(i)],
          }),
        ]);

        const d = details as [string, Address, string, string, string, bigint, bigint, bigint, bigint, boolean];
        const ownerAddr = (owner as string).toLowerCase();

        // Skip if filtering by owner and doesn't match
        if (ownerFilter && ownerAddr !== ownerFilter) continue;

        agents.push({
          id: i,
          name: d[0],
          persona: d[2], // IPFS hash
          level: Number(d[7]),
          experience: Number(d[6]),
          active: d[9],
          createdAt: Number(d[8]),
          owner: owner as string,
        });
      } catch (err) {
        console.error(`Failed to fetch agent ${i}:`, err);
      }
    }

    return NextResponse.json({
      agents,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("NFA list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
