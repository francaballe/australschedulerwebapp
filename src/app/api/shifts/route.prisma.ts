import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        // Get query parameters
        const { searchParams } = request.nextUrl;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const siteId = searchParams.get('siteId');

        // Build where clause dynamically
        const whereClause: any = {};

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (siteId) {
            whereClause.siteid = parseInt(siteId);
        }

        // Using Prisma with relations instead of manual JOINs
        const shifts = await prisma.shift.findMany({
            where: whereClause,
            orderBy: [
                { date: 'asc' },
                { userId: 'asc' }
            ],
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                },
                position: {
                    select: {
                        id: true,
                        name: true,
                        color: true
                    }
                }
            }
        }) as any[];

        type ShiftResult = typeof shifts[0];

        // Transform to match frontend expectations
        const transformedShifts = shifts.map((shift: ShiftResult) => ({
            id: shift.id,
            userId: shift.userId,
            user: shift.user ? {
                id: shift.user.id,
                firstName: shift.user.firstname,
                lastName: shift.user.lastname,
                email: shift.user.email
            } : null,
            positionId: shift.positionId,
            position: shift.position?.name || null,
            positionColor: shift.position?.color || null,
            date: shift.date,
            startTime: shift.starttime ?
                `${shift.starttime.getUTCHours().toString().padStart(2, '0')}:${shift.starttime.getUTCMinutes().toString().padStart(2, '0')}:${shift.starttime.getUTCSeconds().toString().padStart(2, '0')}`
                : null,
            endTime: shift.endtime ?
                `${shift.endtime.getUTCHours().toString().padStart(2, '0')}:${shift.endtime.getUTCMinutes().toString().padStart(2, '0')}:${shift.endtime.getUTCSeconds().toString().padStart(2, '0')}`
                : null,
            published: shift.published
        }));

        return NextResponse.json(transformedShifts, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Shifts Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener turnos' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { userId, date, positionId, startTime, endTime, published } = body;

        // Basic validation
        if (!userId || !date || !positionId) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, date, positionId' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Using Prisma create instead of raw INSERT
        const newShift = await prisma.shift.create({
            data: {
                userId: parseInt(userId),
                positionId: parseInt(positionId),
                date: new Date(date),
                starttime: startTime || '00:00:00',
                endtime: endTime || '00:00:00',
                published: published ?? true,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true
                    }
                },
                position: {
                    select: {
                        name: true,
                        color: true
                    }
                }
            }
        });

        // Transform response
        const response = {
            id: newShift.id,
            userId: newShift.userId,
            user: newShift.user,
            positionId: newShift.positionId,
            position: newShift.position?.name,
            positionColor: newShift.position?.color,
            date: newShift.date,
            startTime: newShift.starttime,
            endTime: newShift.endtime,
            published: newShift.published
        };

        return NextResponse.json(response, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Shifts POST Error:', error);
        return NextResponse.json(
            { error: 'Error al crear turno' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json(
        {},
        {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        }
    );
}