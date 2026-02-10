import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        console.log('DELETE request received');
        
        // Await params in newer Next.js versions
        const resolvedParams = await params;
        console.log('Resolved params:', resolvedParams);
        
        const shiftId = resolvedParams.id;
        console.log('ID from params:', shiftId);

        if (!shiftId) {
            console.log('No shift ID provided');
            return NextResponse.json(
                { error: 'No shift ID provided' },
                { status: 400, headers: corsHeaders }
            );
        }

        const idNumber = Number(shiftId);
        if (isNaN(idNumber)) {
            console.log('Invalid shift ID format:', shiftId);
            return NextResponse.json(
                { error: 'Invalid shift ID format' },
                { status: 400, headers: corsHeaders }
            );
        }

        console.log('Deleting shift with ID:', idNumber);

        // Delete the shift
        const result = await sql`
            DELETE FROM app.shifts 
            WHERE id = ${idNumber}
            RETURNING id
        `;

        console.log('Delete result:', result);

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Shift not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { message: 'Shift deleted successfully', id: result[0].id }, 
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error('API Shifts Delete Error:', error);
        return NextResponse.json(
            { error: 'Error deleting shift' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}