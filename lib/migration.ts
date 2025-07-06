import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import logger from "./logger";

const runPrismaToDrizzleMigrationScript = async () => {
	return db.execute(sql`
        CREATE SCHEMA drizzle;

        CREATE SEQUENCE drizzle."__drizzle_migrations_id_seq"
            INCREMENT BY 1
            MINVALUE 1
            MAXVALUE 2147483647
            START 1
            CACHE 1
            NO CYCLE;

        CREATE TABLE drizzle."__drizzle_migrations" (
            id serial4 NOT NULL,
            hash text NOT NULL,
            created_at int8 NULL,
            CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY (id)
        );   

        INSERT INTO drizzle."__drizzle_migrations"
            (id, hash, created_at)
            VALUES(1, '1ec46a86de694b1955fc7147a85248e628a60f4c7b8a4066125479d793ea4477', 1737818942346);

        ALTER TABLE "_prisma_migrations" DISABLE ROW LEVEL SECURITY;
        
        DROP TABLE "_prisma_migrations" CASCADE;
    `);
};

const checkPrismaMigrationsTable = async () => {
	try {
		const result = await db.execute(sql`
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = '_prisma_migrations';
        `);
		return result.rows.length > 0;
	} catch (e) {
		return false;
	}
};

const checkLastMigrationApplied = async () => {
	const result = await db.execute(sql`
      SELECT * FROM _prisma_migrations WHERE migration_name = '20241223001124_orphan_user_settings';
    `);
	return result.rows.length > 0;
};

export async function migrationHelper() {
	logger.info("Migration helper started.");

	const prismaTablesExist = await checkPrismaMigrationsTable();
	const lastPrismaMigrationApplied = prismaTablesExist
		? await checkLastMigrationApplied()
		: false;

	if (prismaTablesExist && lastPrismaMigrationApplied) {
		logger.info("Migrating from Prisma to Drizzle!");
		await runPrismaToDrizzleMigrationScript();
		logger.info("Created Drizzle migrations table.");
	} else if (prismaTablesExist && !lastPrismaMigrationApplied) {
		logger.error(
			"Please upgrade to v0.3.2 with all migrations applied before running upgrading to this version.",
		);
		process.exit(1);
	} else {
		logger.info("Applying fresh migration.");
	}
	migrate(db, { migrationsFolder: resolve(__dirname, "./../drizzle") });
	return;
}
