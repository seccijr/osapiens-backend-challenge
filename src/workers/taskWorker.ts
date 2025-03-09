import { Repository } from 'typeorm';

import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './TaskRunner';


export class TaskWorker {
    private stopFlag = false;

    constructor(
        private taskRunner: TaskRunner,
        private taskRepository: Repository<Task>
    ) { }

    public stop = () => {
        this.stopFlag = true;
    }

    pool = async () => {
        this.stopFlag = true;
        while (!this.stopFlag) {
            const task = await this.taskRepository.findOne({
                where: { status: TaskStatus.Queued },
                relations: ['workflow'] // Ensure workflow is loaded
            });

            if (task) {
                try {
                    await this.taskRunner.run(task);
                } catch (error) {
                    console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                    console.error(error);
                }
            }

            // Wait before checking for the next task again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}