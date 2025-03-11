import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Repository } from 'typeorm';

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
    dependencies?: number[]; // Updated to support multiple task dependencies
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    /**
     * Creates a new WorkflowFactory instance.
     * 
     * This factory is responsible for generating workflow entities and their associated tasks
     * from configuration files. It handles dependency management between tasks and ensures
     * the proper initialization of workflow state.
     * 
     * @param workflowRepository - Repository for persisting and retrieving Workflow entities
     * @param taskRepository - Repository for persisting and retrieving Task entities
     */
    constructor(
        private workflowRepository: Repository<Workflow>,
        private taskRepository: Repository<Task>
    ) { }

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * 
     * This method:
     * 1. Reads and parses the YAML workflow definition
     * 2. Creates and persists a new Workflow entity with initial status
     * 3. Validates all task dependencies to ensure they reference valid steps
     * 4. Creates and persists Task entities in step order, linking dependencies
     * 5. Returns the complete persisted Workflow with all tasks properly connected
     * 
     * @param filePath - Path to the YAML file containing workflow definition
     * @param clientId - Client identifier to associate with the workflow and all tasks
     * @param geoJson - The geoJson data string to be used for spatial context in tasks
     * 
     * @throws Error If the YAML file cannot be read or parsed
     * @throws Error If any task references an invalid dependency (non-existent step number)
     * @throws Error If dependencies cannot be resolved (e.g., circular dependencies)
     * 
     * @returns A promise that resolves to the fully created and persisted Workflow entity,
     *          with all Task entities created and properly linked.
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

        // Check if all step numbers exist
        for (const step of sortedSteps) {
            existentTasks.set(step.stepNumber, true);
        }

        // Check if dependencies are valid
        for (const step of sortedSteps) {
            if (step.dependencies && step.dependencies.length > 0) {
                for (const dependency of step.dependencies) {
                    if (!existentTasks.get(dependency)) {
                        throw new Error('Invalid dependency reference');
                    }
                }
            }
        }

        for (const step of sortedSteps) {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;

            // Set dependencies if specified
            if (step.dependencies && step.dependencies.length > 0) {
                task.dependencies = [];
                for (const dependencyNumber of step.dependencies) {
                    const dependencyTask = savedTasks.get(dependencyNumber);
                    if (!dependencyTask) {
                        throw new Error('Invalid dependency reference');
                    }
                    task.dependencies.push(dependencyTask);
                }
            }

            // Save the task and store it for potential future dependencies
            const savedTask = await this.taskRepository.save(task);
            savedTasks.set(step.stepNumber, savedTask);
        }

        // Add a final reporting task if there are any steps
        if (sortedSteps.length > 0) {
            const reportingTask = new Task();
            reportingTask.clientId = clientId;
            reportingTask.geoJson = geoJson;
            reportingTask.status = TaskStatus.Queued;
            reportingTask.taskType = 'reportGeneration';
            reportingTask.stepNumber = sortedSteps[sortedSteps.length - 1].stepNumber + 1;
            reportingTask.workflow = savedWorkflow;
            reportingTask.dependencies = [];
            const savedTask = await this.taskRepository.save(reportingTask);
            savedTasks.set(reportingTask.stepNumber, savedTask);
        }

        return savedWorkflow;
    }
}