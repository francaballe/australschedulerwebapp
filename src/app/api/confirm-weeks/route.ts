import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to get the start of week (Sunday)
function getWeekStartDate(date: Date): Date {
    // Create date without timezone issues
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day); // month is 0-indexed

    const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = dayOfWeek; // Days to subtract to get to Sunday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0); // Ensure time is reset
    return d;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (!userId) {
        return NextResponse.json(
            { error: 'userId parameter is required' },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        let queryResult;
        const parsedUserId = parseInt(userId);

        console.log('🔍 API: GET confirm-weeks - userId:', userId, 'date:', date);

        if (date) {
            const weekStartDate = getWeekStartDate(new Date(date));

            queryResult = await prisma.confirmedWeek.findMany({
                where: {
                    userId: parsedUserId,
                    date: weekStartDate
                },
                orderBy: {
                    date: 'desc'
                }
            });
        } else {
            queryResult = await prisma.confirmedWeek.findMany({
                where: {
                    userId: parsedUserId
                },
                orderBy: {
                    date: 'desc'
                }
            });
        }

        return NextResponse.json(queryResult || [], { headers: corsHeaders });
    } catch (error) {
        console.error('Failed to fetch confirmed weeks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch confirmed weeks', details: error instanceof Error ? error.message : String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('📅 POST /api/confirm-weeks - Starting...');

        const body = await request.json();
        const { userId, date } = body;

        console.log('📅 Received data:', { userId, date });

        if (!userId || !date) {
            console.log('❌ Missing required fields');
            return NextResponse.json(
                { error: 'userId and date are required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const parsedUserId = parseInt(userId);
        const weekStartDate = getWeekStartDate(new Date(date));
        console.log('📅 Week start date calculated:', weekStartDate);

        // Usar upsert o findFirst + update/create con Prisma
        // Para coincidir con la lógica original de raw SQL
        const existing = await prisma.confirmedWeek.findFirst({
            where: {
                userId: parsedUserId,
                date: weekStartDate
            }
        });

        if (existing) {
            console.log('📅 Updating existing confirmation with Prisma...');
            await prisma.confirmedWeek.update({
                where: { id: existing.id },
                data: { confirmed: true }
            });

            return NextResponse.json(
                {
                    message: 'Week confirmation updated successfully',
                    confirmed: true,
                    weekStartDate: weekStartDate.toISOString().split('T')[0]
                },
                { headers: corsHeaders }
            );
        } else {
            console.log('📅 Creating new confirmation with Prisma...');
            await prisma.confirmedWeek.create({
                data: {
                    userId: parsedUserId,
                    date: weekStartDate,
                    confirmed: true
                }
            });

            return NextResponse.json(
                {
                    message: 'Week confirmed successfully',
                    confirmed: true,
                    weekStartDate: weekStartDate.toISOString().split('T')[0]
                },
                { headers: corsHeaders }
            );
        }

    } catch (error) {
        console.error('❌ Failed to confirm week - Full error:', error);
        return NextResponse.json(
            {
                error: 'Failed to confirm week',
                details: error instanceof Error ? error.message : String(error),
                type: error instanceof Error ? error.name : 'Unknown'
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
