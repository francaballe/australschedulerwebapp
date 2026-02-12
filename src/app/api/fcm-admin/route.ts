import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Endpoint para disparar limpieza manual
export async function POST() {
    try {
        // Llamar al endpoint de limpieza
        const cleanupUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cleanup-fcm-tokens`;

        const response = await fetch(cleanupUrl, {
            method: 'POST'
        });

        const result = await response.json();

        return NextResponse.json({
            success: true,
            message: 'Limpieza manual iniciada',
            cleanup: result
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: 'Error iniciando limpieza manual',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Obtener estadísticas generales usando Prisma
        const totalTokens = await prisma.userPushToken.count();
        const tokensWithUser = await prisma.userPushToken.count({
            where: {
                user: { id: { gte: 1 } } // Usuarios que existen
            }
        });

        // Obtener tokens recientes con info de usuario
        const recentTokens = await prisma.userPushToken.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        email: true,
                        firstname: true,
                        lastname: true
                    }
                }
            }
        });

        const stats = {
            totalTokens,
            tokensWithUser,
            tokensWithoutUser: totalTokens - tokensWithUser
        };

        return NextResponse.json({
            stats,
            recentTokens: recentTokens.map(t => ({
                id: t.id,
                token: t.token ? `${t.token.substring(0, 15)}...` : 'null',
                created_at: t.createdAt,
                email: t.user?.email || 'N/A',
                userName: t.user ? `${t.user.firstname} ${t.user.lastname}` : 'N/A'
            }))
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error in FCM Admin:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}