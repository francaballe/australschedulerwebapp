
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

            // 2. Fetch existing shifts in the TARGET week (after deletion) to detect collisions (e.g. shifts from other sites)
            const existingTargetShifts = await tx.shift.findMany({
                where: {
                    date: {
                        gte: tDate,
                        lte: targetEnd
                    }
                },
                select: {
                    userId: true,
                    date: true
                }
            });

            // Create a Set of occupied slots: "userId-YYYY-MM-DD"
            const occupiedSlots = new Set(
                existingTargetShifts.map(s => {
                    const d = new Date(s.date);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${s.userId}-${year}-${month}-${day}`;
                })
            );

            // 3. Fetch source week shifts WITH Position details (for specific site if provided)
            const sourceShifts = await tx.shift.findMany({
                where: sourceWhere,
                include: {
                    position: true // Fetch position to get current default times
                }
            });

            // 4. Prepare new shifts, filtering out collisions
            if (sourceShifts.length > 0) {
                const newShifts = sourceShifts
                    .map(s => {
                        // Use round instead of floor to avoid floating point issues (e.g. 0.999 -> 1)
                        const dayDiff = Math.round((s.date.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
                        const newDate = new Date(tDate);
                        newDate.setDate(newDate.getDate() + dayDiff);
                        // REMOVED: newDate.setHours(0, 0, 0, 0); - This was incorrectly setting local midnight, shifting UTC dates.
                        // We rely on newDate being derived from tDate (UTC) and s.date (UTC) to stay aligned.

                        // Check collision
                        const year = newDate.getFullYear();
                        const month = String(newDate.getMonth() + 1).padStart(2, '0');
                        const day = String(newDate.getDate()).padStart(2, '0');
                        const key = `${s.userId}-${year}-${month}-${day}`;

                        if (occupiedSlots.has(key)) {
                            return null; // Skip this shift as the slot is occupied by another site
                        }

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
                    })
                    .filter((s): s is NonNullable<typeof s> => s !== null);

                if (newShifts.length > 0) {
                    await tx.shift.createMany({
                        data: newShifts as any
                    });
                }
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
