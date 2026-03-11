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
    const { startDate, endDate, type, siteId, callerUserId } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400, headers: corsHeaders });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. BEFORE publishing, identify users who have UNPUBLISHED shifts (the truly affected ones)
    const siteFilter = siteId !== undefined && siteId !== null ? { siteid: Number(siteId) } : {};

    const affectedUsers = await prisma.shift.findMany({
      where: {
        date: { gte: start, lte: end },
        published: false,
        user: { isblocked: false },
        ...siteFilter
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const targetUserIds = affectedUsers.map(u => u.userId);

    // 2. Build update filter and publish shifts
    const updateWhere: any = {
      date: { gte: start, lte: end },
      ...siteFilter
    };
    if (type === 'changes') {
      updateWhere.published = false;
    }

    const updated = await prisma.shift.updateMany({
      where: {
        ...updateWhere,
        user: { isblocked: false }
      },
      data: { published: true }
    });

    // 3. If no users were affected, skip notifications
    if (targetUserIds.length === 0) {
      console.log('No users with unpublished shifts found. No notifications sent.');
      return NextResponse.json({ updated: updated.count, notifiedUsers: 0 }, { headers: corsHeaders });
    }

    console.log(`📢 ${targetUserIds.length} users had unpublished shifts and will be notified.`);

    // 3. Fetch FULL schedule for the target users
    // We want to send them the complete picture for the range, even if some parts were already published.
    const shiftsToNotify = await prisma.shift.findMany({
      where: {
        userId: { in: targetUserIds },
        date: { gte: start, lte: end },
        ...siteFilter
      },
      include: {
        position: true,
        user: { select: { email: true, firstname: true } }
      },
      orderBy: [
        { date: 'asc' },
        { starttime: 'asc' }
      ]
    });

    // 4. Group shifts by User ID
    type ShiftWithPositionAndUser = typeof shiftsToNotify[0];
    const shiftsByUser = new Map<number, ShiftWithPositionAndUser[]>();

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
          const dateStr = utcDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

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

        const title = 'New shifts published';
        const plainBody = 'The following shifts have been published:\n\n' + lines.join('\n');

        // Construct Rich Body for In-App (JSON)
        const richShifts = userShifts.map(shift => {
          const dateObj = new Date(shift.date);
          const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
          const dateStr = utcDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

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
          text: 'The following shifts have been published:',
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

        // Send Email Notification
        const userEmail = userShifts[0]?.user?.email;
        if (userEmail) {
          const userName = userShifts[0]?.user?.firstname || 'Usuario';
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1976D2;">${title}</h2>
              <p>Hi ${userName},</p>
              <p>The following shifts have been published to your schedule:</p>
              <ul style="list-style-type: none; padding-left: 0;">
                ${userShifts.map(shift => {
            const dateObj = new Date(shift.date);
            const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
            const dateStr = utcDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const formatTime = (d: Date | null) => {
              if (!d) return '??';
              const h = d.getUTCHours();
              const m = d.getUTCMinutes();
              const period = h >= 12 ? 'PM' : 'AM';
              const hour12 = h % 12 || 12;
              const minStr = m === 0 ? '' : ':' + m.toString().padStart(2, '0');
              return hour12 + minStr + ' ' + period;
            };
            const timeStr = formatTime(shift.starttime) + ' - ' + formatTime(shift.endtime);
            const posName = shift.position?.name || 'General';
            return '<li style="padding: 10px; border-bottom: 1px solid #eee;">' +
              '<strong>' + dateStr + '</strong><br/>' +
              '<span style="color: #666;">' + posName + '</span> - <span>' + timeStr + '</span>' +
              '</li>';
          }).join('')}
              </ul>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                This is an automated message from RosterLoop. Please do not reply to this email.
              </div>
            </div>
          `;
          await import('@/lib/email').then(mod =>
            mod.sendEmail(userEmail, title, plainBody, emailHtml)
          ).catch(err => console.error('Error sending email:', err));
        }
      } catch (err) {
        console.error(`Failed to notify user ${userId}:`, err);
      }
    });

    await Promise.allSettled(notificationPromises);

    // Log the publish action
    if (callerUserId) {
      const caller = await prisma.user.findUnique({ where: { id: callerUserId }, select: { companyId: true } });
      (prisma as any).log.create({
        data: {
          userId: callerUserId,
          action: `published_shifts: ${startDate} to ${endDate} (${updated.count} shifts, type: ${type || 'all'})`,
          companyId: caller?.companyId
        }
      }).catch(() => { });
    }

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
