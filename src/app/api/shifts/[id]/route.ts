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
        const managerName = searchParams.get('managerName') || 'The manager';

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

        // 1. Fetch the shift to check its status (include position for notification details)
        const shift = await prisma.shift.findUnique({
            where: { id: idNumber },
            include: { position: true, user: { select: { email: true, firstname: true, isblocked: true, companyId: true } } }
        });

        if (!shift) {
            return NextResponse.json(
                { error: 'Shift not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        // 2. Notification Logic (if published, requested, and user is NOT blocked)
        if (shift.published && shouldNotify && !shift.user?.isblocked) {
            try {
                // Formatting Date and Time for Notifications (both Push and Email)
                const dateObj = new Date(shift.date);
                // Ensure we use UTC date parts to avoid timezone shifts if stored as UTC-midnight
                const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());

                // Format Date: "Mon, Jan 12" (matching publish style)
                const dateStr = utcDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                // Format Time: "4 PM to 10:30 PM"
                const formatTime = (date: Date | null) => {
                    if (!date) return '??';
                    // Assuming date is 1970-01-01THH:mm:ss.000Z
                    const hours = date.getUTCHours();
                    const minutes = date.getUTCMinutes();

                    const period = hours >= 12 ? 'PM' : 'AM';
                    const h = hours % 12 || 12; // 0 -> 12
                    const m = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;

                    return `${h}${m} ${period}`;
                };

                const startTime = formatTime(shift.starttime);
                const endTime = formatTime(shift.endtime);
                const timeStr = `${startTime} - ${endTime}`;

                const positionName = shift.position?.name || 'Default';

                const title = 'Shift Cancelled!';
                const introText = `The manager, ${managerName}, has cancelled your shift:`;
                // Full body for Push (fallback) - keep detailed using standardized formats
                const body = `${introText} ${dateStr} ${timeStr} at ${positionName}.`;

                console.log(`Sending cancellation notification to user ${shift.userId}:`, { title, body });

                const richBody = JSON.stringify({
                    isRich: true,
                    type: 'cancellation',
                    text: introText,
                    shifts: [{
                        dateStr: dateStr,
                        timeStr: timeStr,
                        positionName: positionName,
                        color: shift.position?.color || '#ef5350' // Use position color, fallback to red
                    }]
                });

                // 1. Save notification to database (Rich JSON)
                await prisma.message.create({
                    data: {
                        userId: shift.userId,
                        title: title,
                        body: richBody,
                        read: false,
                        createdAt: new Date(),
                        companyId: shift.user?.companyId
                    }
                });

                // 2. Get user's latest push token and Send Push Notification
                const tokenRecord = await prisma.userPushToken.findFirst({
                    where: { userId: shift.userId },
                    orderBy: { createdAt: 'desc' }
                });

                if (tokenRecord && tokenRecord.token) {
                    await import('@/lib/firebase-admin').then(mod =>
                        mod.sendPushNotification(tokenRecord.token, title, body)
                    ).catch(err => console.error('Error sending push:', err));
                }

                // 3. Send Email Notification
                if (shift.user?.email) {
                    const userName = shift.user.firstname || 'User';
                    const emailHtml = `
                      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #ef5350;">Shift Cancelled!</h2>
                        <p>Hi ${userName},</p>
                        <p>${introText}</p>
                        <div style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #ef5350; margin: 20px 0;">
                          <strong>Date:</strong> ${dateStr}<br/>
                          <strong>Time:</strong> ${timeStr}<br/>
                          <strong>Position:</strong> ${positionName}
                        </div>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                          This is an automated message from RosterLoop. Please do not reply to this email.
                        </div>
                      </div>
                    `;
                    await import('@/lib/email').then(mod =>
                        mod.sendEmail(shift.user.email!, title, body, emailHtml)
                    ).catch(err => console.error('Error sending email:', err));
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
        const { positionId, published, dropped, startTime, endTime, date, userId } = body;

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

        if (typeof dropped === 'boolean') {
            dataToUpdate.dropped = dropped;
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