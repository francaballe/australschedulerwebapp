import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true,
            }
        });

        return NextResponse.json(roles, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Roles Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener roles' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
