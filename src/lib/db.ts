import { neon } from '@neondatabase/serverless';

const getConnectionString = () => {
    const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;

    if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_NAME) {
        console.warn('⚠️ Missing database environment variables');
        // Return a dummy string to avoid crash during build/init, but it will fail on query
        return '';
    }

    // Neon connection string format
    return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}?sslmode=require`;
};

const connectionString = getConnectionString();
const sql = neon(connectionString);

export default sql;
