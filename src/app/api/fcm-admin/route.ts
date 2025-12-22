import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Endpoint para disparar limpieza manual
export async function POST() {
    try {
        // Llamar al endpoint de limpieza
        const cleanupUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cleanup-fcm-tokens`;
        
        const response = await fetch(cleanupUrl, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        return NextResponse.json({
            success: true,
            message: 'Limpieza manual iniciada',
            cleanup: result
        });
        
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: 'Error iniciando limpieza manual',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}

// Endpoint de estado de tokens
export async function GET() {
    try {
        const stats = await sql`
            SELECT 
                COUNT(*) as total_tokens,
                COUNT(DISTINCT user_id) as unique_users,
                DATE_TRUNC('day', MIN(created_at)) as oldest_token,
                DATE_TRUNC('day', MAX(created_at)) as newest_token
            FROM app.user_push_tokens
        `;

        const recentTokens = await sql`
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as count
            FROM app.user_push_tokens 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date DESC
        `;

        return NextResponse.json({
            success: true,
            statistics: stats.rows[0],
            recentActivity: recentTokens.rows,
            lastCleanup: 'Check logs for last cleanup time',
            nextScheduledCleanup: 'Every Sunday 3 AM UTC'
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: 'Error getting token statistics',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}