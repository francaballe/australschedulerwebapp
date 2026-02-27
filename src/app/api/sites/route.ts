import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');
        const roleIdParam = searchParams.get('roleId');

        if (!userIdParam || !roleIdParam) {
            return NextResponse.json(
                { error: 'userId y roleId son requeridos' },
                { status: 400, headers: corsHeaders }
            );
        }

        const userId = parseInt(userIdParam, 10);
        const roleId = parseInt(roleIdParam, 10);

        let whereClause = {};

        // If roleId is 1 (Admin), filter by UserSiteAccess
        // If roleId is 0 (Owner), no filter (all sites)
        if (roleId === 1) {
            whereClause = {
                userAccess: {
                    some: {
                        userId: userId
                    }
                }
            };
        }

        const sites = await prisma.site.findMany({
            where: whereClause,
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
        console.error('API Sites GET Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener sitios' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { name } = body;

        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'El nombre del sitio es requerido' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Check for duplicates
        const existing = await prisma.site.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe un sitio con este nombre' },
                { status: 400, headers: corsHeaders }
            );
        }

        const newSite = await prisma.site.create({
            data: {
                name: name.trim()
            }
        });

        return NextResponse.json(newSite, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Sites POST Error:', error);
        return NextResponse.json(
            { error: 'Error al crear el sitio' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function PUT(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { id, name } = body;

        if (!id || !name?.trim()) {
            return NextResponse.json(
                { error: 'ID y nombre son requeridos' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Check for duplicates (excluding self)
        const existing = await prisma.site.findFirst({
            where: {
                name: { equals: name.trim(), mode: 'insensitive' },
                id: { not: id }
            }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe otro sitio con este nombre' },
                { status: 400, headers: corsHeaders }
            );
        }

        const updatedSite = await prisma.site.update({
            where: { id },
            data: { name: name.trim() }
        });

        return NextResponse.json(updatedSite, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Sites PUT Error:', error);
        return NextResponse.json(
            { error: 'Error al actualizar el sitio' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { searchParams } = new URL(request.url);
        const idParam = searchParams.get('id');

        if (!idParam) {
            return NextResponse.json(
                { error: 'ID es requerido' },
                { status: 400, headers: corsHeaders }
            );
        }

        const id = parseInt(idParam, 10);

        // Validations: Check dependencies
        const shiftsCount = await prisma.shift.count({
            where: { siteid: id }
        });
        const positionsCount = await prisma.position.count({
            where: { siteid: id }
        });

        if (shiftsCount > 0 || positionsCount > 0) {
            return NextResponse.json(
                { error: `No se puede eliminar el sitio porque tiene ${shiftsCount} turnos y ${positionsCount} posiciones asociados.` },
                { status: 400, headers: corsHeaders }
            );
        }

        await prisma.site.delete({
            where: { id }
        });

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Sites DELETE Error:', error);
        return NextResponse.json(
            { error: 'Error al eliminar el sitio' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
