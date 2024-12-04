// /src/workflows/entities/ob1-agent-workflowActivities.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
} from 'typeorm';
import { OB1AgentWorkflows } from './ob1-agent-workflows.entity';
import { OB1AgentActivities } from '../../activity/entities/ob1-agent-activities.entity';

@Entity('ob1-agent-workflowActivities')
export class OB1AgentWorkflowActivities {
    @PrimaryGeneratedColumn('uuid')
    workflowActivityId: string;

    @ManyToOne(() => OB1AgentWorkflows, (workflow) => workflow.workflowActivities, {
        onDelete: 'CASCADE', // Workflow deletion will delete this relationship
        onUpdate: 'CASCADE',
    })
    workflow: OB1AgentWorkflows;

    @ManyToOne(() => OB1AgentActivities, (activity) => activity.activityWorkflows, {
        onDelete: 'RESTRICT', // Prevent deletion of an activity if it's linked to a workflow
        onUpdate: 'CASCADE',
    })
    activity: OB1AgentActivities;
}
