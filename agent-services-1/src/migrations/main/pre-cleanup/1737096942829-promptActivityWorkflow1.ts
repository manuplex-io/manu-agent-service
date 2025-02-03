import { MigrationInterface, QueryRunner } from "typeorm";

export class PromptActivityWorkflow11737096942829 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            ADD COLUMN "promptAvailableActivities" TEXT[];
        `);
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            ADD COLUMN "promptAvailableWorkflows" TEXT[];
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ob1-agent-prompts" 
            DROP COLUMN "promptAvailableActivities";
        `);
        await queryRunner.query(`
            ALTER TABLE "ob1-agent-prompts" 
            DROP COLUMN "promptAvailableWorkflows";
        `);
    }
}
