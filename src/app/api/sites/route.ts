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
        const sites = await prisma.site.findMany({
            orderBy: {
                id: 'asc'
            },
            select: {
                id: true,
                name: true
            }
        });

        return NextResponse.json(sites, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Sites Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener sitios' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
