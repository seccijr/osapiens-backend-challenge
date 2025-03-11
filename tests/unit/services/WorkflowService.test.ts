import { Repository } from 'typeorm';

import { Task } from '../../../src/models/Task';
import { Result } from '../../../src/models/Result';
import { Workflow } from '../../../src/models/Workflow';
import { WorkflowService } from '../../../src/services/WorkflowService';

describe('WorkflowService', () => {
    let service: WorkflowService;
    let mockWorkflowRepository: Repository<Workflow>;
    let mockTaskRepository: Repository<Task>;
    let mockResultRepository: Repository<Result>;

    beforeEach(() => {
        mockWorkflowRepository = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation(workflow => Promise.resolve(workflow)),
        } as unknown as Repository<Workflow>;

        mockTaskRepository = {
            find: jest.fn(),
        } as unknown as Repository<Task>;

        mockResultRepository = {
            findOne: jest.fn(),
        } as unknown as Repository<Result>;

        service = new WorkflowService(
            mockWorkflowRepository,
            mockTaskRepository
        );
    });
});