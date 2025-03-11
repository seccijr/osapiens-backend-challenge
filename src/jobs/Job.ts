import { Task } from '../models/Task';

/**
 * Interface representing a job that can be executed on a task.
 * Jobs implement the specific business logic to process different types of tasks.
 */
export interface Job {
    /**
     * Executes the job logic on the provided task.
     * 
     * @param task - The task to be processed by this job
     * @returns A promise that resolves with the result of the job execution
     * @throws May throw an error if the job execution fails
     */
    run(task: Task): Promise<any>;
}