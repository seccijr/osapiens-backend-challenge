import { TaskService } from '../services/TaskService';

export class TaskWorker {
    private stopFlag = false;
    private readonly batchSize = 10;

    constructor(
        private taskService: TaskService
    ) { }

    public stop = () => {
        this.stopFlag = true;
    }

    pool = async () => {
        this.stopFlag = false;
        while (!this.stopFlag) {
            try {
                // 1. Get all queued tasks using TaskService
                const queuedTasks = await this.taskService.getQueuedTasks();

                // 2. Prepare all queued tasks (updating their status)
                for (const task of queuedTasks) {
                    try {
                        await this.taskService.prepare(task);
                    } catch (error) {
                        console.error(`Error preparing task ${task.taskId}:`, error);
                    }
                }

                // 3. Get tasks that are now ready to run
                const readyTasks = await this.taskService.getReadyTasks();

                // 4. Run ready tasks in batches
                for (let i = 0; i < readyTasks.length; i += this.batchSize) {
                    const batch = readyTasks.slice(i, i + this.batchSize);
                    await Promise.all(batch.map(async (task) => {
                        try {
                            await this.taskService.run(task);
                        } catch (error) {
                            console.error(`Error running task ${task.taskId}:`, error);
                        }
                    }));
                }
            } catch (error) {
                console.error('Error during task pool cycle:', error);
            }

            // Wait before next polling cycle
            if (!this.stopFlag) {
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                break;
            }
        }
    }
}