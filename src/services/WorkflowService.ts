import { Repository } from 'typeorm';

import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { Workflow } from '../models/Workflow';

import { TaskStatus } from '../workers/TaskRunner';
import { WorkflowStatus } from '../factories/WorkflowFactory';

export class WorkflowService {
    constructor(
        private workflowRepository: Repository<Workflow>,
        private taskRepository: Repository<Task>,
        private resultRepository: Repository<Result>
    ) {}

    /**
     * Updates the workflow with the final aggregated results from all tasks
     * @param workflow The workflow to update with final results
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
            } else if (task.status === TaskStatus.Failed) {
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