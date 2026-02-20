import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

        // Query user by email using Prisma
        const user = await prisma.user.findFirst({
            where: {
                email: email.toLowerCase().trim()
            }
        });

        if (!user) {
            console.log('User not found in app.users');
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401, headers: corsHeaders }
            );
        }

        // Verify password
        console.log('Verifying password with bcrypt...');
        if (!user.password) {
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401, headers: corsHeaders }
            );
        }
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

        // Regular users (roleId=2) can only use the mobile app
        if (user.userroleid === 2) {
            return NextResponse.json(
                { error: 'Esta plataforma es solo para administradores. Por favor, usá la aplicación móvil.' },
                { status: 403, headers: corsHeaders }
            );
        }

        // Update last login using Prisma
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: { lastlogin: new Date() }
            });
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
