import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Task } from './Task';

@Entity({name: 'results'})
export class Result {
    @PrimaryGeneratedColumn('uuid')
    resultId!: string;

    @Column()
    taskId!: string;

    @ManyToOne(() => Task, task => task.dependencyResults)
    dependentTasks?: Task;

    @Column('text')
    data!: string | null; // Could be JSON or any serialized format
}