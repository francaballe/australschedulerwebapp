import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


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
                positionId: true,
                siteid: true,
                position: {
                    select: {
                        name: true,
                        color: true,
                        deleted: true
                    }
                },
                site: {
                    select: {
                        name: true
                    }
                }
            } as any
        }) as any[];

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
                isUserUnavailable,
                positionId: shift.positionId ?? 0,
                siteId: (shift as any).siteid,
                siteName: (shift as any).site?.name,
                position: shift.position?.name ?? (shift.positionId === null ? 'No Position' : null),
                positionColor: shift.position?.color ?? (shift.positionId === null ? '#FFFFFF00' : null),
                positionDeleted: shift.position?.deleted ?? false
            };
        });

        return NextResponse.json(transformedShifts, { headers: corsHeaders });

    } catch (error) {
        console.error('API Shifts Error RAW:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Error al obtener turnos', details: errMsg },
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

        const { userId, date, positionId, startTime, endTime, published, siteId } = body;

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
        let parsedPositionId: number | null = parseInt(positionId);
        const parsedSiteId: number | null = siteId ? parseInt(siteId) : null;

        if (isNaN(parsedUserId) || isNaN(parsedPositionId!)) {
            console.error('❌ Invalid IDs:', { userId, positionId });
            return NextResponse.json(
                { error: 'Invalid userId or positionId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Handle special positions
        if (parsedPositionId === 0) {
            parsedPositionId = null; // No Position matches null in DB
        } else if (parsedPositionId === 1) {
            return NextResponse.json(
                { error: 'Unavailable status must be managed via /api/availability' },
                { status: 400, headers: corsHeaders }
            );
        }

        let position = null;
        if (parsedPositionId !== null) {
            // Fetch position to get its start and end times
            position = await prisma.position.findUnique({
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
        } else {
            console.log('📍 Assigning "No Position" (ID 0 -> NULL)');
        }

        // Prepare shift data
        const shiftData: any = {
            userId: parsedUserId,
            positionId: parsedPositionId,
            date: new Date(date),
            published: published ?? false,
            siteid: parsedSiteId,
            // Copy start and end times from position if exists
            starttime: position?.starttime ?? null,
            endtime: position?.endtime ?? null,
        } as any;

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
                date: new Date(date)
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
                    starttime: shiftData.starttime,
                    endtime: shiftData.endtime,
                    published: published ?? false,
                    siteid: parsedSiteId
                } as any,
                select: {
                    id: true,
                    userId: true,
                    positionId: true,
                    date: true,
                    starttime: true,
                    endtime: true,
                    published: true,
                    siteid: true
                } as any
            });
        } else {
            console.log('📝 No existing shift found, creating new one');
            // Ensure no ID is included in create data
            const createData = {
                userId: parsedUserId,
                positionId: parsedPositionId,
                date: new Date(date),
                published: published ?? false,
                starttime: shiftData.starttime,
                endtime: shiftData.endtime,
                siteid: parsedSiteId
            };

            newShift = await prisma.shift.create({
                data: createData as any,
                select: {
                    id: true,
                    userId: true,
                    positionId: true,
                    date: true,
                    starttime: true,
                    endtime: true,
                    published: true,
                    siteid: true
                } as any
            });
        }

        console.log('✅ Shift operation successful:', newShift);

        // Transform response to match expected format
        const response = {
            id: newShift.id,
            user_id: newShift.userId,
            position_id: newShift.positionId ?? 0, // Map null back to 0
            date: newShift.date,
            starttime: newShift.starttime,
            endtime: newShift.endtime,
            published: newShift.published,
            siteId: (newShift as any).siteid
        };

        return NextResponse.json(response, { status: 201, headers: corsHeaders });

    } catch (error) {
        console.error('❌ API Shifts POST Error:', error);

        // Return more specific error message based on error type
        let errorMessage = 'Unknown error occurred';
        let statusCode = 500;
        const prismaError = error as { code?: string; message?: string };

        if (prismaError.code === 'P2002') {
            errorMessage = 'Ya existe un turno para este usuario en esta fecha';
            statusCode = 409; // Conflict
        } else if (prismaError.code === 'P2025') {
            errorMessage = 'Registro no encontrado';
            statusCode = 404;
        } else if (prismaError.code?.startsWith('P')) {
            errorMessage = `Database error: ${prismaError.message}`;
        } else {
            errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
        }

        return NextResponse.json(
            {
                error: `Error al crear turno: ${errorMessage}`,
                details: prismaError.code ? `Code: ${prismaError.code}` : 'No additional details',
                timestamp: new Date().toISOString()
            },
            { status: statusCode, headers: corsHeaders }
        );
    }
}


