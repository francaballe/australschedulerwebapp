import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
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

        // Verificar que el usuario existe
        const user = await sql`
            SELECT id FROM app.users WHERE email = ${email}
        `;

        if (user.length === 0) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404, headers }
            );
        }

        const userId = user[0].id;

        // Insertar mensaje en la BD
        const message = await sql`
            INSERT INTO app.messages (user_id, title, body, read, created_at)
            VALUES (${userId}, ${title}, ${body}, FALSE, NOW())
            RETURNING id, user_id, title, body, read, created_at
        `;

        const messageId = message[0].id;

        // Intentar enviar push notification
        let pushSent = false;
        let pushError = null;

        try {
            // Obtener token FCM del usuario
            const tokenResult = await sql`
                SELECT token FROM app.user_push_tokens 
                WHERE user_id = ${userId}
            `;

            if (tokenResult.length > 0 && tokenResult[0].token) {
                await sendPushNotification(
                    tokenResult[0].token,
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
            data: message[0]
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

        // Verificar que el usuario existe
        const user = await sql`
            SELECT id FROM app.users WHERE email = ${email}
        `;

        if (user.length === 0) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404, headers }
            );
        }

        const userId = user[0].id;

        // Obtener mensajes del usuario, ordenados por más recientes
        const messages = await sql`
            SELECT id, title, body, read, created_at
            FROM app.messages
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        // Contar mensajes no leídos
        const unreadCount = await sql`
            SELECT COUNT(*) as count
            FROM app.messages
            WHERE user_id = ${userId} AND read = FALSE
        `;

        return NextResponse.json({
            messages,
            unreadCount: parseInt(unreadCount[0].count)
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

        // Marcar como leído
        const result = await sql`
            UPDATE app.messages
            SET read = TRUE
            WHERE id = ${messageId}
            RETURNING id, read
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Message not found' },
                { status: 404, headers }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Message marked as read',
            data: result[0]
        }, { headers });

    } catch (error) {
        console.error('Error updating message:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}
