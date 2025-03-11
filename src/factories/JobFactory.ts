import { Repository } from 'typeorm';

import { Job } from '../jobs/Job';
import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { DataAnalysisJob } from '../jobs/DataAnalysisJob';
import { EmailNotificationJob } from '../jobs/EmailNotificationJob';
import { ReportGenerationJob } from '../jobs/ReportGenerationJob';
import { Result } from '../models/Result';
import { Task } from '../models/Task';

/**
 * Map of task types to their corresponding job factory functions.
 * Each factory function creates an instance of the appropriate job class
 * based on the task type, injecting required repositories when needed.
 */
const jobMap: Record<string, (resultRepository: Repository<Result>, taskRepository: Repository<Task>) => Job> = {
    'analysis': () => new DataAnalysisJob(),
    'notification': () => new EmailNotificationJob(),
    'polygonArea': () => new PolygonAreaJob(),
    'reportGeneration': (resultRepository: Repository<Result>, taskRepository: Repository<Task>) => new ReportGenerationJob(resultRepository, taskRepository),
};

/**
 * Factory class responsible for creating appropriate Job instances based on task types.
 * Uses the repository pattern to provide data access to jobs that require it.
 */
export class JobFactory {
    /**
     * Creates a new JobFactory instance.
     * 
     * @param resultRepository - Repository for accessing and managing Result entities
     * @param taskRepository - Repository for accessing and managing Task entities
     */
    constructor(
        private resultRepository: Repository<Result>, 
        private taskRepository: Repository<Task>
    ) { }

    /**
     * Creates and returns a Job instance based on the provided task type.
     * 
     * @param taskType - The type of task for which to create a job
     * @returns A Job instance corresponding to the task type
     * @throws Error if no job implementation is found for the given task type
     */
    createJobFromTaskType = (taskType: string): Job => {
        const jobFactory = jobMap[taskType];
        if (!jobFactory) {
            throw new Error(`No job found for task type: ${taskType}`);
        }
        return jobFactory(this.resultRepository, this.taskRepository);
    }
}