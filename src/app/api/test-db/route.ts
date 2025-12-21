import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
    try {
        // 1. List all tables in the public schema
        const tables = await sql`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `;

        // 2. Get current database and schema
        const currentInfo = await sql`
      SELECT current_database() as db, current_schema() as schema, current_user as user
    `;

        return NextResponse.json({
            status: 'connected',
            database: currentInfo[0].db,
            schema: currentInfo[0].schema,
            user: currentInfo[0].user,
            availableTables: tables
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            error: error.message,
            code: error.code
        }, { status: 500 });
    }
}
