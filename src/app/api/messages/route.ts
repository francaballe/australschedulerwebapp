import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/firebase-admin';

// CORS headers helper
function getCorsHeaders(origin?: string | null) {
    const allowedOrigins = [
        'http://localhost:9000',
        'https://australschedulerwebapp.vercel.app',
        'file://',
        'null'
    ];

    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '*';

    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
    return NextResponse.json({}, {
        headers: getCorsHeaders(request.headers.get('origin'))
    });
}

// POST - Send a message (creates DB record + sends push notification)
export async function POST(request: NextRequest) {
    const headers = getCorsHeaders(request.headers.get('origin'));

    try {
        const { email, title, body } = await request.json();

        if (!email || !title || !body) {
            return NextResponse.json(
                { error: 'Email, title, and body are required' },
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

        // Insertar mensaje en la BD usando Prisma
        const message = await prisma.message.create({
            data: {
                userId,
                title,
                body,
                read: false,
                createdAt: new Date()
            }
        });

        const messageId = message.id;

        // Intentar enviar push notification
        let pushSent = false;
        let pushError = null;

        try {
            // Obtener token FCM del usuario usando Prisma
            const tokenResult = await prisma.userPushToken.findFirst({
                where: { userId },
                select: { token: true }
            });

            if (tokenResult && tokenResult.token) {
                await sendPushNotification(
                    tokenResult.token,
                    title,
                    body
                );
                pushSent = true;
                console.log(`✅ Push notification sent for message ${messageId}`);
            } else {
                console.log(`⚠️ No FCM token found for user ${userId}`);
            }
        } catch (error: any) {
            console.error('Error sending push notification:', error);
            pushError = error.message;
        }

        return NextResponse.json({
            success: true,
            message: 'Message created successfully',
            messageId,
            pushSent,
            pushError,
            data: message
        }, { headers });

    } catch (error) {
        console.error('Error creating message:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

// GET - List messages for a user
export async function GET(request: NextRequest) {
    const headers = getCorsHeaders(request.headers.get('origin'));

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { error: 'Email parameter is required' },
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

        // Obtener mensajes del usuario usando Prisma
        const messages = await prisma.message.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        // Contar mensajes no leídos usando Prisma
        const unreadCount = await prisma.message.count({
            where: { userId, read: false }
        });

        return NextResponse.json({
            messages,
            unreadCount
        }, { headers });

    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

// PATCH - Mark message as read
export async function PATCH(request: NextRequest) {
    const headers = getCorsHeaders(request.headers.get('origin'));

    try {
        const { messageId } = await request.json();

        if (!messageId) {
            return NextResponse.json(
                { error: 'Message ID is required' },
                { status: 400, headers }
            );
        }

        // Marcar como leído usando Prisma
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { read: true },
            select: { id: true, read: true }
        });

        return NextResponse.json({
            success: true,
            message: 'Message marked as read',
            data: updatedMessage
        }, { headers });

    } catch (error: any) {
        console.error('Error updating message:', error);
        if (error.code === 'P2025') {
            return NextResponse.json(
                { error: 'Message not found' },
                { status: 404, headers }
            );
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}
