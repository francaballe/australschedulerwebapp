import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Get query parameter to determine if we want admin positions only
        const adminOnly = request.nextUrl.searchParams.get('adminOnly') === 'true';
        const siteId = request.nextUrl.searchParams.get('siteId');

        // Build where clause - admin only positions exclude id <= 1
        const whereClause: any = {
            eliminated: false
        };

        if (adminOnly) {
            whereClause.id = {
                gt: 1  // Only positions with id > 1 for admin assignment
            };
        }

        if (siteId) {
            whereClause.siteid = Number(siteId);
        }

        // Using Prisma ORM instead of raw SQL
        const positionsRaw = await prisma.position.findMany({
            where: whereClause,
            orderBy: {
                id: 'asc'
            },
            select: {
                id: true,
                name: true,
                color: true,
                starttime: true,
                endtime: true
            }
        });

        // Format the times properly
        // Format the times properly and filter out 0 and 1 from DB if they still exist
        const dbPositions = positionsRaw
            .filter(p => p.id !== 0 && p.id !== 1)
            .map(pos => ({
                ...pos,
                starttime: pos.starttime ? pos.starttime.toISOString().slice(11, 16) : null,
                endtime: pos.endtime ? pos.endtime.toISOString().slice(11, 16) : null
            }));

        const positions = adminOnly
            ? dbPositions
            : [
                { id: 0, name: 'No Position', color: '#FFFFFF00', starttime: null, endtime: null, eliminated: false },
                { id: 1, name: 'Unavailable', color: '#CDCDCD', starttime: null, endtime: null, eliminated: false },
                ...dbPositions
            ];

        return NextResponse.json(positions, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Positions Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener posiciones' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { name, color, starttime, endtime, siteId } = body;

        if (!name || !siteId) {
            return NextResponse.json(
                { error: 'Name and Site ID are required' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Parse times if provided
        let startDateTime = null;
        let endDateTime = null;

        // Helper to create date objects from HH:MM strings (using arbitrary date)
        const timeToDate = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
        };

        if (starttime) startDateTime = timeToDate(starttime);
        if (endtime) endDateTime = timeToDate(endtime);

        const newPosition = await prisma.position.create({
            data: {
                name,
                color: color || '#94a3b8', // Default color if not provided
                starttime: startDateTime,
                endtime: endDateTime,
                siteid: Number(siteId),
                eliminated: false
            }
        });

        return NextResponse.json(newPosition, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('Create Position Error:', error);
        return NextResponse.json(
            { error: 'Error al crear la posición' },
            { status: 500, headers: corsHeaders }
        );
    }
}
