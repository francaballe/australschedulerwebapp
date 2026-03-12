import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'Email es requerido' },
                { status: 400, headers: corsHeaders }
            );
        }

        const emailLower = email.toLowerCase().trim();

        const user = await prisma.user.findFirst({
            where: { email: emailLower }
        });

        if (!user) {
            // Security: don't reveal if user exists, but log it
            console.log(`Forgot password requested for non-existent email: ${emailLower}`);
            return NextResponse.json({ success: true }, { headers: corsHeaders });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save code to database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).passwordResetCode.upsert({
            where: { email: emailLower },
            update: { code, expiresAt, createdAt: new Date() },
            create: { email: emailLower, code, expiresAt }
        });

        // Send email
        const subject = 'Tu código de recuperación de RosterLoop';
        const text = `Tu código de recuperación es: ${code}. Este código expirará en 1 hora.`;
        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4F2EB5; text-align: center;">Recuperación de Contraseña</h2>
                <p>Hola,</p>
                <p>Has solicitado restablecer tu contraseña en <strong>RosterLoop</strong>. Utiliza el siguiente código para continuar:</p>
                <div style="background: #f4f7ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F2EB5;">${code}</span>
                </div>
                <p style="color: #666; font-size: 14px;">Este código expirará en 1 hora por motivos de seguridad.</p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
                    Este es un mensaje automático de RosterLoop. Por favor no respondas a este correo.
                </div>
            </div>
        `;

        await sendEmail(emailLower, subject, text, html);

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json(
            { error: 'Error al procesar la solicitud' },
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
