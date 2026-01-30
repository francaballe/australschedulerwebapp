import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Fetch users from the app.users table
        const users = await sql`
            SELECT id, email, firstname, lastname, userroleid 
            FROM app.users 
            WHERE isblocked = false
            ORDER BY lastname, firstname
        `;

        // Map database field names to frontend camelCase
        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            roleId: user.userroleid
        }));

        return NextResponse.json(formattedUsers, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener usuarios' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
