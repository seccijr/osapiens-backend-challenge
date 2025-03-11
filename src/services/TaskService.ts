import { Repository, In } from 'typeorm';

import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';
import { JobFactory } from '../factories/JobFactory';
import { WorkflowStatus } from '../factories/WorkflowFactory';
import { ResultFactory } from '../factories/ResultFactory';


export const enum TaskStatus {
    Queued = 'queued',
    Ready = 'ready',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
    Skipped = 'skipped'
}

export class TaskService {
    /**
     * Creates a new TaskService instance for managing task execution and workflow state.
     * 
     * @param workflowRepository - Repository for workflow entity operations
     * @param resultRepository - Repository for result entity operations
     * @param taskRepository - Repository for task entity operations
     * @param resultFactory - Factory for creating task result objects
     * @param jobFactory - Factory for creating job instances based on task type
     */
    constructor(
        private workflowRepository: Repository<Workflow>,
        private resultRepository: Repository<Result>,
        private taskRepository: Repository<Task>,
        private resultFactory: ResultFactory,
        private jobFactory: JobFactory
    ) { }

    /**
     * Prepares a task for execution by evaluating workflow ordering and dependencies.
     * Updates the task's status based on the current workflow state:
     * - Sets to Ready when all prerequisites are fulfilled
     * - Sets to Queued when prior tasks or dependencies are still processing
     * - Sets to Skipped when any dependency has failed
     * 
     * @param task - The task to prepare for execution
     * @throws Error if the associated workflow cannot be found
     */
    async prepare(task: Task): Promise<void> {
        // Load the full workflow with tasks
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId: task.workflow.workflowId },
            relations: ['tasks']
        });

        if (!workflow) {
            throw new Error(`Workflow ${task.workflow.workflowId} not found`);
        }

        // Check if all previous tasks (by step number) are completed or failed
        const previousTasksIncomplete = workflow.tasks.some(t =>
            t.stepNumber < task.stepNumber &&
            t.status !== TaskStatus.Completed &&
            t.status !== TaskStatus.Failed
        );

        if (previousTasksIncomplete) {
            task.status = TaskStatus.Queued;
            await this.taskRepository.save(task);
            return;
        }

        // All previous tasks are done, now check dependencies
        if (!task.dependencies || task.dependencies.length === 0) {
            // No dependencies, task is ready
            task.status = TaskStatus.Ready;
            await this.taskRepository.save(task);
            return;
        }

        // Check status of all dependencies
        const anyFailed = task.dependencies.some(dep => dep.status === TaskStatus.Failed);
        if (anyFailed) {
            task.status = TaskStatus.Skipped;
            await this.taskRepository.save(task);
            return;
        }

        const allCompleted = task.dependencies.every(dep => dep.status === TaskStatus.Completed);
        if (allCompleted) {
            task.status = TaskStatus.Ready;
        } else {
            // Some dependency is still in progress, ready, or queued
            task.status = TaskStatus.Queued;
        }

        await this.taskRepository.save(task);
    }

    /**
     * Retrieves all tasks that are in Ready state and can be executed immediately.
     * Ready tasks have all dependencies resolved and prerequisites completed.
     * 
     * @returns Promise resolving to an array of tasks ready for execution
     */
    async getReadyTasks(): Promise<Task[]> {
        return await this.taskRepository.find({
            where: {
                status: TaskStatus.Ready
            },
            relations: ['dependencies', 'workflow']
        });
    }

    /**
     * Retrieves all tasks that are in Queued state waiting for dependencies or prerequisites.
     * Queued tasks cannot be executed yet but will be eligible later when dependencies resolve.
     * 
     * @returns Promise resolving to an array of queued tasks
     */
    async getQueuedTasks(): Promise<Task[]> {
        return await this.taskRepository.find({
            where: {
                status: TaskStatus.Queued
            },
            relations: ['dependencies', 'workflow']
        });
    }

    /**
     * Retrieves the result data from all dependency tasks for the given task.
     * The results can be used as inputs for the task's job execution.
     * 
     * @param task - The task whose dependency results are needed
     * @returns Promise resolving to an array of Result objects from dependencies,
     *          or empty array if no dependencies exist
     */
    async getDependenciesResults(task: Task): Promise<Result[]> {
        if (!task.dependencies || task.dependencies.length === 0) {
            return [];
        }

        const dependencies = await this.taskRepository.findBy({
            taskId: In(task.dependencies.map(dep => dep.taskId!))
        });

        const results = await this.resultRepository.findBy({
            resultId: In(dependencies.map(dep => dep.resultId!))
        });

        return results;
    }

    /**
     * Executes the task by running the appropriate job based on task type.
     * Manages the entire task lifecycle:
     * 1. Updates task status to InProgress
     * 2. Loads dependency results
     * 3. Executes the appropriate job
     * 4. Stores execution results
     * 5. Updates task and workflow statuses
     * 
     * @param task - The task to execute
     * @throws Error if task isn't in Ready state
     * @throws Error if job execution fails (after updating task status to Failed)
     */
    async run(task: Task): Promise<void> {
        if (task.status !== TaskStatus.Ready) {
            throw new Error(`Task ${task.taskId} is not ready to run`);
        }

        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        task.dependencyResults = await this.getDependenciesResults(task);
        await this.taskRepository.save(task);

        const job = this.jobFactory.createJobFromTaskType(task.taskType);

        try {
            const taskResult = await job.run(task);
            const result = this.resultFactory.createResult(task.taskId!, JSON.stringify(taskResult || {}));
            await this.resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);

        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);

            throw error;
        }

        const currentWorkflow = await this.workflowRepository.findOne({
            where: {
                workflowId: task.workflow.workflowId
            },
            relations: ['tasks']
        });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
            const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            await this.workflowRepository.save(currentWorkflow);
        }
    }
}