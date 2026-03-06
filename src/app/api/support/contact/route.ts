import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { fullName, email, phone, category, message } = await req.json();

        if (!fullName || !email || !message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SUPPORT_EMAIL_USER,
                pass: process.env.NOTIFICATIONS_EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.SUPPORT_EMAIL_USER,
            to: process.env.SUPPORT_EMAIL_USER,
            replyTo: email,
            subject: `[RosterLoop Support] ${category}: ${fullName}`,
            text: `
                Nombre Completo: ${fullName}
                Email: ${email}
                Teléfono: ${phone || 'No provisto'}
                Categoría: ${category}
                
                Mensaje:
                ${message}
            `,
            html: `
                <h3>Nuevo mensaje de soporte</h3>
                <p><strong>Nombre Completo:</strong> ${fullName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Teléfono:</strong> ${phone || 'No provisto'}</p>
                <p><strong>Categoría:</strong> ${category}</p>
                <p><strong>Mensaje:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error sending support email:', error);
        return NextResponse.json(
            { error: 'Failed to send email', details: error.message },
            { status: 500 }
        );
    }
}
