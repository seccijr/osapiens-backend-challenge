import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource, Repository } from 'typeorm';

import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../services/TaskService';

export const enum WorkflowStatus {
    Initial = 'initial',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    dependency?: number; // Added to support task dependencies
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {

    constructor(
        private workflowRepository: Repository<Workflow>,
        private taskRepository: Repository<Task>
    ) { }

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(filePath: string, clientId: string, geoJson: string): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
        const workflow = new Workflow();

        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;

        const savedWorkflow = await this.workflowRepository.save(workflow);

        // Store the saved tasks by their step number to resolve dependencies
        const existentTasks = new Map<number, boolean>();
        const savedTasks = new Map<number, Task>();

        // Process steps in order to properly handle dependencies
        const sortedSteps = [...workflowDef.steps].sort((a, b) => a.stepNumber - b.stepNumber);

        // Check if dependencies are valid
        for (const step of sortedSteps) {
            if (step.dependency !== undefined) {
                const independentTask = existentTasks.get(step.dependency);
                if (!independentTask) {
                    throw new Error('Invalid dependency reference');
                }
            }
            existentTasks.set(step.stepNumber, true);
        }

        for (const step of sortedSteps) {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;

            // Set dependency if specified
            if (step.dependency !== undefined) {
                const independentTask = savedTasks.get(step.dependency);
                if (!independentTask) {
                    throw new Error('Invalid dependency reference');
                }
                task.dependency = independentTask;
            }

            // Save the task and store it for potential future dependencies
            const savedTask = await this.taskRepository.save(task);
            savedTasks.set(step.stepNumber, savedTask);
        }

        return savedWorkflow;
    }
}