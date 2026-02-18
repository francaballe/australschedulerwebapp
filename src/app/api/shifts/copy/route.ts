
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
            // We do not check for unavailability conflicts. We just clear the board for Shifts.
            // (UserUnavailability table is untouched and ignored)
            await tx.shift.deleteMany({
                where: {
                    date: {
                        gte: tDate,
                        lte: targetEnd
                    }
                }
            });

            // 2. Fetch source week shifts
            const sourceShifts = await tx.shift.findMany({
                where: {
                    date: {
                        gte: sDate,
                        lte: sourceEnd
                    },
                    // Safety: Exclude pure "Unavailable" records if they exist in Shift table (positionId=1)
                    // This ensures we don't copy unavailability, only actual shifts.
                    NOT: { positionId: 1 }
                }
            });

            // 3. Prepare new shifts
            if (sourceShifts.length > 0) {
                const newShifts = sourceShifts.map(s => {
                    const dayDiff = Math.floor((s.date.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
                    const newDate = new Date(tDate);
                    newDate.setDate(newDate.getDate() + dayDiff);

                    return {
                        userId: s.userId,
                        positionId: s.positionId,
                        date: newDate,
                        starttime: s.starttime,
                        endtime: s.endtime,
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
