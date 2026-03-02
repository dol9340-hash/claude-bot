import { SdkExecutor } from './sdk-executor.js';
import type { IExecutor } from './types.js';

export function createExecutor(): IExecutor {
  return new SdkExecutor();
}
