import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CORS headers helper
function getCorsHeaders(origin?: string | null) {
    const allowedOrigins = [
        'http://localhost:9000',
        'https://australschedulerwebapp.vercel.app',
        'file://',
        'null'
    ];

    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '*';

    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
    return NextResponse.json({}, {
        headers: getCorsHeaders(request.headers.get('origin'))
    });
}

// POST - Create a log entry
export async function POST(request: NextRequest) {
    const headers = getCorsHeaders(request.headers.get('origin'));

    try {
        const { userId, action } = await request.json();

        if (!userId || !action) {
            return NextResponse.json(
                { error: 'userId and action are required' },
                { status: 400, headers }
            );
        }

        const log = await prisma.log.create({
            data: {
                userId,
                action,
            },
        });

        return NextResponse.json({
            success: true,
            data: log,
        }, { headers });

    } catch (error) {
        console.error('Error creating log:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}

// GET - List logs (with optional userId filter, pagination)
export async function GET(request: NextRequest) {
    const headers = getCorsHeaders(request.headers.get('origin'));

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        const where: any = {};
        if (userId) {
            where.userId = parseInt(userId);
        }

        const [logs, total] = await Promise.all([
            prisma.log.findMany({
                where,
                orderBy: { createddate: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstname: true,
                            lastname: true,
                            email: true,
                        }
                    }
                }
            }),
            prisma.log.count({ where }),
        ]);

        return NextResponse.json({
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }, { headers });

    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        );
    }
}
