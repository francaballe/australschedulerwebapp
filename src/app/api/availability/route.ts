import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// GET /api/availability?userId=X&startDate=Y&endDate=Z
// Returns array of { userId, date, available } for the given range
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: 'startDate and endDate are required' },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const where: any = {
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
            available: false, // Only return unavailable entries (available=true is the default)
        };

        if (userId) {
            where.userId = parseInt(userId);
        }

        const records = await prisma.userAvailability.findMany({
            where,
            select: {
                userId: true,
                date: true,
                available: true,
            },
        });

        const result = records.map(r => ({
            userId: r.userId,
            date: r.date.toISOString().split('T')[0],
            available: r.available,
        }));

        return NextResponse.json(result, { headers: corsHeaders });
    } catch (error: any) {
        console.error('API Availability GET Error:', error);
        return NextResponse.json(
            { error: 'Error fetching availability' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// POST /api/availability  { userId, date, available }
// Upserts availability for a user on a given date
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, date, available } = body;

        if (userId == null || !date || available == null) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, date, available' },
                { status: 400, headers: corsHeaders }
            );
        }

        const parsedUserId = parseInt(userId);
        const parsedDate = new Date(date);

        if (isNaN(parsedUserId)) {
            return NextResponse.json(
                { error: 'Invalid userId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Upsert: create or update
        const record = await prisma.userAvailability.upsert({
            where: {
                userId_date: {
                    userId: parsedUserId,
                    date: parsedDate,
                },
            },
            update: {
                available: Boolean(available),
            },
            create: {
                userId: parsedUserId,
                date: parsedDate,
                available: Boolean(available),
            },
        });

        return NextResponse.json(
            {
                userId: record.userId,
                date: record.date.toISOString().split('T')[0],
                available: record.available,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('API Availability POST Error:', error);
        return NextResponse.json(
            { error: 'Error updating availability' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
