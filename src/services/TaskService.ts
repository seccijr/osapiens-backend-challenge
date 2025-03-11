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
    constructor(
        private workflowRepository: Repository<Workflow>,
        private resultRepository: Repository<Result>,
        private taskRepository: Repository<Task>,
        private resultFactory: ResultFactory,
        private jobFactory: JobFactory
    ) { }

    /**
    * Prepares a task by checking workflow step order and dependencies status.
    * Task can only proceed if all previous steps are completed/failed.
    * Task status will be set based on dependencies:
    * - Skipped: if any dependency failed
    * - Ready: if all dependencies completed
    * - Queued: if any previous step or dependency is still in progress
    * 
    * @param task - The task to prepare
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
     * Fetches all tasks that are ready to be executed (all dependencies resolved)
     * @returns Array of tasks that are ready to be executed
     */
    async getReadyTasks(): Promise<Task[]> {
        return await this.taskRepository.find({
            where: {
                status: TaskStatus.Ready
            },
            relations: ['dependencies']
        });
    }

    /**
     * Fetches all tasks that are queued
     * @returns Array of tasks that are ready to be executed
     */
    async getQueuedTasks(): Promise<Task[]> {
        return await this.taskRepository.find({
            where: {
                status: TaskStatus.Queued
            },
            relations: ['dependencies']
        });
    }

    async checkTaskDependenciesStatus(task: Task): Promise<TaskStatus> {
        if (!task.dependencies || task.dependencies.length === 0) {
            return TaskStatus.Completed;
        }

        const dependencies = await this.taskRepository.findBy({
            taskId: In(task.dependencies.map(dep => dep.taskId!))
        });

        const anyFailed = dependencies.some(dependency => dependency.status === TaskStatus.Failed);
        if (anyFailed) {
            return TaskStatus.Failed;
        }
        const anyInprogressOrQueued = dependencies.some(
            dependency => dependency.status === TaskStatus.InProgress || dependency.status === TaskStatus.Queued
        );
        if (anyInprogressOrQueued) {
            return TaskStatus.Queued;
        }
        const allCompleted = dependencies.every(dependency =>
            dependency.status === TaskStatus.Completed
        );
        return allCompleted ? TaskStatus.Completed : TaskStatus.Queued;
    }

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
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
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