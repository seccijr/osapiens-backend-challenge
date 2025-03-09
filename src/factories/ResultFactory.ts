import { Result } from "../models/Result";


export class ResultFactory {
    createResult = (taskId: string, data: string): Result => {
        const result = new Result();
        result.taskId = taskId;
        result.data = data;
        return result;
    }
}