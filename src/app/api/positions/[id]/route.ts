import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { id } = await params;
        const positionId = parseInt(id);

        if (isNaN(positionId)) {
            return NextResponse.json(
                { error: 'ID de posición no válido' },
                { status: 400, headers: corsHeaders }
            );
        }

        const body = await request.json();
        const { color, name, starttime, endtime, updateUnpublishedShifts, startDate, endDate, siteid } = body;

        // Validation: At least one field should be provided
        if (color === undefined && name === undefined && starttime === undefined && endtime === undefined && siteid === undefined) {
            return NextResponse.json(
                { error: 'No se proporcionan campos para actualizar' },
                { status: 400, headers: corsHeaders }
            );
        }

        const updateData: any = {};
        if (color !== undefined) updateData.color = color;
        if (name !== undefined) updateData.name = name;
        if (siteid !== undefined) updateData.siteid = siteid;

        // Helper to create Date from "HH:mm" string
        const createTimeDate = (timeStr: string) => {
            if (!timeStr) return null;
            return new Date('1970-01-01T' + timeStr + ':00.000Z');
        };

        if (starttime !== undefined) {
            updateData.starttime = starttime ? createTimeDate(starttime) : null;
        }
        if (endtime !== undefined) {
            updateData.endtime = endtime ? createTimeDate(endtime) : null;
        }

        console.log('Updating position with data:', updateData);

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update the position
            const updatedPos = await tx.position.update({
                where: { id: positionId },
                data: updateData,
            });

            // 2. If requested, update future/current unpublished shifts
            if (updateUnpublishedShifts && startDate && endDate && (starttime !== undefined || endtime !== undefined)) {
                console.log(`🔄 Bulk updating unpublished shifts for position ${positionId} between ${startDate} and ${endDate}`);

                // We need to fetch the shifts first to update their specific dates with new times
                // (Since Shift starttime/endtime are DateTimes including the date, not just Time)
                // Actually, based on shifts/route.ts, shift.starttime is a DateTime.
                // However, usually for "shifts", the date part matches shift.date.

                // Let's find all candidate shifts
                const shiftsToUpdate = await tx.shift.findMany({
                    where: {
                        positionId: positionId,
                        published: false,
                        date: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    }
                });

                console.log(`Found ${shiftsToUpdate.length} shifts to update`);

                for (const shift of shiftsToUpdate) {
                    const shiftDateStr = shift.date.toISOString().split('T')[0];
                    const newStart = starttime ? new Date(`${shiftDateStr}T${starttime}:00`) : null; // Local time construction... be careful with TZ
                    // Actually, the app seems to treat dates as local strings (YYYY-MM-DD). 
                    // But prisma stores as UTC. 
                    // api/shifts/route.ts uses `new Date(date)` for shift.date.
                    // And `new Date('1970-01-01T' + starttime)` for generic times in Post?
                    // Wait, `shifts/route.ts` creates shifts with `starttime: position?.starttime`.
                    // `position.starttime` is 1970-01-01 based on `api/positions`.
                    // So Shifts MIGHT have 1970-01-01 as date component if copied from position?
                    // Let's verify what shifts/route.ts does: 
                    // `starttime: position?.starttime ?? null` -> This uses the Position's 1970 date.
                    // `match frontend expectations (GET)`: `shift.starttime.getUTCHours()...` matches.

                    // SO: Shifts use 1970-01-01 for time-only fields if they just inherited from Position?
                    // OR do they use the shift's date?
                    // In `shifts/route.ts` POST:
                    // `if (startTime) shiftData.starttime = new Date('1970-01-01T' + startTime)`
                    // So YES, shifts use 1970-01-01 for time fields regardless of shift date.

                    // Conclusion: We can just set `starttime` and `endtime` to the same 1970 base values we prepared for the Position.
                    // We don't need to loop! We can use `updateMany`.
                }

                if (starttime !== undefined || endtime !== undefined) {
                    const shiftUpdateData: any = {};
                    if (starttime !== undefined) shiftUpdateData.starttime = updateData.starttime;
                    if (endtime !== undefined) shiftUpdateData.endtime = updateData.endtime;

                    const batchUpdate = await tx.shift.updateMany({
                        where: {
                            positionId: positionId,
                            published: false,
                            date: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        },
                        data: shiftUpdateData
                    });
                    console.log(`✨ Updated ${batchUpdate.count} shifts.`);
                }
            }

            return updatedPos;
        });

        console.log('Position updated successfully:', result);
        return NextResponse.json(result, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Position Update Error:', error);
        return NextResponse.json(
            { error: 'Error al actualizar la posición' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
