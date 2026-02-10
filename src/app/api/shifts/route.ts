import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');

    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: 'startDate and endDate parameters are required' },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        // Fetch shifts from app.shifts joined with app.positions
        const shifts = await sql`
            SELECT 
                s.id, 
                s.date::text as date, 
                s.user_id as "userId", 
                s.starttime::text as "startTime", 
                s.endtime::text as "endTime", 
                s.published,
                s.position_id as "positionId",
                p.name as position,
                p.color as "positionColor"
            FROM app.shifts s
            LEFT JOIN app.positions p ON s.position_id = p.id
            WHERE s.to_be_deleted = false
            AND s.date >= ${startDate}
            AND s.date <= ${endDate}
            ${userId ? sql`AND s.user_id = ${userId}` : sql``}
            ORDER BY s.date, s.starttime
        `;

        return NextResponse.json(shifts, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Shifts Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener turnos' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { userId, date, positionId, startTime, endTime, published } = body;

        // Basic validation
        if (!userId || !date || !positionId) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, date, positionId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Insert new shift  
        // Get next available ID
        const nextIdResult = await sql`
            SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM app.shifts
        `;
        const nextId = nextIdResult[0].next_id;

        const result = await sql`
            INSERT INTO app.shifts (
                id, user_id, position_id, date, starttime, endtime, published, to_be_deleted
            ) VALUES (
                ${nextId},
                ${userId}, 
                ${positionId}, 
                ${date}, 
                ${startTime || '00:00:00'}, 
                ${endTime || '00:00:00'}, 
                ${published ?? true}, 
                false
            )
            RETURNING id, user_id, position_id, date, starttime, endtime, published
        `;

        return NextResponse.json(result[0], { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Shifts Create Error:', error);
        return NextResponse.json(
            { error: 'Error creating shift' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
