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
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = dayOfWeek; // Days to subtract to get to Sunday
    d.setDate(d.getDate() - diff);
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
        
        // If date is provided, get the confirmation status for that specific week
        if (date) {
            const weekStartDate = getWeekStartDate(new Date(date));
            queryResult = await prisma.$queryRaw`
                SELECT * FROM app.confirmedweeks 
                WHERE user_id = ${parseInt(userId)} AND date = ${weekStartDate}
                ORDER BY date DESC
            `;
        } else {
            queryResult = await prisma.$queryRaw`
                SELECT * FROM app.confirmedweeks 
                WHERE user_id = ${parseInt(userId)}
                ORDER BY date DESC
            `;
        }

        return NextResponse.json(queryResult || [], { headers: corsHeaders });
    } catch (error) {
        console.error('Failed to fetch confirmed weeks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch confirmed weeks', details: error.message },
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

        // Calculate the start of the week (Sunday)
        const weekStartDate = getWeekStartDate(new Date(date));
        console.log('📅 Week start date calculated:', weekStartDate);

        // Use raw SQL to avoid Prisma type issues
        console.log('📅 Checking existing confirmation with raw SQL...');
        const existingResult = await prisma.$queryRaw`
            SELECT * FROM app.confirmedweeks 
            WHERE user_id = ${parseInt(userId)} AND date = ${weekStartDate}
        `;
        
        console.log('📅 Existing confirmation result:', existingResult);

        if (existingResult && Array.isArray(existingResult) && existingResult.length > 0) {
            console.log('📅 Updating existing confirmation with raw SQL...');
            const updateResult = await prisma.$executeRaw`
                UPDATE app.confirmedweeks 
                SET confirmed = true 
                WHERE user_id = ${parseInt(userId)} AND date = ${weekStartDate}
            `;

            console.log('✅ Week confirmation updated, rows affected:', updateResult);
            return NextResponse.json(
                { 
                    message: 'Week confirmation updated successfully',
                    confirmed: true,
                    weekStartDate: weekStartDate.toISOString().split('T')[0]
                },
                { headers: corsHeaders }
            );
        } else {
            console.log('📅 Creating new confirmation with raw SQL...');
            const insertResult = await prisma.$executeRaw`
                INSERT INTO app.confirmedweeks (user_id, date, confirmed) 
                VALUES (${parseInt(userId)}, ${weekStartDate}, true)
            `;

            console.log('✅ Week confirmed successfully, rows affected:', insertResult);
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
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        return NextResponse.json(
            { 
                error: 'Failed to confirm week',
                details: error.message,
                type: error.name
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}