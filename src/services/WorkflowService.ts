import { Repository } from 'typeorm';

import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';

import { WorkflowStatus } from '../factories/WorkflowFactory';
import { TaskStatus } from './TaskService';

export class WorkflowService {
    constructor(
        private workflowRepository: Repository<Workflow>,
        private taskRepository: Repository<Task>,
    ) { }

    /**
     * Retrieves a workflow by its unique identifier
     * 
     * @param workflowId - The unique identifier of the workflow to retrieve
     * @returns A Promise resolving to the found Workflow object or null if not found
     */
    async getWorkflowById(workflowId: string): Promise<Workflow | null> {
        return this.workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks']
        });
    }

    /**
     * Retrieves a workflow status by its unique identifier
     * 
     * @param workflowId - The unique identifier of the workflow to retrieve
     * @returns A Promise resolving to the status of the found Workflow object or null if not found
     */
    async getWorkflowStatusById(workflowId: string): Promise<object | null> {
        const workfow = await this.getWorkflowById(workflowId);
        if (!workfow) {
            return null;
        }
        const totalTasks = workfow.tasks.length;
        const completedTasks = workfow.tasks.filter(task => task.status === TaskStatus.Completed).length;
        const failedTasks = workfow.tasks.filter(task => task.status === TaskStatus.Failed).length;
        const inProgressTasks = workfow.tasks.filter(task => task.status === TaskStatus.InProgress).length;
        const queuedTasks = workfow.tasks.filter(task => task.status === TaskStatus.Queued).length;
        const skippedTasks = workfow.tasks.filter(task => task.status === TaskStatus.Skipped).length;
        return {
            workflowId: workfow.workflowId,
            status: workfow.status,
            totalTasks,
            completedTasks,
            failedTasks,
            inProgressTasks,
            queuedTasks,
            skippedTasks
        };
    }

    /**
     * Retrieves the current status of a workflow
     * 
     * @param workflowId - The unique identifier of the workflow
     * @returns A Promise resolving to the workflow's status (enum WorkflowStatus) or null if workflow not found
     */
    async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
        const workflow = await this.getWorkflowById(workflowId);
        return workflow ? workflow.status : null;
    }

    /**
     * Retrieves all tasks that belong to a specific workflow
     * 
     * @param workflowId - The unique identifier of the workflow
     * @returns A Promise resolving to an array of Task objects associated with the workflow
     */
    async getWorkflowTasks(workflowId: string): Promise<Task[]> {
        return this.taskRepository.find({
            where: { workflow: { workflowId } }
        });
    }

    /**
     * Retrieves the final results of a completed workflow
     * 
     * @param workflowId - The unique identifier of the workflow
     * @returns A Promise resolving to the parsed JSON result object, or null if the workflow doesn't exist or has no final result
     * @remarks If the finalResult is not valid JSON, returns the raw string value
     */
    async getWorkflowResults(workflowId: string): Promise<any | null> {
        const workflow = await this.getWorkflowById(workflowId);
        if (!workflow || !workflow.finalResult) {
            return null;
        }
        try {
            return JSON.parse(workflow.finalResult);
        } catch (e) {
            return workflow.finalResult; // Return as-is if not valid JSON
        }
    }
}