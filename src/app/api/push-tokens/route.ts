import { NextRequest, NextResponse } from 'next/server';
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
        const { email, token } = await request.json();

        if (!email || !token) {
            return NextResponse.json(
                { error: 'Email and token are required' },
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

        // Eliminar tokens antiguos del mismo usuario si existen
        await sql`
            DELETE FROM app.user_push_tokens 
            WHERE user_id = ${userId}
        `;

        // Insertar el nuevo token
        await sql`
            INSERT INTO app.user_push_tokens (user_id, token, created_at)
            VALUES (${userId}, ${token}, NOW())
        `;

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

        // Obtener el token del usuario
        const result = await sql`
            SELECT upt.token, upt.created_at 
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

        return NextResponse.json({
            token: result[0].token,
            created_at: result[0].created_at
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

        // Eliminar token usando el email para buscar el usuario
        // Usamos una trasacción o un join DELETE si es posible, 
        // pero con @vercel/postgres/neon a veces es mejor ser explícito
        
        // 1. Obtener ID de usuario
        const user = await sql`
            SELECT id FROM app.users WHERE email = ${email}
        `;

        if (user.length === 0) {
            // Si el usuairo no existe, técnicamente ya no tiene token, así que OK
            return NextResponse.json(
                { message: 'User not found, nothing to delete' },
                { status: 200, headers }
            );
        }

        const userId = user[0].id;

        // 2. Eliminar token
        await sql`
            DELETE FROM app.user_push_tokens 
            WHERE user_id = ${userId}
        `;

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