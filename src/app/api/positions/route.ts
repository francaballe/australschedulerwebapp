import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Fetch positions from the app.positions table
        const positions = await sql`
            SELECT id, name, color 
            FROM app.positions 
            WHERE eliminated = false
            ORDER BY id ASC
        `;

        return NextResponse.json(positions, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Positions Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener posiciones' },
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
