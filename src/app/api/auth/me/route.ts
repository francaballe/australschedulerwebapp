import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                id: parseInt(id)
            },
            include: {
                company: true
            } as any
        });

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (user.isblocked) {
            return NextResponse.json({ error: 'Usuario bloqueado' }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstname,
                lastName: user.lastname,
                roleId: user.userroleid,
                companyId: (user as any).companyId,
                companyName: (user as any).company?.name || null
            }
        });

    } catch (error) {
        console.error('API Auth Me Error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
