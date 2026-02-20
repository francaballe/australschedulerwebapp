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

        const updateData: Record<string, unknown> = {};
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


                if (starttime !== undefined || endtime !== undefined) {
                    const shiftUpdateData: Record<string, unknown> = {};
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

    } catch (error) {
        console.error('API Position Update Error:', error);
        return NextResponse.json(
            { error: 'Error al actualizar la posición' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, PATCH, OPTIONS',
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

        const url = new URL(request.url);
        const confirm = url.searchParams.get('confirm') === 'true';

        // Check for any shifts associated with this position
        const shiftsCount = await prisma.shift.count({
            where: { positionId }
        });

        if (shiftsCount === 0) {
            // HARD DELETE: No shifts ever existed
            await prisma.position.delete({
                where: { id: positionId }
            });
            return NextResponse.json({ success: true, hardDeleted: true }, { headers: corsHeaders });
        }

        // Shifts exist. We need to check if there are any from today onwards.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureShiftsCount = await prisma.shift.count({
            where: {
                positionId,
                date: {
                    gte: today
                }
            }
        });

        if (futureShiftsCount > 0 && !confirm) {
            // Require user confirmation before soft deleting and wiping future shifts
            return NextResponse.json(
                {
                    requireConfirmation: true,
                    futureShiftsCount
                },
                { status: 409, headers: corsHeaders }
            );
        }

        // SOFT DELETE: Proceed to mark as deleted and wipe future/today shifts
        await prisma.$transaction(async (tx) => {
            // Soft delete the position
            await tx.position.update({
                where: { id: positionId },
                data: { deleted: true }
            });

            // Delete future and today shifts
            if (futureShiftsCount > 0) {
                await tx.shift.deleteMany({
                    where: {
                        positionId,
                        date: {
                            gte: today
                        }
                    }
                });
            }
        });

        return NextResponse.json({ success: true, softDeleted: true }, { headers: corsHeaders });

    } catch (error) {
        console.error('API Position Delete Error:', error);
        return NextResponse.json(
            { error: 'Error al eliminar la posición' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
