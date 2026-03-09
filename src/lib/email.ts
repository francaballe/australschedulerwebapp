import nodemailer from 'nodemailer';

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or configure host/port for other providers
    auth: {
        user: process.env.NOTIFICATIONS_EMAIL_USER,
        pass: process.env.NOTIFICATIONS_EMAIL_PASS,
    },
});

/**
 * Sends an email using Nodemailer.
 * 
 * @param to recipient email address
 * @param subject email subject
 * @param text plain text body
 * @param html optional HTML body for rich content
 * @returns a promise that resolves when the email is sent
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string) {
    if (!process.env.NOTIFICATIONS_EMAIL_USER || !process.env.NOTIFICATIONS_EMAIL_PASS) {
        console.warn('NOTIFICATIONS_EMAIL_USER or NOTIFICATIONS_EMAIL_PASS not set in environment. Skipping email sending.');
        return;
    }

    const mailOptions = {
        from: `"RosterLoop" <${process.env.NOTIFICATIONS_EMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text, // Fallback to text if HTML not provided
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        throw error;
    }
}

/**
 * Sends a welcome email to a newly created user with their credentials.
 * This is fire-and-forget – errors are logged but never thrown.
 */
export async function sendWelcomeEmail(email: string, password: string, firstName?: string) {
    const name = firstName || 'User';
    const subject = 'Welcome to RosterLoop – Your login credentials';

    const text = [
        `Hi ${name},`,
        '',
        'Your RosterLoop account has been created successfully.',
        '',
        `Email (username): ${email}`,
        `Password: ${password}`,
        '',
        'We recommend changing your password after your first login.',
        '',
        'Best regards,',
        'The RosterLoop Team'
    ].join('\n');

    const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1976D2;">Welcome to RosterLoop</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your account has been created successfully. Below you will find your login credentials:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 12px; border: 1px solid #e0e0e0; background: #f5f5f5; font-weight: bold; width: 140px;">Email (username)</td>
                    <td style="padding: 12px; border: 1px solid #e0e0e0;">${email}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e0e0e0; background: #f5f5f5; font-weight: bold;">Password</td>
                    <td style="padding: 12px; border: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${password}</td>
                </tr>
            </table>
            <p style="color: #666; font-size: 13px;">We recommend changing your password after your first login.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                This is an automated message from RosterLoop. Please do not reply to this email.
            </div>
        </div>
    `;

    try {
        await sendEmail(email, subject, text, html);
    } catch (err) {
        console.error(`Failed to send welcome email to ${email}:`, err);
    }
}
