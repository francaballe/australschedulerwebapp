// Helper to build database URL from individual environment variables
export const buildDatabaseUrl = (): string => {
    const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;

    if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_PORT || !DB_NAME) {
        throw new Error('Missing required database environment variables (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)');
    }

    return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require`;
};

// Set DATABASE_URL in process.env for Prisma schema
if (typeof process !== 'undefined' && process.env) {
    try {
        process.env.DATABASE_URL = buildDatabaseUrl();
    } catch (error) {
        // Silently fail during build if variables aren't available yet
        console.warn('⚠️ Database URL not constructed:', (error as Error).message);
    }
}