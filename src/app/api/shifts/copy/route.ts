
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
        const { targetDate, sourceDate, siteId } = body;

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

        const deleteWhere: any = {
            date: {
                gte: tDate,
                lte: targetEnd
            }
        };

        const sourceWhere: any = {
            date: {
                gte: sDate,
                lte: sourceEnd
            },
            NOT: { positionId: 1 }
        };

        if (siteId) {
            const parsedSiteId = parseInt(siteId);
            deleteWhere.siteid = parsedSiteId;
            sourceWhere.siteid = parsedSiteId;
        }

        await prisma.$transaction(async (tx) => {
            // 1. Completely WIPE target week shifts (for specific site if provided)
            await tx.shift.deleteMany({
                where: deleteWhere
            });

            // 2. Fetch source week shifts WITH Position details (for specific site if provided)
            const sourceShifts = await tx.shift.findMany({
                where: sourceWhere,
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
                        published: false,
                        siteid: (s as any).siteid
                    };
                });

                await tx.shift.createMany({
                    data: newShifts as any
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
