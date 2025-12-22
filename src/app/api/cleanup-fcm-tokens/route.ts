import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { validateFCMToken } from '../../../lib/firebase-admin';

// Auto-limpieza de tokens FCM inválidos
// Se ejecuta automáticamente cada domingo a las 3 AM (UTC) via Vercel Cron
export async function GET() {
    const startTime = Date.now();
    const results = {
        totalTokens: 0,
        validatedTokens: 0,
        invalidTokens: 0,
        removedTokens: 0,
        errors: []
    };

    try {
        console.log('🧹 Iniciando limpieza automática de tokens FCM...');

        // Obtener todos los tokens de la base de datos
        const tokens = await sql`
            SELECT user_id, token 
            FROM app.user_push_tokens
        `;

        results.totalTokens = tokens.rows.length;
        console.log(`📊 Tokens encontrados: ${results.totalTokens}`);

        if (results.totalTokens === 0) {
            return NextResponse.json({
                success: true,
                message: 'No hay tokens para limpiar',
                results,
                executionTime: Date.now() - startTime
            });
        }

        const tokensToRemove = [];

        // Validar cada token con Firebase
        for (const row of tokens.rows) {
            try {
                const isValid = await validateFCMToken(row.token);

                if (isValid) {
                    results.validatedTokens++;
                    console.log(`✅ Token válido para user_id: ${row.user_id}`);
                } else {
                    tokensToRemove.push(row.user_id);
                    results.invalidTokens++;
                    console.log(`❌ Token inválido para user_id: ${row.user_id}`);
                }

            } catch (error: any) {
                console.warn(`⚠️ Error validando token user_id: ${row.user_id}`, error.message);
                results.errors.push({
                    user_id: row.user_id,
                    error: error.message
                });
            }
        }

        // Eliminar tokens inválidos en lotes
        if (tokensToRemove.length > 0) {
            console.log(`🗑️ Eliminando ${tokensToRemove.length} tokens inválidos...`);
            
            // Eliminar por lotes de 10 para evitar timeouts
            const batchSize = 10;
            for (let i = 0; i < tokensToRemove.length; i += batchSize) {
                const batch = tokensToRemove.slice(i, i + batchSize);
                
                await sql`
                    DELETE FROM app.user_push_tokens 
                    WHERE user_id = ANY(${batch})
                `;
                
                results.removedTokens += batch.length;
                console.log(`✅ Eliminado lote ${i + 1}-${i + batch.length}`);
            }
        }

        const executionTime = Date.now() - startTime;
        
        console.log(`🎉 Limpieza completada en ${executionTime}ms:`);
        console.log(`   📊 Total: ${results.totalTokens}`);
        console.log(`   ✅ Válidos: ${results.validatedTokens}`);
        console.log(`   ❌ Inválidos: ${results.invalidTokens}`);
        console.log(`   🗑️ Removidos: ${results.removedTokens}`);

        return NextResponse.json({
            success: true,
            message: 'Limpieza de tokens completada',
            results,
            executionTime
        });

    } catch (error) {
        console.error('❌ Error durante limpieza de tokens:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Error durante limpieza de tokens',
            details: error.message,
            results,
            executionTime: Date.now() - startTime
        }, { status: 500 });
    }
}

// También permitir ejecución manual vía POST
export async function POST() {
    return GET();
}