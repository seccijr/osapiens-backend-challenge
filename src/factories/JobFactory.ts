import { DataSource, Repository } from 'typeorm';

import { Job } from '../jobs/Job';
import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { DataAnalysisJob } from '../jobs/DataAnalysisJob';
import { EmailNotificationJob } from '../jobs/EmailNotificationJob';
import { ReportGenerationJob } from '../jobs/ReportGenerationJob';
import { Result } from '../models/Result';
import { Task } from '../models/Task';

const jobMap: Record<string, (resultRepository: Repository<Result>, taskRepository: Repository<Task>) => Job> = {
    'analysis': () => new DataAnalysisJob(),
    'notification': () => new EmailNotificationJob(),
    'polygon_area': () => new PolygonAreaJob(),
    'report_generation': (resultRepository: Repository<Result>, taskRepository: Repository<Task>) => new ReportGenerationJob(resultRepository, taskRepository),
};

export class JobFactory {
    constructor(
        private resultRepository: Repository<Result>, private taskRepository: Repository<Task>
    ) { }

    createJobFromTaskType = (taskType: string): Job => {
        const jobFactory = jobMap[taskType];
        if (!jobFactory) {
            throw new Error(`No job found for task type: ${taskType}`);
        }
        return jobFactory(this.resultRepository, this.taskRepository);
    }
}