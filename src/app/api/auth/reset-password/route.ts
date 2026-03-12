import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (!password) return { isValid: false, message: 'La contraseña es requerida' };
    if (password.length < 8) return { isValid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
    if (!/[A-Z]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos una mayúscula' };
    if (!/[a-z]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos una minúscula' };
    if (!/[0-9]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos un número' };
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos un carácter especial (ej: !@#$%)' };
    return { isValid: true, message: '' };
};

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { email, code, newPassword } = body;

        if (!email || !code || !newPassword) {
            return NextResponse.json(
                { error: 'Email, código y nueva contraseña son requeridos' },
                { status: 400, headers: corsHeaders }
            );
        }

        const emailLower = email.toLowerCase().trim();

        // Validate password complexity
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return NextResponse.json({ error: passwordValidation.message }, { status: 400, headers: corsHeaders });
        }

        // Verify code
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resetRecord = await (prisma as any).passwordResetCode.findUnique({
            where: { email: emailLower }
        });

        if (!resetRecord || resetRecord.code !== code) {
            return NextResponse.json(
                { error: 'Código inválido' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Check expiration
        if (new Date() > new Date(resetRecord.expiresAt)) {
            return NextResponse.json(
                { error: 'El código ha expirado' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: { email: emailLower }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404, headers: corsHeaders }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and delete reset code
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).passwordResetCode.delete({
                where: { email: emailLower }
            })
        ]);

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json(
            { error: 'Error al restablecer la contraseña' },
            { status: 500, headers: corsHeaders }
        );
    }
}

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
