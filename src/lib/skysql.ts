import mariadb from 'mariadb';
import dotenv from 'dotenv';
dotenv.config();

interface SkySQLConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    ssl?: boolean | object;
    connectionLimit?: number;
}

class SkySQLClient {
    private pool: mariadb.Pool;
    public config: SkySQLConfig;

    constructor(config: SkySQLConfig) {
        this.config = config;
        this.pool = mariadb.createPool({
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            port: config.port || 3306,
            ssl: config.ssl ?? true,
            connectionLimit: config.connectionLimit || 5,
        });
    }

    async getConnection(): Promise<mariadb.PoolConnection> {
        return this.pool.getConnection();
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    async query(sql: string, params?: any[]): Promise<any> {
        const conn = await this.getConnection();
        try {
            return await conn.query(sql, params);
        } finally {
            await conn.end();
        }
    }
}

const skysqlConfig: SkySQLConfig = {
    host: process.env.VITE_SKYSQL_HOSTNAME!,
    user: process.env.VITE_SKYSQL_USERNAME!,
    password: process.env.VITE_SKYSQL_PASSWORD!,
    database: process.env.VITE_SKYSQL_DATABASE!,
    port: parseInt(process.env.VITE_SKYSQL_PORT || '3306', 10),
}

if (!skysqlConfig.host || !skysqlConfig.user || !skysqlConfig.password || !skysqlConfig.database) {
    throw new Error('Missing SkySQL environment variables');
}

const skysql = new SkySQLClient(skysqlConfig);

export default skysql;
