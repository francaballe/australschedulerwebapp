
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { targetDate, sourceDate } = body;

        if (!targetDate || !sourceDate) {
            return NextResponse.json(
                { error: 'Dates required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const tDate = new Date(targetDate);
        const sDate = new Date(sourceDate);

        const targetEnd = new Date(tDate);
        targetEnd.setDate(targetEnd.getDate() + 6);
        targetEnd.setHours(23, 59, 59, 999);

        const sourceEnd = new Date(sDate);
        sourceEnd.setDate(sourceEnd.getDate() + 6);
        sourceEnd.setHours(23, 59, 59, 999);

        await prisma.$transaction(async (tx) => {
            // 1. Completely WIPE target week shifts
            await tx.shift.deleteMany({
                where: {
                    date: {
                        gte: tDate,
                        lte: targetEnd
                    }
                }
            });

            // 2. Fetch source week shifts WITH Position details
            const sourceShifts = await tx.shift.findMany({
                where: {
                    date: {
                        gte: sDate,
                        lte: sourceEnd
                    },
                    NOT: { positionId: 1 }
                },
                include: {
                    position: true // Fetch position to get current default times
                }
            });

            // 3. Prepare new shifts
            if (sourceShifts.length > 0) {
                const newShifts = sourceShifts.map(s => {
                    const dayDiff = Math.floor((s.date.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
                    const newDate = new Date(tDate);
                    newDate.setDate(newDate.getDate() + dayDiff);

                    let finalStartTime = s.starttime;
                    let finalEndTime = s.endtime;

                    // Logic: Use Position's default times if they exist.
                    // This "resets" any manual overrides from the previous week.
                    // IMPORTANT: We copy the Date object directly. Application uses 1970 epoch for times.
                    // We must NOT try to shift these times to the new date, as that breaks the standard.

                    if (s.position) {
                        if (s.position.starttime) {
                            finalStartTime = s.position.starttime;
                        }
                        if (s.position.endtime) {
                            finalEndTime = s.position.endtime;
                        }
                    }

                    return {
                        userId: s.userId,
                        positionId: s.positionId,
                        date: newDate,
                        starttime: finalStartTime,
                        endtime: finalEndTime,
                        published: false
                    };
                });

                await tx.shift.createMany({
                    data: newShifts
                });
            }
        });

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error) {
        console.error('Copy Error:', error);
        return NextResponse.json(
            { error: 'Error copying week' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
