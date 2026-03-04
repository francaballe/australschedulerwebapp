import nodemailer from 'nodemailer';

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or configure host/port for other providers
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
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
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('EMAIL_USER or EMAIL_PASS not set in environment. Skipping email sending.');
        return;
    }

    const mailOptions = {
        from: `"RosterLoop" <${process.env.EMAIL_USER}>`,
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
