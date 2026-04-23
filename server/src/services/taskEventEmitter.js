import { EventEmitter } from 'events';

// Singleton event emitter for task status broadcasts
class TaskEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE clients
  }

  emitTaskUpdate(taskId, data) {
    this.emit(`task:${taskId}`, data);
    this.emit('task:any', { taskId, ...data }); // Broadcast to wildcard listeners
  }
}

export const taskEvents = new TaskEventEmitter();