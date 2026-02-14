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
                toBeDeleted: true,
                positionId: true,
                position: {
                    select: {
                        name: true,
                        color: true
                    }
                }
            }
        });

        // Fetch unavailability records for the same date range
        const availabilityRecords = await prisma.userUnavailability.findMany({
            where: {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                },
            },
            select: {
                userId: true,
                date: true
            }
        });

        // Build a Set of "userId-date" keys for quick lookup
        const unavailableSet = new Set(
            availabilityRecords.map(r => `${r.userId}-${r.date.toISOString().split('T')[0]}`)
        );

        type ShiftResult = typeof shifts[0];

        // Transform to match frontend expectations
        const transformedShifts = shifts.map((shift: ShiftResult) => {
            const dateStr = shift.date.toISOString().split('T')[0];
            const isUserUnavailable = unavailableSet.has(`${shift.userId}-${dateStr}`);

            return {
                id: shift.id,
                date: dateStr,
                userId: shift.userId,
                startTime: shift.starttime ?
                    `${shift.starttime.getUTCHours().toString().padStart(2, '0')}:${shift.starttime.getUTCMinutes().toString().padStart(2, '0')}:${shift.starttime.getUTCSeconds().toString().padStart(2, '0')}`
                    : null,
                endTime: shift.endtime ?
                    `${shift.endtime.getUTCHours().toString().padStart(2, '0')}:${shift.endtime.getUTCMinutes().toString().padStart(2, '0')}:${shift.endtime.getUTCSeconds().toString().padStart(2, '0')}`
                    : null,
                published: shift.published,
                toBeDeleted: shift.toBeDeleted,
                isUserUnavailable,
                positionId: shift.positionId,
                position: shift.position?.name || null,
                positionColor: shift.position?.color || null
            };
        });

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
        if (userId == null || !date || positionId == null) {
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
            endtime: position.endtime,
        };

        // Override with provided times if any (optional)
        if (startTime) {
            shiftData.starttime = new Date(`1970-01-01T${startTime}`);
        }
        if (endTime) {
            shiftData.endtime = new Date(`1970-01-01T${endTime}`);
        }

        console.log('📤 Creating shift with data:', shiftData);

        // First, try to find existing shift for same user and date
        const existingShift = await prisma.shift.findFirst({
            where: {
                userId: parsedUserId,
                date: new Date(date),
                toBeDeleted: false
            }
        });

        let newShift;
        if (existingShift) {
            console.log('📝 Found existing shift, updating:', existingShift.id);
            // Update existing shift
            newShift = await prisma.shift.update({
                where: { id: existingShift.id },
                data: {
                    positionId: parsedPositionId,
                    starttime: position.starttime,
                    endtime: position.endtime,
                    published: published ?? false,
                    toBeDeleted: false,
                },
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
        } else {
            console.log('📝 No existing shift found, creating new one');
            // Ensure no ID is included in create data
            const createData = {
                userId: parsedUserId,
                positionId: parsedPositionId,
                date: new Date(date),
                published: published ?? false,
                toBeDeleted: false,
                starttime: position.starttime,
                endtime: position.endtime,
            };

            newShift = await prisma.shift.create({
                data: createData,
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
        }

        console.log('✅ Shift operation successful:', newShift);

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
            stack: error?.stack,
            name: error?.name,
            cause: error?.cause
        });

        // Return more specific error message based on error type
        let errorMessage = 'Unknown error occurred';
        let statusCode = 500;

        if (error?.code === 'P2002') {
            errorMessage = 'Ya existe un turno para este usuario en esta fecha';
            statusCode = 409; // Conflict
        } else if (error?.code === 'P2025') {
            errorMessage = 'Registro no encontrado';
            statusCode = 404;
        } else if (error?.code?.startsWith('P')) {
            errorMessage = `Database error: ${error.message}`;
        } else {
            errorMessage = error?.message || 'Error interno del servidor';
        }

        return NextResponse.json(
            {
                error: `Error al crear turno: ${errorMessage}`,
                details: error?.code ? `Code: ${error.code}` : 'No additional details',
                timestamp: new Date().toISOString()
            },
            { status: statusCode, headers: corsHeaders }
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
