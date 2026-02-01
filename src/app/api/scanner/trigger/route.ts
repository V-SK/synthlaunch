import { NextResponse } from 'next/server';

// 简单的手动触发接口（需要 API key 保护）
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');

  if (authorization !== `Bearer ${process.env.SCANNER_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 这里可以触发单次扫链逻辑
  // 实际生产中建议用独立服务持续运行

  return NextResponse.json({ message: 'Scanner triggered' });
}
