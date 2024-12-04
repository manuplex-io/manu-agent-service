// /src/activitys/entities/ob1-agent-activityCategory.entity.ts

import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Check, Unique } from 'typeorm';
import { OB1AgentActivities } from './ob1-agent-activities.entity';

@Entity('ob1-agent-activityCategories')
@Unique(['activityCategoryName', 'activityCategoryCreatedByConsultantOrgShortName'])
export class OB1AgentActivityCategory {
    @PrimaryGeneratedColumn('uuid')
    activityCategoryId: string;

    @Column({
        type: 'varchar',
        length: 16,
        comment: 'Name of the activity category (e.g., "MathOperations", "DataParsing") in camelCase only',
    })
    @Check(`"activityCategoryName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    activityCategoryName: string;

    @Column({
        type: 'text',
        comment: 'Description of activities in this category',
    })
    activityCategoryDescription: string;

    @OneToMany(() => OB1AgentActivities, (activity) => activity.activityCategory)
    activities: OB1AgentActivities[];

    @Column({
        type: 'varchar',
        //default: 'DEFALT',
        comment: 'Consultant organization short name who created this activity in camelCase only',
    })
    @Check(`"activityCategoryCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    activityCategoryCreatedByConsultantOrgShortName: string;

    //uuid for activityCategoryCreatedBypersonId,
    @Column({
        type: 'uuid',
        comment: 'Person ID of the user who created this activity category',
    })
    activityCategoryCreatedByPersonId: string;

}
