import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/firebase-admin';
import sql from '@/lib/db';

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

        try {
            // Enviar notificación usando FCM REST API
            const response = await sendPushNotification(fcmToken, title, body);
            console.log('Successfully sent message:', response);

            return NextResponse.json({
                message: 'Push notification sent successfully',
                messageId: response.message_id || response.multicast_id
            }, { headers });

        } catch (firebaseError: any) {
            console.error('Firebase error:', firebaseError);
            
            // Si es un token inválido, eliminarlo de la base de datos
            if (firebaseError.message?.includes('invalid') || firebaseError.message?.includes('not registered')) {
                await sql`
                    DELETE FROM app.user_push_tokens upt
                    USING app.users u
                    WHERE upt.user_id = u.id AND u.email = ${email}
                `;
                
                return NextResponse.json(
                    { error: 'Token is invalid or expired. Token has been removed.' },
                    { status: 410, headers }
                );
            }
            
            throw firebaseError;
        }

    } catch (error: any) {
        console.error('Error sending push notification:', error);
        return NextResponse.json(
            { 
                error: 'Failed to send push notification',
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