import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    // Headers CORS - Permitir Vercel y APK
    const origin = request.headers.get('origin');
    const allowedOrigins = [
        'http://localhost:9000',
        'https://australschedulerwebapp.vercel.app',
        'file://', // Para APK
        'null' // Para APK también
    ];

    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { email, token } = await request.json();

        if (!email || !token) {
            return NextResponse.json(
                { error: 'Email and token are required' },
                { status: 400, headers }
            );
        }

        // Verificar que el usuario existe usando Prisma
        const user = await prisma.user.findFirst({
            where: { email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404, headers }
            );
        }

        const userId = user.id;

        // Usar upsert para manejar el token del usuario (eliminar antiguos e insertar nuevo en una operación)
        // O simplemente borrar y crear si queremos mantener la lógica original exactamente
        await prisma.userPushToken.deleteMany({
            where: { userId }
        });

        await prisma.userPushToken.create({
            data: {
                userId,
                token,
                createdAt: new Date()
            }
        });

        return NextResponse.json({
            message: 'Push token registered successfully'
        }, { headers });

    } catch (error) {
        console.error('Error registering push token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

export async function GET(request: NextRequest) {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400, headers }
            );
        }

        // Obtener el token del usuario usando Prisma con relación
        const result = await prisma.userPushToken.findFirst({
            where: {
                user: {
                    email: email
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                token: true,
                createdAt: true
            }
        });

        if (!result) {
            return NextResponse.json(
                { error: 'No push token found for this user' },
                { status: 404, headers }
            );
        }

        return NextResponse.json({
            token: result.token,
            created_at: result.createdAt // Mantengo el nombre de la propiedad de salida si es necesario, pero uso el campo correcto
        }, { headers });

    } catch (error) {
        console.error('Error fetching push token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

export async function DELETE(request: NextRequest) {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400, headers }
            );
        }

        // Eliminar token usando Prisma
        const user = await prisma.user.findFirst({
            where: { email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json(
                { message: 'User not found, nothing to delete' },
                { status: 200, headers }
            );
        }

        await prisma.userPushToken.deleteMany({
            where: { userId: user.id }
        });

        return NextResponse.json({
            message: 'Push token deleted successfully'
        }, { headers });

    } catch (error) {
        console.error('Error deleting push token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
