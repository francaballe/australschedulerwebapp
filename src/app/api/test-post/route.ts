import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        return NextResponse.json({ received: body });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 400 });
    }
}
