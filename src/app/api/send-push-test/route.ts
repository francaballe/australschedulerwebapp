import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const { email, title, body } = await request.json();

        if (!email || !title || !body) {
            return NextResponse.json(
                { error: 'Email, title, and body are required' },
                { status: 400, headers }
            );
        }

        // Obtener el token FCM del usuario
        const result = await sql`
            SELECT upt.token 
            FROM app.user_push_tokens upt
            JOIN app.users u ON upt.user_id = u.id
            WHERE u.email = ${email}
            ORDER BY upt.created_at DESC
            LIMIT 1
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'No push token found for this user' },
                { status: 404, headers }
            );
        }

        const fcmToken = result[0].token;

        // Por ahora, solo simular el envío hasta resolver el crash de Firebase Admin
        console.log('Would send notification to token:', fcmToken);
        console.log('Title:', title);
        console.log('Body:', body);

        return NextResponse.json({
            message: 'Push notification simulated successfully (Firebase Admin temporarily disabled)',
            token: fcmToken
        }, { headers });

    } catch (error: any) {
        console.error('Error in send-push:', error);
        return NextResponse.json(
            { 
                error: 'Failed to process push notification',
                details: error.message 
            },
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