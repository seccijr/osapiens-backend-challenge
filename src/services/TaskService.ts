import { DataSource, Repository, In } from 'typeorm';

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

export class TaskService {
    constructor(
        private workflowRepository: Repository<Workflow>,
        private resultRepository: Repository<Result>,
        private taskRepository: Repository<Task>,
        private resultFactory: ResultFactory,
        private jobFactory: JobFactory
    ) { }

    /**
     * Fetches all tasks that are ready to be executed (all dependencies resolved)
     * @param workflowId - The ID of the workflow
     * @returns Array of tasks that are ready to be executed
     */
    async getReadyTasks(workflowId: string): Promise<Task[]> {
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks', 'tasks.dependencies']
        });

        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        // Filter tasks that are queued and have all dependencies completed
        return workflow.tasks.filter(task => {
            // Task must be in queued state
            if (task.status !== TaskStatus.Queued) {
                return false;
            }

            // If no dependencies, task is ready
            if (!task.dependencies || task.dependencies.length === 0) {
                return true;
            }

            // Check if all dependencies are completed
            return task.dependencies.every(dependency =>
                dependency.status === TaskStatus.Completed || dependency.status === TaskStatus.Failed
            );
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

    async getDependenciesResults(task: Task): Promise<any[]> {
        if (!task.dependencies || task.dependencies.length === 0) {
            return [];
        }

        const dependencies = await this.taskRepository.findBy({
            taskId: In(task.dependencies.map(dep => dep.taskId!))
        });

        const results = await this.resultRepository.findBy({
            resultId: In(dependencies.map(dep => dep.resultId!))
        });

        return results.filter(result => result && result.resultId).map(result => result.resultId);
    }

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        const dependenciesStatus = await this.checkTaskDependenciesStatus(task);
        if (dependenciesStatus === TaskStatus.Queued) {
            task.status = TaskStatus.Queued;
            await this.taskRepository.save(task);
            return;
        }
        if (dependenciesStatus === TaskStatus.Failed) {
            task.status = TaskStatus.Failed;
            await this.taskRepository.save(task);
            return;
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