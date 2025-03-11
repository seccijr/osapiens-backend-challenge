import { TaskService } from '../services/TaskService';

/**
 * TaskWorker handles the continuous processing of tasks in the system.
 * It polls for queued tasks, prepares them for execution, and runs them in batches.
 */
export class TaskWorker {
    private stopFlag = false;
    private readonly batchSize = 10;

    /**
     * Creates a new TaskWorker instance.
     * 
     * @param taskService - The service responsible for task operations
     */
    constructor(
        private taskService: TaskService
    ) { }

    /**
     * Stops the task polling process.
     * Sets the stop flag to true, which will terminate the polling loop
     * after the current cycle completes.
     */
    public stop = () => {
        this.stopFlag = true;
    }

    /**
     * Starts the task polling process.
     * Continuously checks for queued tasks, prepares them, and executes them in batches.
     * 
     * The process follows these steps in each cycle:
     * 1. Retrieve all queued tasks
     * 2. Prepare each task for execution (updating its status)
     * 3. Get all tasks that are now ready to run
     * 4. Execute ready tasks in batches of size this.batchSize
     * 
     * The polling continues until the stop() method is called.
     * There is a 100ms delay between polling cycles to prevent excessive CPU usage.
     * 
     * @returns A Promise that resolves when polling is stopped
     */
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