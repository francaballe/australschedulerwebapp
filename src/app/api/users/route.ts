import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Get optional siteId filter from query params
        const siteIdParam = request.nextUrl.searchParams.get('siteId');
        
        // Build where clause dynamically
        const whereClause: any = {
            isblocked: false
        };

        if (siteIdParam) {
            whereClause.siteid = Number(siteIdParam);
        }

        // Using Prisma ORM with conditional filtering
        const users = await prisma.user.findMany({
            where: whereClause,
            orderBy: [
                { lastname: 'asc' },
                { firstname: 'asc' }
            ],
            select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
                userroleid: true,
                siteid: true
            }
        });

        // Transform to match frontend expectations (camelCase)
        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            roleId: user.userroleid,
            siteId: user.siteid
        }));

        return NextResponse.json(formattedUsers, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener usuarios' },
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
