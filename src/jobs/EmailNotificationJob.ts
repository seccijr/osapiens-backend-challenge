import { Job } from './Job';
import { Task } from '../models/Task';

export class EmailNotificationJob implements Job {
    async run(task: Task): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}