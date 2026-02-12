import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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
        // Build where clause dynamically
        const whereClause: any = {
            toBeDeleted: false,
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        };

        if (userId) {
            whereClause.userId = parseInt(userId);
        }

        // Using Prisma with relations instead of manual JOINs
        const shifts = await prisma.shift.findMany({
            where: whereClause,
            orderBy: [
                { date: 'asc' },
                { starttime: 'asc' }
            ],
            select: {
                id: true,
                date: true,
                userId: true,
                starttime: true,
                endtime: true,
                published: true,
                positionId: true,
                position: {
                    select: {
                        name: true,
                        color: true
                    }
                }
            }
        });

        type ShiftResult = typeof shifts[0];

        // Transform to match frontend expectations
        const transformedShifts = shifts.map((shift: ShiftResult) => ({
            id: shift.id,
            date: shift.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
            userId: shift.userId,
            startTime: shift.starttime ? 
                `${shift.starttime.getUTCHours().toString().padStart(2, '0')}:${shift.starttime.getUTCMinutes().toString().padStart(2, '0')}:${shift.starttime.getUTCSeconds().toString().padStart(2, '0')}` 
                : null,
            endTime: shift.endtime ? 
                `${shift.endtime.getUTCHours().toString().padStart(2, '0')}:${shift.endtime.getUTCMinutes().toString().padStart(2, '0')}:${shift.endtime.getUTCSeconds().toString().padStart(2, '0')}` 
                : null,
            published: shift.published,
            positionId: shift.positionId,
            position: shift.position?.name || null,
            positionColor: shift.position?.color || null
        }));

        return NextResponse.json(transformedShifts, { headers: corsHeaders });

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
        console.log('📝 Shift POST request body:', body);
        
        const { userId, date, positionId, startTime, endTime, published } = body;

        // Basic validation
        if (!userId || !date || !positionId) {
            console.error('❌ Missing required fields:', { userId, date, positionId });
            return NextResponse.json(
                { error: 'Missing required fields: userId, date, positionId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Parse and validate data
        const parsedUserId = parseInt(userId);
        const parsedPositionId = parseInt(positionId);
        
        if (isNaN(parsedUserId) || isNaN(parsedPositionId)) {
            console.error('❌ Invalid IDs:', { userId, positionId });
            return NextResponse.json(
                { error: 'Invalid userId or positionId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Fetch position to get its start and end times
        const position = await prisma.position.findUnique({
            where: { id: parsedPositionId },
            select: {
                id: true,
                name: true,
                starttime: true,
                endtime: true
            }
        });

        if (!position) {
            console.error('❌ Position not found:', parsedPositionId);
            return NextResponse.json(
                { error: `Position with ID ${parsedPositionId} not found` },
                { status: 404, headers: corsHeaders }
            );
        }

        console.log('📍 Position found:', position);

        // Prepare shift data with position's time values
        const shiftData: any = {
            userId: parsedUserId,
            positionId: parsedPositionId,
            date: new Date(date),
            published: published ?? false,
            toBeDeleted: false,
            // Copy start and end times from position
            starttime: position.starttime,
            endtime: position.endtime
        };

        // Override with provided times if any (optional)
        if (startTime) {
            shiftData.starttime = new Date(`1970-01-01T${startTime}`);
        }
        if (endTime) {
            shiftData.endtime = new Date(`1970-01-01T${endTime}`);
        }

        console.log('📤 Creating shift with data:', shiftData);

        // Using Prisma create instead of raw INSERT (auto-incrementing ID)
        const newShift = await prisma.shift.create({
            data: shiftData,
            select: {
                id: true,
                userId: true,
                positionId: true,
                date: true,
                starttime: true,
                endtime: true,
                published: true
            }
        });

        console.log('✅ Shift created successfully:', newShift);

        // Transform response to match expected format
        const response = {
            id: newShift.id,
            user_id: newShift.userId,
            position_id: newShift.positionId,
            date: newShift.date,
            starttime: newShift.starttime,
            endtime: newShift.endtime,
            published: newShift.published
        };

        return NextResponse.json(response, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('❌ API Shifts POST Error:', error);
        console.error('❌ Error details:', {
            message: error?.message,
            code: error?.code,
            stack: error?.stack
        });
        
        // Return more specific error message
        const errorMessage = error?.message || 'Unknown error occurred';
        return NextResponse.json(
            { 
                error: `Error al crear turno: ${errorMessage}`,
                details: error?.code ? `Code: ${error.code}` : 'No additional details'
            },
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
