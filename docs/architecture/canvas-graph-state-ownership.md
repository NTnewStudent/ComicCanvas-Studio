# Canvas 渲染层图状态归属模型

> 状态：设计说明，履行 `specs/hjwall-canvas-full-migration/tasks.md`
> task 7（"确定并记录渲染层图状态归属模型"）。
> 范围：调和
> `docs/architecture/infinite-canvas-architecture.md` §"Graph State Ownership"
> 中的理想模型，与
> `desktop/src/renderer/src/canvas/CanvasPage.tsx` 和
> `desktop/src/renderer/src/canvas/store/canvas.store.ts` 中截至 2026-07-04
> 的实际双写实现之间的差异。
> Requirements: R3, R9.

## 1. 当前实现（as-built）

渲染层中存在两份实时的图副本：

- **Zustand（`canvasStore`）** — 持久化快照：`nodes`、`edges`、
  `viewport`、`past`/`future` undo 历史（上限 50 条，`canvas.store.ts:81`），
  以及 `nodeRunStatus`（一个 `Map`，明确排除在 undo/redo 之外，
  `canvas.store.ts:60-61`）。结构性 action（`addNode`、`deleteNode`、
  `addEdge`、`deleteEdge`、`applyChange`）各自通过
  `pushHistory`（`canvas.store.ts:95-100`）推入一条历史记录。`updateNodeData`
  以及批量替换器 `setNodes`/`setEdges` **不会**推入历史记录。
- **React Flow 本地状态（`rfNodes`/`rfEdges`）** — 由
  `useNodesState`/`useEdgesState`（`CanvasPage.tsx:514-515`）创建，在挂载时
  从 store 一次性播种（`:506-513`）。这些 hook 的 `onNodesChange`/
  `onEdgesChange` 直接接到 `<ReactFlow>`（`:1717-1718`）上，因此每一次拖拽、
  resize、选中变化都先改动这份副本，而不是 store。

两份副本之间的同步是双向的，且两个方向各自独立地做防抖/守卫：

- **RF → Zustand**：`persistToStore`（`:660-684`）是
  `debounce(..., 300ms)`，由针对 `[rfNodes, rfEdges]` 的
  `useEffect`（`:686-690`）触发。它调用 `setNodes`/`setEdges`，这是一次
  **不推历史记录**的批量替换——这是有意为之的设计，避免每一次按键/拖拽帧
  都往 undo 里灌记录。
- **Zustand → RF**：`syncReactFlowFromStore`（`:539-544`）先设置
  `skipNextPersistRef` 守卫，然后从 store 快照调用
  `setRfNodes`/`setRfEdges`。该守卫会在 `persistToStore`（`:662`）内部被
  检查一次，用来吞掉本应由这次同步自身触发的 RF 更新所引发的回声。

有两条变更路径完全绕开了这个往返同步：

- **CanvasPage 直接写 store**：`handleNodeDragStop`（`:963-981`）、
  `handleAddNode`（`:1000-1046`）和 `appendAssetNode`（`:1417-1425`）
  直接调用 `canvasStore.setState(...)`，而不是走 store 自身的 `addNode`/
  `updateNodeData` action，在组件内联复制了 store 的历史记录/克隆逻辑，
  而不是复用它。
- **实时任务终态回写**：`onJobCompleted`/`onJobFailed`
  （`:717-744`）直接调用 `canvasStore.getState().updateNodeData(...)`，
  然后立即调用 `syncReactFlowFromStore()`——先 store 后 RF，且无防抖。
  这与用户编辑的顺序（先 RF、300ms 后再到 store）恰好相反。

自动保存（`:803-814`）是第三个独立的计时器：每次 `[rfNodes, rfEdges]`
变化都会重置一个 2000ms 的 `setTimeout`，只有当 `isDirtyRef.current` 为
true 时才触发 `handleSave()`。`isDirtyRef` 在 `persistToStore` 的 effect
中以及视口移动时被置位，在保存成功或刚加载完成后被清除。`handleSave`
读取的是 `canvasStore.getState()`（而非 `rfNodes`/`rfEdges`）——也就是说
自动保存的*触发条件*监视的是 RF 本地状态，但保存的*负载*来自 store 当前
持有的内容，这依赖于 300ms 的 RF→store 防抖已经完成刷新。

`useCanvasRealtime()`（`use-canvas-realtime.ts`）与图状态无关：它只是让
asset/job 列表查询的 TanStack Query 缓存失效，从不触及 `canvasStore` 或
RF 本地状态。

## 2. 归属模型（此后具有约束力）

本节是一项决策，不是对未来某次重写的描述。新代码必须遵循它；现有的偏差
在 §4 中作为已知差距被追踪。

- **Zustand（`canvasStore`）是唯一的持久化真源。** 任何必须在刷新后存活、
  进入保存负载、出现在 undo/redo 中，或需要被其他子系统（Agent tools、
  job 回写、片段插入）看到的内容，都必须存在于 store 中，并从
  `canvasStore.getState()` 读取，绝不能从 `rfNodes`/`rfEdges` 推断。
- **React Flow 本地状态是渲染缓存，不是第二套模型。** 它相对 store 最多
  可以滞后一个防抖周期。任何代码都不得将 `rfNodes`/`rfEdges` 视为除
  "正在绘制的当前帧"（拖拽预览、实时选框、进行中的连线）之外任何事情的
  权威数据源。
