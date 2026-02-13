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
        const { color, name } = body;

        // Validation: At least one field should be provided
        if (color === undefined && name === undefined) {
            return NextResponse.json(
                { error: 'No se proporcionan aplicaciones para actualizar' },
                { status: 400, headers: corsHeaders }
            );
        }

        const updateData: any = {};
        if (color !== undefined) updateData.color = color;
        if (name !== undefined) updateData.name = name;

        const updatedPosition = await prisma.position.update({
            where: { id: positionId },
            data: updateData,
        });

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
