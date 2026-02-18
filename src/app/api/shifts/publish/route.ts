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

    // 1. Identify users who need to be notified (users with at least one UNPUBLISHED shift in range)
    // regardless of 'type' (all or changes), we only notify if there's something new to show.
    // If type is 'changes', updateWhere handles it. If type is 'all', we still only care about users with *unpublished* items
    // effectively, we want to know whose schedule CHANGED/IS NEW.
    const usersToNotify = await prisma.shift.findMany({
      where: {
        date: { gte: start, lte: end },
        published: false
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });

    const targetUserIds = usersToNotify.map(u => u.userId);

    // 2. Update shifts to published
    // If type === 'changes', updateWhere already targets unpublished.
    // If type === 'all', updateWhere targets all.
    // We proceed with the update as requested.
    const updated = await prisma.shift.updateMany({
      where: updateWhere,
      data: { published: true }
    });

    if (targetUserIds.length === 0) {
      console.log('No users with unpublished shifts found. No notifications sent.');
      return NextResponse.json({ updated: updated.count, notifiedUsers: 0 }, { headers: corsHeaders });
    }

    // 3. Fetch FULL schedule for the target users
    // We want to send them the complete picture for the range, even if some parts were already published.
    const shiftsToNotify = await prisma.shift.findMany({
      where: {
        userId: { in: targetUserIds },
        date: { gte: start, lte: end }
      },
      include: {
        position: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // 4. Group shifts by User ID
    type ShiftWithPosition = typeof shiftsToNotify[0];
    const shiftsByUser = new Map<number, ShiftWithPosition[]>();

    shiftsToNotify.forEach(shift => {
      const existing = shiftsByUser.get(shift.userId) || [];
      existing.push(shift);
      shiftsByUser.set(shift.userId, existing);
    });

    // 4. Send Notifications to affected users
    console.log(`Sending detailed publish notifications to ${shiftsByUser.size} users.`);

    const notificationPromises = Array.from(shiftsByUser.entries()).map(async ([userId, userShifts]) => {
      try {
        // Construct Detailed Body for Push (Plain Text)
        const lines = userShifts.map(shift => {
          const dateObj = new Date(shift.date);
          const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
          const dateStr = utcDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' });

          const formatTime = (d: Date | null) => {
            if (!d) return '??';
            const h = d.getUTCHours();
            const m = d.getUTCMinutes();
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            const minStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
            return `${hour12}${minStr} ${period}`;
          };

          const timeStr = `${formatTime(shift.starttime)} - ${formatTime(shift.endtime)}`;
          const posName = shift.position?.name || 'General';

          return `📅 ${dateStr} - ${posName}: ${timeStr}`;
        });

        const title = 'Nuevos turnos publicados';
        const plainBody = 'Se han publicado los siguientes turnos:\n\n' + lines.join('\n');

        // Construct Rich Body for In-App (JSON)
        const richShifts = userShifts.map(shift => {
          const dateObj = new Date(shift.date);
          const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
          const dateStr = utcDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' });

          const formatTime = (d: Date | null) => {
            if (!d) return '??';
            const h = d.getUTCHours();
            const m = d.getUTCMinutes();
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            const minStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
            return `${hour12}${minStr} ${period}`;
          };

          return {
            dateStr: dateStr, // e.g. "Lun 12/02"
            positionName: shift.position?.name || 'General',
            timeStr: `${formatTime(shift.starttime)} - ${formatTime(shift.endtime)}`,
            color: shift.position?.color || '#1976D2' // Default blue if no color
          };
        });

        const richBody = JSON.stringify({
          isRich: true,
          text: 'Se han publicado los siguientes turnos:',
          shifts: richShifts
        });

        // Save to Database (Rich JSON)
        await prisma.message.create({
          data: {
            userId,
            title,
            body: richBody,
            read: false,
            createdAt: new Date()
          }
        });

        // Send Push Notification (Plain Text)
        const tokenRecord = await prisma.userPushToken.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        });

        if (tokenRecord && tokenRecord.token) {
          await import('@/lib/firebase-admin').then(mod =>
            mod.sendPushNotification(tokenRecord.token, title, plainBody)
          );
        }
      } catch (err) {
        console.error(`Failed to notify user ${userId}:`, err);
      }
    });

    await Promise.allSettled(notificationPromises);

    return NextResponse.json({ updated: updated.count, notifiedUsers: shiftsByUser.size }, { headers: corsHeaders });

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
