import { DataSource } from 'typeorm';

import { Job } from '../jobs/Job';
import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { DataAnalysisJob } from '../jobs/DataAnalysisJob';
import { EmailNotificationJob } from '../jobs/EmailNotificationJob';
import { ReportGenerationJob } from '../jobs/ReportGenerationJob';

const jobMap: Record<string, (dataSource: DataSource) => Job> = {
    'analysis': (dataSource: DataSource) => new DataAnalysisJob(),
    'notification': (dataSource: DataSource) => new EmailNotificationJob(),
    'polygon_area': (dataSource: DataSource) => new PolygonAreaJob(),
    'report_generation': (dataSource: DataSource) => new ReportGenerationJob(dataSource),
};

export class WorkflowFactory {
    constructor(private dataSource: DataSource) { }

    getJobForTaskType = (taskType: string): Job => {
        const jobFactory = jobMap[taskType];
        if (!jobFactory) {
            throw new Error(`No job found for task type: ${taskType}`);
        }
        return jobFactory(this.dataSource);
    }
}