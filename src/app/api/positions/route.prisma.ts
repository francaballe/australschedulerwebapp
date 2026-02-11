import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Using Prisma ORM instead of raw SQL
        const positions = await prisma.position.findMany({
            where: {
                eliminated: false
            },
            orderBy: {
                id: 'asc'
            },
            select: {
                id: true,
                name: true,
                color: true
            }
        });

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
    return NextResponse.json(
        {},
        {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        }
    );
}