import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Workflow } from './Workflow';
import { TaskStatus } from '../services/TaskService';
import { Result } from './Result';

/**
 * Entity representing a task in the system.
 * Tasks are operations that can be part of a workflow and may have dependencies on other tasks.
 */
@Entity({ name: 'tasks' })
export class Task {
    /**
     * Unique identifier for the task, automatically generated as UUID.
     */
    @PrimaryGeneratedColumn('uuid')
    taskId!: string;

    /**
     * ID of the client that owns this task.
     */
    @Column()
    clientId!: string;

    /**
     * GeoJSON representation of the geographical data associated with this task.
     * Stored as a text field in the database.
     */
    @Column('text')
    geoJson!: string;

    /**
     * Current status of the task (e.g., PENDING, IN_PROGRESS, COMPLETED, FAILED).
     * Uses the TaskStatus enum from TaskService.
     */
    @Column()
    status!: TaskStatus;

    /**
     * Optional field tracking the progress of the task.
     * Can be used to store percentage completion or status messages.
     */
    @Column({ nullable: true, type: 'text' })
    progress?: string | null;

    /**
     * Optional reference to the ID of the result produced by this task.
     */
    @Column({ nullable: true })
    resultId?: string;

    /**
     * Results that depend on this task.
     * Represents a one-to-many relationship with the Result entity.
     */
    @OneToMany(() => Result, result => result.dependentTasks)
    dependencyResults?: Result[];

    /**
     * Type of the task, indicating what operation it performs.
     */
    @Column()
    taskType!: string;

    /**
     * Position of this task in a multi-step workflow.
     * Defaults to 1 if not specified.
     */
    @Column({ default: 1 })
    stepNumber!: number;

    /**
     * The workflow to which this task belongs.
     * Represents a many-to-one relationship with the Workflow entity.
     */
    @ManyToOne(() => Workflow, workflow => workflow.tasks)
    workflow!: Workflow;

    /**
     * Other tasks that this task depends on.
     * Represents a many-to-many self-referential relationship.
     */
    @ManyToMany(() => Task)
    @JoinTable()
    dependencies?: Task[];
}