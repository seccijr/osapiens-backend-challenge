import { Result } from "../models/Result";

/**
 * Factory responsible for creating Result objects in a standardized way.
 * This factory encapsulates the creation logic for Result entities.
 */
export class ResultFactory {
    /**
     * Creates and initializes a new Result object.
     * 
     * @param taskId - The unique identifier of the task associated with this result
     * @param data - The result data content as a string
     * @returns A fully initialized Result object
     */
    createResult = (taskId: string, data: string): Result => {
        const result = new Result();
        result.taskId = taskId;
        result.data = data;
        return result;
    }
}