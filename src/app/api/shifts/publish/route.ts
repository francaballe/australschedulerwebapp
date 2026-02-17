import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { startDate, endDate, type } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400, headers: corsHeaders });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Delete shifts marked for deletion in the range


    // Build update filter: if type === 'changes' update only unpublished shifts, otherwise update all
    const updateWhere: any = {
      date: {
        gte: start,
        lte: end
      }
    };
    if (type === 'changes') {
      updateWhere.published = false;
    }

    const updated = await prisma.shift.updateMany({
      where: updateWhere,
      data: { published: true }
    });

    return NextResponse.json({ updated: updated.count }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Publish shifts error:', error);
    return NextResponse.json({ error: 'Error publishing shifts' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
