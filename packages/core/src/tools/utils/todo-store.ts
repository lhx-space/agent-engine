export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  id: string;
  task: string;
  status: TodoStatus;
}

/** 内存态待办存储（随会话结束消失；跨进程持久化留 M3 长期后端）。 */
export class TodoStore {
  private readonly items: TodoItem[] = [];
  private seq = 0;

  add(task: string): TodoItem {
    this.seq += 1;
    const item: TodoItem = { id: `todo_${this.seq}`, task, status: 'pending' };
    this.items.push(item);
    return item;
  }

  list(): TodoItem[] {
    return [...this.items];
  }

  update(id: string, patch: { task?: string; status?: TodoStatus }): TodoItem | undefined {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return undefined;
    if (patch.task !== undefined) item.task = patch.task;
    if (patch.status !== undefined) item.status = patch.status;
    return item;
  }

  delete(id: string): boolean {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }
}
