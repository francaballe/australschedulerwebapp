import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Obtener todos los tokens registrados
        const result = await sql`
            SELECT 
                u.email,
                upt.token,
                upt.created_at,
                upt.updated_at
            FROM app.user_push_tokens upt
            JOIN app.users u ON upt.user_id = u.id
            ORDER BY upt.created_at DESC
        `;

        return NextResponse.json({
            tokens: result,
            count: result.length
        }, { headers });

    } catch (error: any) {
        console.error('Error getting push tokens:', error);
        return NextResponse.json(
            { 
                error: 'Failed to get push tokens',
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