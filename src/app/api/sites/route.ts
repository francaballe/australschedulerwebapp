import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const sites = await sql`
            SELECT id, "name"
            FROM app.sites
            ORDER BY id ASC
        `;

        const formatted = sites.map((s: any) => ({ id: s.id, name: s.name }));

        return NextResponse.json(formatted, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Sites Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener sitios' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
