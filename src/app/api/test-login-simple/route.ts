import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        // Query user by email
        const users = await sql`
      SELECT id, email, password, firstname, lastname, isblocked, userroleid 
      FROM users 
      WHERE email = ${email.toLowerCase().trim()}
    `;

        if (users.length === 0) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const user = users[0];

        // TEMPORARY: Simple string comparison to test if bcrypt is the issue
        // In a real scenario, this would fail for hashed passwords
        if (password === user.password) {
            return NextResponse.json({ success: true, user });
        }

        return NextResponse.json({ error: 'Bcrypt isolation test' }, { status: 200, headers: { 'X-Debug': 'Bcrypt skipped' } });

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