export async function DELETE(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const siteId = searchParams.get('siteId');

    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: 'startDate and endDate parameters are required' },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const whereClause: any = {
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        };

        if (siteId) {
            whereClause.siteid = parseInt(siteId);
        }

        // --- Notification Logic ---
        const shouldNotify = searchParams.get('notify') === 'true';

        if (shouldNotify) {
            try {
                // 1. Find all PUBLISHED shifts that are about to be deleted
                const shiftsToDelete = await prisma.shift.findMany({
                    where: {
                        ...whereClause,
                        published: true
                    },
                    include: {
                        position: true
                    }
                });

                if (shiftsToDelete.length > 0) {
                    console.log(`📢 Found ${shiftsToDelete.length} published shifts to notify about.`);

                    // 2. Group shifts by userId
                    const shiftsByUser = new Map<number, typeof shiftsToDelete>();
                    shiftsToDelete.forEach(shift => {
                        const existing = shiftsByUser.get(shift.userId) || [];
                        existing.push(shift);
                        shiftsByUser.set(shift.userId, existing);
                    });

                    // 3. Process each user
                    for (const [userId, userShifts] of shiftsByUser) {
                        try {
                            // Get user's latest push token
                            const tokenRecord = await prisma.userPushToken.findFirst({
                                where: { userId: userId },
                                orderBy: { createdAt: 'desc' }
                            });

                            if (tokenRecord && tokenRecord.token) {
                                console.log(`📱 Found push token for user ${userId}:`, tokenRecord.token.substring(0, 10) + '...');

                                // Sort shifts chronologically
                                userShifts.sort((a, b) => {
                                    const dateA = new Date(a.date).getTime();
                                    const dateB = new Date(b.date).getTime();
                                    if (dateA !== dateB) return dateA - dateB;

                                    // If same date, sort by start time
                                    const timeA = a.starttime ? new Date(a.starttime).getTime() : 0;
                                    const timeB = b.starttime ? new Date(b.starttime).getTime() : 0;
                                    return timeA - timeB;
                                });

                                // Format shifts for the message
                                const formattedShifts = userShifts.map(shift => {
                                    const dateObj = new Date(shift.date);
                                    // Ensure UTC date parts
                                    const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
                                    const dateStr = utcDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' });

                                    const formatTime = (date: Date | null) => {
                                        if (!date) return '??';
                                        const hours = date.getUTCHours();
                                        const minutes = date.getUTCMinutes();
                                        const period = hours >= 12 ? 'PM' : 'AM';
                                        // Fix: 12 PM should be 12, not 0
                                        let h = hours % 12;
                                        h = h ? h : 12;
                                        const m = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
                                        return `${h}${m} ${period}`;
                                    };

                                    const timeStr = `${formatTime(shift.starttime)} - ${formatTime(shift.endtime)}`;
                                    const positionName = shift.position?.name || 'Default';

                                    return {
                                        dateStr,
                                        timeStr,
                                        positionName,
                                        color: shift.position?.color || '#ef5350'
                                    };
                                });

                                // Sort by date/time for the message
                                formattedShifts.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

                                const innerTitle = userShifts.length > 1 ? 'Turnos Cancelados' : 'Turno Cancelado';
                                const title = `¡${innerTitle}!`; // Use same logic for outer title

                                const introText = `Se han cancelado ${userShifts.length} turnos de tu cronograma.`;
                                const body = `${introText} Revisa la app para más detalles.`;

                                const richBody = JSON.stringify({
                                    isRich: true,
                                    type: 'cancellation', // Red Alert style
                                    title: innerTitle, // Try to override the default title
                                    text: introText,
                                    shifts: formattedShifts
                                });

                                // Save to DB
                                await prisma.message.create({
                                    data: {
                                        userId: userId,
                                        title: title,
                                        body: richBody, // Use richBody for in-app view
                                        read: false,
                                        createdAt: new Date()
                                    }
                                });

                                // Send Push
                                await import('@/lib/firebase-admin').then(mod =>
                                    mod.sendPushNotification(tokenRecord.token, title, body)
                                ).catch(err => console.error('Error sending push:', err));

                                console.log(`✅ Notification sent to user ${userId} for ${userShifts.length} shifts.`);
                            }
                        } catch (userError) {
                            console.error(`❌ Error notifying user ${userId}:`, userError);
                        }
                    }
                }
            } catch (notifyError) {
                console.error('❌ Error in bulk notification process:', notifyError);
                // Don't block deletion on notification failure
            }
        }

        const result = await prisma.shift.deleteMany({
            where: whereClause
        });

        console.log(`🗑️ Deleted ${result.count} shifts between ${startDate} and ${endDate}`);

        return NextResponse.json({ success: true, count: result.count }, { headers: corsHeaders });

    } catch (error) {
        console.error('❌ API Shifts DELETE Error:', error);
        return NextResponse.json(
            { error: 'Error al eliminar turnos' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
