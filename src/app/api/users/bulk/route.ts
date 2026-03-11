import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';

export const dynamic = 'force-dynamic';
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const callerUserIdStr = formData.get('callerUserId') as string;
        const callerUserId = callerUserIdStr ? parseInt(callerUserIdStr, 10) : null;
        const companyIdStr = formData.get('companyId') as string;
        const companyId = companyIdStr ? parseInt(companyIdStr, 10) : null;

        if (!companyId) {
            return NextResponse.json(
                { error: 'El ID de la empresa es requerido.' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!file) {
            return NextResponse.json(
                { error: 'No se ha proporcionado ningún archivo.' },
                { status: 400, headers: corsHeaders }
            );
        }

        const csvContent = await file.text();

        // Parse CSV
        let records;
        try {
            records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: [',', ';', '\t'] // Soportar varios separadores
            });
        } catch (e: any) {
            return NextResponse.json(
                { error: `Error al leer el archivo CSV. Asegúrate de que el formato sea correcto. Detalle: ${e.message}` },
                { status: 400, headers: corsHeaders }
            );
        }

        if (records.length === 0) {
            return NextResponse.json(
                { error: 'El archivo CSV está vacío o solo contiene la cabecera. Recuerda usar la plantilla (dejando la 1ra fila intacta).' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Detect correct column names based on headers row
        const headers = Object.keys(records[0] as Record<string, unknown>);
        // Support English or Spanish headers based on the downloaded template
        const getColumn = (record: any, possibleNames: string[]) => {
            const name = possibleNames.find(n => headers.includes(n));
            return name ? record[name] : null;
        };

        const parsedUsers: {
            firstName: string,
            lastName: string,
            email: string,
            phone: string | null,
            password: string,
            rowNum: number
        }[] = [];
        const emailsInCsv = new Set<string>();

        // Pre-flight validation
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNum = i + 2; // +1 for 0-index, +1 for header row

            const firstName = getColumn(record, ['Nombre', 'First Name']);
            const lastName = getColumn(record, ['Apellido', 'Last Name']);
            const email = getColumn(record, ['Email']);
            const phone = getColumn(record, ['Teléfono', 'Phone']);
            const password = getColumn(record, ['Contraseña', 'Password']);

            if (!firstName || !lastName || !email || !password) {
                return NextResponse.json(
                    { error: `Fila ${rowNum}: Faltan campos requeridos (Nombre, Apellido, Email, Contraseña).` },
                    { status: 400, headers: corsHeaders }
                );
            }

            const cleanEmail = email.toLowerCase().trim();

            if (emailsInCsv.has(cleanEmail)) {
                return NextResponse.json(
                    { error: `Fila ${rowNum}: El email '${cleanEmail}' está duplicado dentro del mismo archivo CSV.` },
                    { status: 400, headers: corsHeaders }
                );
            }
            emailsInCsv.add(cleanEmail);

            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                return NextResponse.json(
                    { error: `Fila ${rowNum}: La contraseña para ${cleanEmail} es inválida. ${passwordValidation.message}.` },
                    { status: 400, headers: corsHeaders }
                );
            }

            parsedUsers.push({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: cleanEmail,
                phone: phone ? phone.trim() : null,
                password, // Will hash later
                rowNum
            });
        }

        // Check for existing emails in DB
        const existingUsers = await prisma.user.findMany({
            where: {
                email: {
                    in: Array.from(emailsInCsv)
                }
            },
            select: { email: true }
        });

        if (existingUsers.length > 0) {
            const duplicateEmail = existingUsers[0].email;
            // Find which row had this email
            const offendingRow = parsedUsers.find(u => u.email === duplicateEmail)?.rowNum;
            return NextResponse.json(
                { error: `Fila ${offendingRow}: El email '${duplicateEmail}' ya existe en el sistema.` },
                { status: 409, headers: corsHeaders }
            );
        }

        // If we reach here, all data is valid. Proceed with transaction.
        let createdCount = 0;

        try {
            await prisma.$transaction(async (tx) => {
                for (const userData of parsedUsers) {
                    const hashedPassword = await bcrypt.hash(userData.password, 10);

                    const newUser = await tx.user.create({
                        data: {
                            email: userData.email,
                            password: hashedPassword,
                            firstname: userData.firstName,
                            lastname: userData.lastName,
                            phone: userData.phone,
                            userroleid: 2, // Always Regular user
                            isblocked: false,
                            createddate: new Date(),
                            companyId: companyId,
                        } as any
                    });

                    createdCount++;

                    // Log the creation
                    if (callerUserId) {
                        const newName = `${newUser.firstname || ''} ${newUser.lastname || ''}`.trim();
                        await (tx as any).log.create({
                            data: { userId: callerUserId, action: `[BULK] created_user: ${newName} (id: ${newUser.id}, email: ${(newUser as any).email})` }
                        });
                    }
                }
            });

        } catch (txError: any) {
            console.error('API Users Bulk Transaction Error:', txError);
            return NextResponse.json(
                { error: `Error durante la importación. Se canceló la operación entera. Detalle: ${txError.message || 'Error de base de datos'}` },
                { status: 500, headers: corsHeaders }
            );
        }

        // Send welcome emails to all created users (await before returning response)
        try {
            const { sendWelcomeEmail } = await import('@/lib/email');
            await Promise.allSettled(
                parsedUsers.map(userData =>
                    sendWelcomeEmail(userData.email, userData.password, userData.firstName)
                )
            );
        } catch (err) {
            console.error('Error sending bulk welcome emails:', err);
        }

        return NextResponse.json({
            message: `Proceso completado exitosamente. Se crearon ${createdCount} usuarios.`,
            count: createdCount
        }, { status: 201, headers: corsHeaders });

    } catch (error: any) {
        console.error('API Users Bulk POST Error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor al procesar el archivo CSV.' },
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
