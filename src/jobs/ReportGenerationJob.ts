import { DataSource, Repository } from 'typeorm';

import { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { TaskStatus } from '../workers/TaskRunner';

export class ReportGenerationJob implements Job {
    private resultRepository: Repository<Result>;
    private taskRepository: Repository<Task>;

    constructor(
        private dataSource: DataSource
    ) {
        this.resultRepository = this.dataSource.getRepository(Result);
        this.taskRepository = this.dataSource.getRepository(Task);
    }

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
