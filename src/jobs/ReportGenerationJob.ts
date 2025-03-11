import { Repository } from 'typeorm';

import { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { TaskStatus } from '../services/TaskService';

/**
 * ReportGenerationJob is responsible for generating summary reports for workflows
 * by aggregating results from all tasks within the workflow.
 * 
 * This job collects data from completed tasks, tracks statistics on task completion
 * status, and produces a comprehensive report of workflow execution.
 */
export class ReportGenerationJob implements Job {

    /**
     * Creates a new instance of ReportGenerationJob
     * 
     * @param resultRepository - Repository for accessing task results data
     * @param taskRepository - Repository for accessing task data
     */
    constructor(
        private resultRepository: Repository<Result>,
        private taskRepository: Repository<Task>
    ) { }

    /**
     * Executes the report generation process for a given task.
     * 
     * This method:
     * 1. Retrieves all tasks belonging to the same workflow
     * 2. Processes each task to collect its status and result data
     * 3. Calculates summary statistics (completed/failed tasks)
     * 4. Generates a structured report with task details and summary metrics
     * 
     * @param task - The task triggering the report generation, must be associated with a workflow
     * @returns A structured report object containing workflow information, task details, and summary statistics
     * @throws Error if the task has no associated workflow ID
     */
    async run(task: Task): Promise<any> {
        if (!task.workflow || !task.workflow.workflowId) {
            throw new Error('WorkflowId is required');
        }

        // Find all tasks in the workflow
        const workflowTasks = await this.taskRepository.find({
            relations: ['workflow'],
            where: {
                workflow: {
                    workflowId: task.workflow.workflowId
                }
            }
        });

        // Filter out the current report task
        const precedingTasks = workflowTasks.filter(t => t.taskId !== task.taskId);

        // Initialize counters for summary
        let completedTasks = 0;
        let failedTasks = 0;

        // Process all tasks and collect their data
        const processedTasks = await Promise.all(precedingTasks.map(async t => {
            const taskInfo: any = {
                taskId: t.taskId,
                type: t.taskType,
                status: t.status.toLowerCase()
            };

            if (t.status === TaskStatus.Completed && t.resultId) {
                // Task completed successfully, get its result
                const taskResult = await this.resultRepository.findOne({
                    where: { taskId: t.taskId }
                });

                if (taskResult && taskResult.data) {
                    taskInfo.output = JSON.parse(taskResult.data);
                }
                completedTasks++;
            } else if (t.status === TaskStatus.Failed) {
                // Task failed, include error information
                taskInfo.error = t.progress || 'Unknown error';
                failedTasks++;
            }

            return taskInfo;
        }));

        // Create the final report
        const totalTasks = precedingTasks.length;
        let finalReportMessage = 'Aggregated data and results';

        if (totalTasks === 0) {
            finalReportMessage = 'No tasks found in workflow';
        }

        return {
            workflow: {
                workflowId: task.workflow.workflowId
            },
            tasks: processedTasks,
            summary: {
                totalTasks,
                completedTasks,
                failedTasks
            },
            finalReport: finalReportMessage
        };
    }
}
