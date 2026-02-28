import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (!password) return { isValid: false, message: 'La contraseña es requerida' };
    if (password.length < 8) return { isValid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
    if (!/[A-Z]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos una mayúscula' };
    if (!/[a-z]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos una minúscula' };
    if (!/[0-9]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos un número' };
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { isValid: false, message: 'La contraseña debe tener al menos un carácter especial (ej: !@#$%)' };
    return { isValid: true, message: '' };
};

export async function GET(request: NextRequest) {
    try {
        const q = request.nextUrl.searchParams.get('q');
        const includeBlocked = request.nextUrl.searchParams.get('includeBlocked') === 'true';

        const whereClause: any = {};

        if (!includeBlocked) {
            whereClause.isblocked = false;
        }

        if (q && q.trim()) {
            const term = q.trim();
            const words = term.split(/\s+/).filter(Boolean);
            if (words.length > 1) {
                // Multi-word: match first+last name combination
                // e.g. "otro m" should match firstname="otro" + lastname starts with "m"
                whereClause.AND = words.map((word: string) => ({
                    OR: [
                        { firstname: { contains: word, mode: 'insensitive' } },
                        { lastname: { contains: word, mode: 'insensitive' } },
                        { email: { contains: word, mode: 'insensitive' } }
                    ]
                }));
            } else {
                whereClause.OR = [
                    { firstname: { contains: term, mode: 'insensitive' } },
                    { lastname: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } }
                ];
            }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
                userroleid: true,
                phone: true,
                isblocked: true,
                lastlogin: true,
                createddate: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                siteAccess: {
                    select: {
                        siteId: true
                    }
                }
            } as any
        }) as any;

        const formattedUsers = users.map((user: any) => ({
            id: user.id,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            roleId: user.userroleid,
            phone: user.phone,
            isBlocked: user.isblocked,
            lastLogin: user.lastlogin,
            createdDate: user.createddate,
            roleName: user.role?.name || null,
            siteIds: user.siteAccess.map((sa: any) => sa.siteId)
        })).sort((a: any, b: any) => {
            const first = (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' });
            if (first !== 0) return first;
            return (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' });
        });

        return NextResponse.json(formattedUsers, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users GET Error:', error);
        return NextResponse.json(
            { error: 'Error al obtener usuarios' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, firstName, lastName, phone, roleId, siteIds, callerUserId } = body;

        if (!email || !password || !firstName || !lastName) {
            return NextResponse.json(
                { error: 'Email, contraseña, nombre y apellido son requeridos' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate password complexity
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return NextResponse.json({ error: passwordValidation.message }, { status: 400, headers: corsHeaders });
        }

        // Check if email already exists
        const existing = await prisma.user.findFirst({
            where: { email: email.toLowerCase().trim() }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe un usuario con ese email' },
                { status: 409, headers: corsHeaders }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                firstname: firstName.trim(),
                lastname: lastName.trim(),
                phone: phone?.trim() || null,
                userroleid: roleId || 2,
                isblocked: false,
                createddate: new Date(),
                siteAccess: (roleId === 1 && siteIds && Array.isArray(siteIds)) ? {
                    create: siteIds.map((sid: number) => ({ siteId: sid }))
                } : undefined
            } as any,
            select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
                userroleid: true,
                phone: true,
                isblocked: true,
                lastlogin: true,
                createddate: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Log user creation (fire-and-forget)
        if (callerUserId) {
            const newName = `${newUser.firstname || ''} ${newUser.lastname || ''}`.trim();
            (prisma as any).log.create({
                data: { userId: callerUserId, action: `created_user: ${newName} (id: ${newUser.id}, email: ${(newUser as any).email})` }
            }).catch(() => { });
        }

        return NextResponse.json({
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstname,
            lastName: newUser.lastname,
            roleId: newUser.userroleid,
            phone: newUser.phone,
            isBlocked: newUser.isblocked,
            lastLogin: newUser.lastlogin,
            createdDate: newUser.createddate,
            roleName: (newUser as any).role?.name || null,
            siteIds: (newUser as any).siteAccess ? (newUser as any).siteAccess.map((sa: any) => sa.siteId) : []
        }, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users POST Error:', error);
        return NextResponse.json(
            { error: 'Error al crear usuario' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, email, password, firstName, lastName, phone, roleId, isBlocked, siteIds } = body;

        if (password) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                return NextResponse.json({ error: passwordValidation.message }, { status: 400, headers: corsHeaders });
            }
        }

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id }
        });

        if (!existingUser) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404, headers: corsHeaders }
            );
        }

        // If email is changing, check uniqueness
        if (email && email.toLowerCase().trim() !== existingUser.email) {
            const emailTaken = await prisma.user.findFirst({
                where: {
                    email: email.toLowerCase().trim(),
                    id: { not: id }
                }
            });
            if (emailTaken) {
                return NextResponse.json(
                    { error: 'Ya existe otro usuario con ese email' },
                    { status: 409, headers: corsHeaders }
                );
            }
        }

        const updateData: any = {};
        if (firstName !== undefined) updateData.firstname = firstName.trim();
        if (lastName !== undefined) updateData.lastname = lastName.trim();
        if (email !== undefined) updateData.email = email.toLowerCase().trim();
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (isBlocked !== undefined) updateData.isblocked = isBlocked;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Server-side role guard:
        // Caller's identity comes from the request body (callerUserId).
        // We look up their real role from the DB — not from a client header — to prevent spoofing.
        const { callerUserId } = body;
        if (callerUserId) {
            const caller = await prisma.user.findUnique({ where: { id: callerUserId }, select: { userroleid: true } });
            const callerRole = caller?.userroleid ?? 99;

            // Admins (roleId=1) can only modify regular users (roleId=2), but can always self-edit
            if (callerRole === 1 && existingUser.userroleid !== 2 && id !== callerUserId) {
                return NextResponse.json(
                    { error: 'Sin permisos: solo podés modificar usuarios regulares.' },
                    { status: 403, headers: corsHeaders }
                );
            }

            // Nobody except owner can assign a role of 0 (owner) or 1 (admin) if they're not owner
            if (roleId !== undefined && callerRole !== 0 && roleId < 2) {
                return NextResponse.json(
                    { error: 'Sin permisos: no podés asignar ese rol.' },
                    { status: 403, headers: corsHeaders }
                );
            }

            // Nobody can change the owner's role
            if (roleId !== undefined && existingUser.userroleid === 0 && id !== callerUserId) {
                return NextResponse.json(
                    { error: 'Sin permisos: no podés modificar el rol del owner.' },
                    { status: 403, headers: corsHeaders }
                );
            }
        }

        // Only apply roleId change if explicitly included (after guard)
        if (roleId !== undefined) updateData.userroleid = roleId;

        // Handle siteIds update
        if (siteIds && Array.isArray(siteIds) && (roleId === 1 || existingUser.userroleid === 1)) {
            // Transaction to update user and site access
            const updatedUser = await prisma.$transaction(async (tx) => {
                // Delete existing access
                await (tx as any).userSiteAccess.deleteMany({
                    where: { userId: id }
                });

                // Create new access
                if (siteIds.length > 0) {
                    await (tx as any).userSiteAccess.createMany({
                        data: siteIds.map((sid: number) => ({
                            userId: id,
                            siteId: sid
                        }))
                    });
                }

                // Update user data
                return await tx.user.update({
                    where: { id },
                    data: updateData,
                    select: {
                        id: true,
                        email: true,
                        firstname: true,
                        lastname: true,
                        userroleid: true,
                        phone: true,
                        isblocked: true,
                        lastlogin: true,
                        createddate: true,
                        role: { select: { id: true, name: true } },
                        siteAccess: { select: { siteId: true } }
                    }
                } as any);
            }) as any;

            return NextResponse.json({
                id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.firstname,
                lastName: updatedUser.lastname,
                roleId: updatedUser.userroleid,
                phone: updatedUser.phone,
                isBlocked: updatedUser.isblocked,
                lastLogin: updatedUser.lastlogin,
                createdDate: updatedUser.createddate,
                roleName: (updatedUser as any).role?.name || null,
                siteIds: (updatedUser as any).siteAccess.map((sa: any) => sa.siteId)
            }, { headers: corsHeaders });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
                userroleid: true,
                phone: true,
                isblocked: true,
                lastlogin: true,
                createddate: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Log significant actions (fire-and-forget)
        if (callerUserId) {
            const targetName = `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim();

            // 1. Log block/unblock status change
            if (isBlocked !== undefined && isBlocked !== existingUser.isblocked) {
                const action = isBlocked
                    ? `blocked_user: ${targetName} (id: ${id})`
                    : `unblocked_user: ${targetName} (id: ${id})`;
                (prisma as any).log.create({ data: { userId: callerUserId, action } }).catch(() => { });
            }

            // 2. Log password change specifically
            if (password) {
                (prisma as any).log.create({
                    data: {
                        userId: callerUserId,
                        action: `changed_password: ${targetName} (id: ${id})`
                    }
                }).catch(() => { });
            }

            // 3. Log other general edits
            const otherFieldsChanged = (
                (firstName !== undefined && firstName.trim() !== existingUser.firstname) ||
                (lastName !== undefined && lastName.trim() !== existingUser.lastname) ||
                (email !== undefined && email.toLowerCase().trim() !== existingUser.email) ||
                (phone !== undefined && (phone?.trim() || null) !== existingUser.phone) ||
                (roleId !== undefined && roleId !== existingUser.userroleid) ||
                (siteIds !== undefined) // siteIds are always updated via transaction if present
            );

            if (otherFieldsChanged) {
                (prisma as any).log.create({
                    data: {
                        userId: callerUserId,
                        action: `updated_user_profile: ${targetName} (id: ${id})`
                    }
                }).catch(() => { });
            }
        }

        return NextResponse.json({
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstname,
            lastName: updatedUser.lastname,
            roleId: updatedUser.userroleid,
            phone: updatedUser.phone,
            isBlocked: updatedUser.isblocked,
            lastLogin: updatedUser.lastlogin,
            createdDate: updatedUser.createddate,
            roleName: updatedUser.role?.name || null
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users PUT Error:', error);
        return NextResponse.json(
            { error: 'Error al actualizar usuario' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
