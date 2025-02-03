import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRAGTable1737400190882 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the table
        await queryRunner.query(`
            CREATE TABLE "ob1-agent-rags" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "chunkId" integer NOT NULL,
                "content" text NOT NULL,
                "ragDataMetadata" jsonb DEFAULT '{}',
                "embedding" vector,
                "dataCreatedByPersonId" uuid NOT NULL,
                "dataTags" jsonb DEFAULT '[]',
                "dataCreatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "dataUpdatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the table
        await queryRunner.query(`DROP TABLE IF EXISTS "ob1-agent-rags"`);
    }

}