- **所有持久化变更都必须经由以下三个入口之一进入**：store 自身的
  action（`addNode`/`deleteNode`/`updateNodeData`/`addEdge`/`deleteEdge`/
  `applyChange`）、`shared/canvas-actions.ts` 中的共享图 action（供
  Tool/Agent 路径使用），或者防抖的 RF→store 同步。组件代码不得直接调用
  `canvasStore.setState(...)`——这会绕过 `pushHistory`，并有写入与 store
  自身 action 本应归一化的形状不一致的数据的风险。
- **undo/redo 按设计仅覆盖结构性变更。** 节点/边的增加、删除、连接，以及
  完整快照应用，是 undo 可见的；逐字段的数据编辑（`updateNodeData`，
  包括任务驱动的状态/资产补丁）与批量 RF 同步替换（`setNodes`/
  `setEdges`）则不是。这符合用户的预期——在文本节点里打字或后台任务
  完成，不应该占用一个本应属于无关结构性操作的 undo 槽位——但这也意味着
  用户无法撤销"任务完成并覆盖了我的占位符"这类情况，本阶段接受这一点
  是有意的取舍。
- **实时任务回写必须先 store、再协调 RF**，正如 `onJobCompleted`/
  `onJobFailed` 目前已经做的那样——这个顺序是正确的，应作为任何新的
  实时驱动变更的模板，原因正是 RF 是 store 的渲染缓存，而不是反过来。
- **自动保存必须始终保存 store 快照**，绝不能直接保存
  `rfNodes`/`rfEdges`，因为只有 store 应用了共享图 action 的归一化逻辑。
  dirty 标志可以监视 RF 本地变化作为一种廉价的"有没有东西变了"信号，
  但保存负载必须来自 `canvasStore.getState()`。

## 3. 同步不变量

1. 一次 RF 本地变更会在一个 `persistToStore` 防抖窗口（300ms）内反映到
   store，除非它本身是 store→RF 同步引发的回声（由 `skipNextPersistRef`
   守卫）。
2. 由实时任务回写、undo/redo，或 Agent tool 调用驱动的 store 变更，会
   通过 `syncReactFlowFromStore` 同步反映到 RF 本地状态，无防抖，因此
   画布在任务完成或 undo 触发时永远不会出现可见的滞后。
3. 自动保存只能在不变量 (1) 有机会完成刷新之后才读取 store：自动保存
   计时器的 2000ms 被有意设置得比持久化防抖的 300ms 更长，这样在计时器
   边界触发的保存所读取到的 store 快照，已经反映了触发它的那次编辑。
   任何把自动保存延迟缩短到持久化防抖的约 2 倍以下的改动，都应被视为
   对该不变量的回归风险，而不仅仅是一次 UX 微调。
4. `nodeRunStatus` 与 undo 历史是 store 内部关注的事情；RF 从不直接读取
   或写入它们。

## 4. 已知差距（已追踪，本说明不修复）

- `handleNodeDragStop`、`handleAddNode` 和 `appendAssetNode` 通过
  `canvasStore.setState(...)` 写入 store，而不是走 store 的公开 action。
  这在目前是可行的，但在 `CanvasPage.tsx` 中重复了
  `pushHistory`/克隆逻辑，一旦 store 内部快照形状发生变化就会产生偏移。
  后续动作：将这三处调用点重构为使用 store 自身的 action（或补充缺失的
  action，例如为 drag-stop 新增一个 `moveNode` action）。
- `skipNextPersistRef` 是一个没有队列的单一布尔值。在 300ms 防抖触发前
  连续快速调用两次 `syncReactFlowFromStore()`（例如 undo 之后紧接着一个
  job 终态事件），理论上可能出现第二次同步的守卫被本应用于第一次同步的
  防抖消耗掉的情况。由于两次同步都推送的是*当前*的 store 快照，实际影响
  大概率是无害的（无论哪种情况 RF 最终都会与最新的 store 状态一致），
  但这一点未经测试，在未来使 `syncReactFlowFromStore` 的负载依赖于
  具体调用内容的改动下，不应被假定为安全。
- 没有测试演练交错的竞态场景："自动保存在 undo 进行中触发"，或"一个
  实时任务更新在 undo 过程中到达"。`tests/canvas-store.test.ts` 和
  `tests/canvas-job-reconciliation.test.ts` 是分别孤立测试 undo 和 job
  协调的；`tests/canvas-realtime-invalidation.test.ts` 只覆盖查询缓存
  失效，不覆盖图变更的顺序。
- 自动保存延迟（2000ms）与 RF→store 持久化延迟（300ms）是两个独立、
  互不协调的计时器。如果自动保存延迟被缩短到持久化防抖的大约 2 倍以下，
  保存操作就可能抢在触发它的那次 RF 编辑完成之前发生。目前没有任何断言
  将这两个常量绑定在一起。

## 5. 后续任务

- 为 §4 中的交错场景（autosave-during-undo、realtime-update-during-undo）
  补充回归测试，前提是有维护者决定当前"大概率无害"的行为应该被锁定
  还是进一步加固。
- 将 `handleNodeDragStop`/`handleAddNode`/`appendAssetNode` 重构为使用
  store action，从 `CanvasPage.tsx` 中移除直接的 `canvasStore.setState()`
  调用。
- 考虑引入一个具名常量（而不是两个互不关联的魔法数字），将自动保存延迟
  与持久化防抖关联起来，使未来的改动无法悄悄破坏上面的不变量 3。
