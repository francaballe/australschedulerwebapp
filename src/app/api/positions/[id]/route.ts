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
        const { color, name, starttime, endtime } = body;

        // Validation: At least one field should be provided
        if (color === undefined && name === undefined && starttime === undefined && endtime === undefined) {
            return NextResponse.json(
                { error: 'No se proporcionan campos para actualizar' },
                { status: 400, headers: corsHeaders }
            );
        }

        const updateData: any = {};
        if (color !== undefined) updateData.color = color;
        if (name !== undefined) updateData.name = name;
        if (starttime !== undefined) {
            // For @db.Time fields in Prisma, create DateTime with dummy date
            if (starttime === null || starttime === '') {
                updateData.starttime = null;
            } else {
                // Create a DateTime with time portion for @db.Time field
                const [hours, minutes] = starttime.split(':');
                const timeDate = new Date('1970-01-01T' + starttime + ':00.000Z');
                updateData.starttime = timeDate;
            }
        }
        if (endtime !== undefined) {
            // For @db.Time fields in Prisma, create DateTime with dummy date
            if (endtime === null || endtime === '') {
                updateData.endtime = null;
            } else {
                // Create a DateTime with time portion for @db.Time field
                const [hours, minutes] = endtime.split(':');
                const timeDate = new Date('1970-01-01T' + endtime + ':00.000Z');
                updateData.endtime = timeDate;
            }
        }

        console.log('Updating position with data:', updateData);

        const updatedPosition = await prisma.position.update({
            where: { id: positionId },
            data: updateData,
        });

        console.log('Position updated successfully:', updatedPosition);
        return NextResponse.json(updatedPosition, { headers: corsHeaders });

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
