import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Task } from './Task';

/**
 * Entity representing a result of a task execution.
 * Stores the outcome data from task processing.
 */
@Entity({ name: 'results' })
export class Result {
    /**
     * Unique identifier for the result record.
     * Automatically generated as UUID.
     */
    @PrimaryGeneratedColumn('uuid')
    resultId!: string;

    /**
     * Reference to the task that produced this result.
     * Foreign key to the tasks table.
     */
    @Column()
    taskId!: string;

    /**
     * Relationship to tasks that depend on this result.
     * Represents the task(s) that use this result as input.
     */
    @ManyToOne(() => Task, task => task.dependencyResults)
    dependentTasks?: Task;

    /**
     * The actual result data in text format.
     * May contain JSON or other serialized data structures.
     * Can be null if the task hasn't completed successfully.
     */
    @Column('text')
    data!: string | null;
}