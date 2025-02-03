import { MigrationInterface, QueryRunner } from "typeorm";

export class PromptValidateColumn1737598623074 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            ADD COLUMN "validationRequired" BOOLEAN NOT NULL DEFAULT false;
        `);
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            ADD COLUMN "validationGate" BOOLEAN NOT NULL DEFAULT false;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            DROP COLUMN "validationRequired";
        `);
        await queryRunner.query(`
            ALTER TABLE IF EXISTS "ob1-agent-prompts" 
            DROP COLUMN "validationGate";
        `);
    }
}
