import { z } from 'zod';
import type { Tool } from '../types';
import { TodoStore } from '../utils/todo-store';
import type { TodoItem, TodoStatus } from '../utils/todo-store';

// ============ 类型 ============

export { TodoStore } from '../utils/todo-store';
export type { TodoItem, TodoStatus } from '../utils/todo-store';

/** todo 入参（扁平 schema：action 必填，其余字段按 action 可选）。 */
export interface TodoInput {
  action: 'add' | 'list' | 'update' | 'delete';
  task?: string;
  id?: string;
  status?: TodoStatus;
}

/** todo 结果。 */
export type TodoResult = { item: TodoItem } | { items: TodoItem[] } | { deleted: string };

/** todo 规划引导片段（注册 todo 时由装配层注入 system prompt，兑现 AGENTS.md 6.2）。 */
export const TODO_PLANNING_GUIDANCE =
  '遇到复杂任务时，先用 todo 工具列出计划（add），再逐步执行并用 update 更新状态。' +
  'todo 只列可交付的产物步骤（如「写 <文件>」「运行 <命令>」），不要列「梳理/设计/分析」这类无产出物的软任务；每完成一个产物立即 update 为 completed。';

// ============ schema ============

const TodoInputSchema = z.object({
  action: z.enum(['add', 'list', 'update', 'delete']),
  task: z.string().optional(),
  id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

// ============ 工具 ============

/** 创建 `todo` 内置工具：单工具多 action，让 LLM 在 ReAct 循环内自然涌现任务规划。 */
export function createTodoTool(store: TodoStore): Tool<TodoInput, TodoResult> {
  return {
    name: 'builtin.todo',
    description:
      'Manage a task list to plan and track work. Actions: add (task), list, update (id, task?, status?), delete (id).',
    inputSchema: TodoInputSchema,
    execute: async (input) => {
      switch (input.action) {
        case 'add': {
          if (!input.task) throw new Error('todo add requires "task"');
          return { item: store.add(input.task) };
        }
        case 'list':
          return { items: store.list() };
        case 'update': {
          if (!input.id) throw new Error('todo update requires "id"');
          const item = store.update(input.id, { task: input.task, status: input.status });
          if (!item) throw new Error(`Todo item "${input.id}" not found`);
          return { item };
        }
        case 'delete': {
          if (!input.id) throw new Error('todo delete requires "id"');
          if (!store.delete(input.id)) throw new Error(`Todo item "${input.id}" not found`);
          return { deleted: input.id };
        }
      }
    },
  };
}
