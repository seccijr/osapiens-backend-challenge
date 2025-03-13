import { DataSource } from 'typeorm';
import { Task } from '../../../src/models/Task';
import { Result } from '../../../src/models/Result';
import { Workflow } from '../../../src/models/Workflow';

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    dropSchema: true,
    entities: [Task, Result, Workflow],
    synchronize: true,
    logging: false,
});
