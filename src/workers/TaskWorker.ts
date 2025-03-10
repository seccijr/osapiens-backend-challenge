import { Repository } from 'typeorm';

import { Task } from '../models/Task';
import { TaskService, TaskStatus } from '../services/TaskService';


export class TaskWorker {
    private stopFlag = false;

    constructor(
        private taskService: TaskService,
        private taskRepository: Repository<Task>
    ) { }

    public stop = () => {
        this.stopFlag = true;
    }

    pool = async () => {
        this.stopFlag = false;
        while (!this.stopFlag) {
            const tasks = await this.taskRepository.find({
                where: { status: TaskStatus.Queued },
                relations: ['workflow'] // Ensure workflow is loaded
            });

            // Chunk tasks in batches of 10 task to avoid running all tasks at once
            for (let i = 0; i < tasks.length; i += 10) {
                const chunk = tasks.slice(i, i + 10);
                await Promise.all(chunk.map(async (task) => {
                    if (task) {
                        try {
                            await this.taskService.run(task);
                        } catch (error) {
                            console.error('Task execution failed. Task status has already been updated by TaskService.');
                            console.error(error);
                        }
                    }
                }));
            }

            // Wait before checking for the next task again
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}