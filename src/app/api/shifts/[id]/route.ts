import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure this import path is correct for your project structure

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Await params in newer Next.js versions
        const resolvedParams = await params;
        const shiftId = resolvedParams.id;

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

        let result;
        let action = '';

        // 2. Deletion Logic
        if (!shift.published) {
            // Hard delete if not yet published
            console.log(`Physically deleting shift ${idNumber}`);
            result = await prisma.shift.delete({
                where: { id: idNumber }
            });
            action = 'deleted';
        } else {
            // Soft delete for published regular shifts
            console.log(`Marking published shift ${idNumber} for deletion`);
            result = await prisma.shift.update({
                where: { id: idNumber },
                data: { toBeDeleted: true }
            });
            action = 'marked_for_deletion';
        }

        return NextResponse.json(
            { message: 'Shift processed successfully', id: result.id, action: action, status: result },
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

        // Find existing shift
        const shift = await prisma.shift.findUnique({
            where: { id: idNumber }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404, headers: corsHeaders });
        }

        // If positionId is being updated, also update starttime/endtime from the position
        const updateData = { ...body };
        if (body.positionId) {
            const position = await prisma.position.findUnique({
                where: { id: body.positionId }
            });
            if (position) {
                updateData.starttime = position.starttime;
                updateData.endtime = position.endtime;
            }
        }

        // Update shift
        const updatedShift = await prisma.shift.update({
            where: { id: idNumber },
            data: updateData
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