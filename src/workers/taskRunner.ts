import { DataSource, Repository } from 'typeorm';

import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';
import { JobFactory } from '../factories/JobFactory';
import { WorkflowStatus } from '../factories/WorkflowFactory';
import { ResultFactory } from '../factories/ResultFactory';


export const enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

export class TaskRunner {
    constructor(
        private workflowRepository: Repository<Workflow>,
        private resultRepository: Repository<Result>,
        private taskRepository: Repository<Task>,
        private resultFactory: ResultFactory,
        private jobFactory: JobFactory
    ) { }

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        // Check and handle dependencies before running the task
        if (task.dependency) {
            const dependencyresult = await this.processDependency(task.dependency);
            task.dependencyResultId = dependencyresult.resultId;
        }

        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
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

    /**
     * Processes a task dependency by checking its status and retrieving its output data
     * @param dependency - The dependent task
     * @returns The parsed output data from the dependent task
     * @throws If the dependent task doesn't exist, failed, or hasn't completed
     */
    private async processDependency(dependency: Task): Promise<Result> {
        // Get the latest status of the dependent task
        let independentTask = await this.taskRepository.findOne({
            where: { taskId: dependency.taskId }
        });

        if (!independentTask) {
            throw new Error('Dependent task not found');
        }

        // Check status of dependency
        if (independentTask.status === TaskStatus.Failed) {
            throw new Error('Dependent task failed');
        }

        if (independentTask.status !== TaskStatus.Completed) {
            // Wait for the dependency to complete
            await this.waitForDependencyToComplete(independentTask.taskId);

            // Get fresh data after waiting
            independentTask = await this.taskRepository.findOne({
                where: { taskId: dependency.taskId }
            });

            if (!independentTask || independentTask.status !== TaskStatus.Completed) {
                throw new Error('Dependent task did not complete successfully');
            }

        }

        const result = await this.resultRepository.findOne({
            where: { resultId: independentTask.resultId }
        });

        return result!;
    }

    /**
     * Waits for a dependency to complete by polling its status
     * @param taskId - The ID of the dependent task
     */
    private async waitForDependencyToComplete(taskId: string): Promise<void> {
        let attempts = 0;
        const maxAttempts = 60; // Maximum number of attempts (can be adjusted)
        const pollingInterval = 1000; // 1 second interval

        while (attempts < maxAttempts) {
            const independentTask = await this.taskRepository.findOne({
                where: { taskId }
            });

            if (!independentTask) {
                throw new Error('Dependent task not found');
            }

            if (independentTask.status === TaskStatus.Completed) {
                return; // Dependency is complete, continue with the task
            }

            if (independentTask.status === TaskStatus.Failed) {
                throw new Error('Dependent task failed');
            }

            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
            attempts++;
        }

        throw new Error('Timed out waiting for dependent task to complete');
    }
}