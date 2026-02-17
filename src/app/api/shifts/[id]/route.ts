import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure this import path is correct for your project structure

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const resolvedParams = await params;
        const shiftId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const shouldNotify = searchParams.get('notify') === 'true';

        if (!shiftId) {
            return NextResponse.json(
                { error: 'No shift ID provided' },
                { status: 400, headers: corsHeaders }
            );
        }

        const idNumber = Number(shiftId);
        if (isNaN(idNumber)) {
            return NextResponse.json(
                { error: 'Invalid shift ID format' },
                { status: 400, headers: corsHeaders }
            );
        }

        // 1. Fetch the shift to check its status
        const shift = await prisma.shift.findUnique({
            where: { id: idNumber }
        });

        if (!shift) {
            return NextResponse.json(
                { error: 'Shift not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        // 2. Notification Logic (if published and requested)
        if (shift.published && shouldNotify) {
            try {
                // Get user's latest push token
                const tokenRecord = await prisma.userPushToken.findFirst({
                    where: { userId: shift.userId },
                    orderBy: { createdAt: 'desc' }
                });

                if (tokenRecord && tokenRecord.token) {
                    const dateStr = new Date(shift.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                    const title = 'Turno Eliminado';
                    const body = `Se ha eliminado tu turno del día ${dateStr}`;

                    // Send notification (don't block deletion on failure)
                    await import('@/lib/firebase-admin').then(mod =>
                        mod.sendPushNotification(tokenRecord.token, title, body)
                    ).catch(err => console.error('Error sending push:', err));
                }
            } catch (notifyError) {
                console.error('Error in notification process:', notifyError);
            }
        }

        // 3. HARD DELETE (Always)
        console.log(`Physically deleting shift ${idNumber}`);
        const result = await prisma.shift.delete({
            where: { id: idNumber }
        });

        return NextResponse.json(
            { message: 'Shift deleted successfully', id: result.id, action: 'deleted', status: result },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error('API Shifts Delete Error:', error);
        return NextResponse.json(
            { error: 'Error processing shift deletion' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const resolvedParams = await params;
        const shiftId = resolvedParams.id;

        if (!shiftId) {
            return NextResponse.json({ error: 'No shift ID provided' }, { status: 400, headers: corsHeaders });
        }

        const idNumber = Number(shiftId);
        if (isNaN(idNumber)) {
            return NextResponse.json({ error: 'Invalid shift ID format' }, { status: 400, headers: corsHeaders });
        }

        const body = await request.json();
        const { positionId, published, startTime, endTime, date, userId } = body;

        // Find existing shift
        const shift = await prisma.shift.findUnique({
            where: { id: idNumber }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404, headers: corsHeaders });
        }

        const dataToUpdate: any = {};

        if (typeof published === 'boolean') {
            dataToUpdate.published = published;
        }

        // Handle Move (Date/User change)
        if (date) {
            dataToUpdate.date = new Date(date);
        }
        if (userId) {
            dataToUpdate.userId = Number(userId);
        }

        // Helper to create Date from "HH:mm"
        const createDateFromTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(0); // 1970-01-01 epoch
            date.setUTCHours(hours, minutes, 0, 0);
            return date;
        };

        // 1. Handle explicit time updates from request
        if (startTime) dataToUpdate.starttime = createDateFromTime(startTime);
        if (endTime) dataToUpdate.endtime = createDateFromTime(endTime);

        // 2. Handle Position Change
        if (positionId) {
            dataToUpdate.position = { connect: { id: Number(positionId) } };

            // If explicit times were NOT provided, fallback to position defaults
            if (!startTime || !endTime) {
                const position = await prisma.position.findUnique({
                    where: { id: Number(positionId) }
                });

                if (position) {
                    if (!startTime) dataToUpdate.starttime = position.starttime;
                    if (!endTime) dataToUpdate.endtime = position.endtime;
                }
            }
        }

        // Update shift
        const updatedShift = await prisma.shift.update({
            where: { id: idNumber },
            data: dataToUpdate
        });

        return NextResponse.json(updatedShift, { status: 200, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Shifts Patch Error:', error);
        return NextResponse.json(
            { error: 'Error updating shift' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}