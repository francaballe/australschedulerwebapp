
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        console.log('🧹 Starting position cleanup via API...');

        // 1. Set positionId to null for shifts with positionId = 0
        const updateResult = await prisma.shift.updateMany({
            where: { positionId: 0 },
            data: { positionId: null }
        });

        // 2. Delete shifts with positionId = 1
        const deleteShiftsResult = await prisma.shift.deleteMany({
            where: { positionId: 1 }
        });

        // 3. Delete positions 0 and 1
        const deletePositionsResult = await prisma.position.deleteMany({
            where: {
                id: { in: [0, 1] }
            }
        });

        return NextResponse.json({
            success: true,
            updatedShifts: updateResult.count,
            deletedUnavailableShifts: deleteShiftsResult.count,
            deletedPositions: deletePositionsResult.count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
