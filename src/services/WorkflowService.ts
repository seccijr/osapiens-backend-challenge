import { Repository } from 'typeorm';

import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';

import { TaskStatus } from './TaskService';
import { WorkflowStatus } from '../factories/WorkflowFactory';

export class WorkflowService {
    constructor(
        private workflowRepository: Repository<Workflow>,
        private taskRepository: Repository<Task>,
        private resultRepository: Repository<Result>
    ) { }

    /**
     * Retrieves a workflow by its unique identifier
     * 
     * @param workflowId - The unique identifier of the workflow to retrieve
     * @returns A Promise resolving to the found Workflow object or null if not found
     */
    async getWorkflowById(workflowId: string): Promise<Workflow | null> {
        return this.workflowRepository.findOne({
            where: { workflowId }
        });
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

    /**
     * Aggregates results from all tasks in a workflow and updates the workflow with final results
     * 
     * @param workflow - The workflow object to update with aggregated results
     * @returns A Promise that resolves when the workflow has been updated with final results
     * @remarks
     * This method:
     * 1. Collects results from all tasks belonging to the workflow
     * 2. Builds a summary including completed and failed task counts
     * 3. Updates the workflow status to either Completed or Failed based on all tasks' outcomes
     * 4. Persists the updated workflow to the database with stringified results
     */
    async updateWorkflowFinalResult(workflow: Workflow): Promise<void> {
        // Retrieve all tasks for this workflow
        const tasks = await this.taskRepository.find({
            where: { workflow: { workflowId: workflow.workflowId } }
        });

        // Prepare the final result structure
        const finalResult: any = {
            tasks: [],
            summary: {
                completedTasks: 0,
                failedTasks: 0
            },
            success: true
        };

        // Process each task and collect results
        for (const task of tasks) {
            const taskInfo: any = {
                taskId: task.taskId,
                taskType: task.taskType,
                status: task.status
            };

            if (task.status === TaskStatus.Completed && task.resultId) {
                // Get the task result data for completed tasks
                const result = await this.resultRepository.findOne({
                    where: { taskId: task.taskId }
                });

                if (result && result.data) {
                    taskInfo.result = JSON.parse(result.data);
                    finalResult.summary.completedTasks++;
                }
            } else {
                // Add error information for failed tasks
                taskInfo.error = task.progress; // Error message is stored in the progress field
                finalResult.summary.failedTasks++;
                finalResult.success = false;
            }

            finalResult.tasks.push(taskInfo);
        }

        // Update the workflow with final result
        workflow.finalResult = JSON.stringify(finalResult);

        // Update workflow status based on task results
        if (finalResult.success) {
            workflow.status = WorkflowStatus.Completed;
        } else {
            workflow.status = WorkflowStatus.Failed;
        }

        // Save the updated workflow
        await this.workflowRepository.save(workflow);
    }
}