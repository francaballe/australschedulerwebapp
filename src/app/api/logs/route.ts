import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        let logs: any[] = [];
        let total = 0;

        if (search.trim()) {
            const terms = search.trim().split(/\s+/).filter(Boolean);
            const conditions: any[] = [];

            if (userId) {
                conditions.push(Prisma.sql`l.user_id = ${parseInt(userId)}`);
            }

            for (const term of terms) {
                const pattern = `%${term}%`;
                conditions.push(Prisma.sql`(
                    l.action ILIKE ${pattern} OR
                    u.firstname ILIKE ${pattern} OR
                    u.lastname ILIKE ${pattern} OR
                    u.email ILIKE ${pattern} OR
                    TO_CHAR(l.createddate AT TIME ZONE 'America/Argentina/Buenos_Aires', 'MM/DD/YYYY') ILIKE ${pattern} OR
                    TO_CHAR(l.createddate AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') ILIKE ${pattern} OR
                    TO_CHAR(l.createddate AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') ILIKE ${pattern} OR
                    TO_CHAR(l.createddate AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH12:MI AM') ILIKE ${pattern} OR
                    TO_CHAR(l.createddate AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') ILIKE ${pattern}
                )`);
            }

            const whereSql = conditions.length > 0 ? Prisma.join(conditions, ' AND ') : Prisma.sql`1=1`;

            // First get the paginated IDs
            const matchingIds = await prisma.$queryRaw<{ id: number }[]>`
                SELECT l.id
                FROM app.logs l
                JOIN app.users u ON l.user_id = u.id
                WHERE ${whereSql}
                ORDER BY l.createddate DESC
                LIMIT ${limit} OFFSET ${skip}
            `;

            // Then get the count using the exact same where condition
            const countResult = await prisma.$queryRaw<{ count: number }[]>`
                SELECT CAST(COUNT(l.id) AS INTEGER) as count
                FROM app.logs l
                JOIN app.users u ON l.user_id = u.id
                WHERE ${whereSql}
            `;

            total = countResult[0]?.count || 0;

            if (matchingIds.length > 0) {
                const ids = matchingIds.map(row => row.id);
                logs = await prisma.log.findMany({
                    where: { id: { in: ids } },
                    orderBy: { createddate: 'desc' },
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
                });

                // Re-sort to maintain the intended order from raw query since findMany with 'in' doesn't guarantee order
                logs.sort((a, b) => {
                    const idxA = ids.indexOf(a.id);
                    const idxB = ids.indexOf(b.id);
                    return idxA - idxB;
                });
            }

        } else {
            // No search, standard Prisma query
            const where: any = {};
            if (userId) {
                where.userId = parseInt(userId);
            }

            const [standardLogs, standardTotal] = await Promise.all([
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

            logs = standardLogs;
            total = standardTotal;
        }

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
