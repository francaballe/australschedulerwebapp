import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(request: NextRequest) {
    console.log('--- Login Attempt Started ---');
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { email, password } = body;

        console.log('Login request for:', email);

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son requeridos' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Query user by email (Prefixing with 'app.' schema)
        let users;
        try {
            users = await sql`
        SELECT id, email, password, firstname, lastname, isblocked, userroleid 
        FROM app.users 
        WHERE email = ${email.toLowerCase().trim()}
      `;
            console.log('Database query successful, found users:', users.length);
        } catch (dbError) {
            console.error('Database Query Error:', dbError);
            return NextResponse.json(
                { error: 'Error de conexión con la base de datos' },
                { status: 500, headers: corsHeaders }
            );
        }

        if (!users || users.length === 0) {
            console.log('User not found in app.users');
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401, headers: corsHeaders }
            );
        }

        const user = users[0];

        // Verify password
        console.log('Verifying password with bcrypt...');
        const isValidPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', isValidPassword);

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401, headers: corsHeaders }
            );
        }

        if (user.isblocked) {
            return NextResponse.json(
                { error: 'Usuario bloqueado. Contactá al administrador.' },
                { status: 403, headers: corsHeaders }
            );
        }

        // Update last login (Prefixing with 'app.' schema)
        try {
            await sql`UPDATE app.users SET lastlogin = NOW() WHERE id = ${user.id}`;
        } catch (updateError) {
            console.error('Failed to update last login:', updateError);
        }

        console.log('Login successful for user ID:', user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstname,
                lastName: user.lastname,
                roleId: user.userroleid
            }
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Login Route Fatal Error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500, headers: corsHeaders }
        );
    }
}
