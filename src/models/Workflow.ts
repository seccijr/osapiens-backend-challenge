import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Task } from './Task';
import {WorkflowStatus} from '../factories/WorkflowFactory';

@Entity({ name: 'workflows' })
export class Workflow {
    /**
     * Unique identifier for the workflow
     * Generated automatically as UUID
     */
    @PrimaryGeneratedColumn('uuid')
    workflowId!: string;

    /**
     * Identifier for the client associated with this workflow
     */
    @Column()
    clientId!: string;

    /**
     * Current status of the workflow
     * Defaults to WorkflowStatus.Initial when created
     */
    @Column({ default: WorkflowStatus.Initial })
    status!: WorkflowStatus;

    /**
     * Collection of tasks associated with this workflow
     * Represents a one-to-many relationship with Task entity
     */
    @OneToMany(() => Task, task => task.workflow)
    tasks!: Task[];

    /**
     * Optional field to store final outcome or results of the workflow
     * Can be null when workflow is not yet complete
     */
    @Column({ type: 'text', nullable: true })
    finalResult?: string;
}