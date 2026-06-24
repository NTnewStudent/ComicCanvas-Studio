---
globs: desktop/src/main/**,desktop/src/preload/**
---

# Electron / Node 主进程编码规范

> 适用 `desktop/src/main/**` 与 `desktop/src/preload/**`。本项目无 NestJS / 无 Redis；主进程即本地服务。

## 进程模型与安全（强制）

- `BrowserWindow.webPreferences`：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 渲染层只能通过 `preload` 用 `contextBridge.exposeInMainWorld` 暴露的白名单 API 访问主进程。
- 禁止把整个 `ipcRenderer` 暴露给渲染层；只暴露具名、参数受校验的方法。
- 所有 `ipcMain.handle` 入参用 Zod 校验后再进 service。
- 自定义资产协议（如 `cc-asset://`）用 `protocol.handle` 注册，做路径越界校验（限制在 `appData/assets/` 内）。

## IPC 契约

- 通道名与负载类型定义在 `shared/ipc.ts`，前后端共享，单端不可私加通道。
- 命名：`domain.action`（如 `canvas.runNode`、`job.subscribe`）。
- 请求/响应 + 事件分离：请求走 `invoke/handle`，主动推送走 `webContents.send` + 渲染层订阅。

## 任务队列

- 队列状态持久化到 SQLite `jobs` 表，进程重启可恢复 `pending`/`processing`。
- 入队入口 ≤1s 返回票据；绝不在入口同步等待模型。
- 终态事件（`job.completed`/`job.failed`）每个 jobId 恰好一次。

## 密钥与隐私

- 模型 API key 走 OS 安全存储（keytar / safeStorage），不落明文配置、不进日志、不进 LTM。
- 错误日志做密钥红化（参考 `ltm-memory-format.md` 的红化规则）。

## 错误处理

- service 抛领域错误（含 code + message），handler 统一包成 `{ code, message, data }` 返回。
- 禁止吞异常。

## 分层

- handler 薄、service 厚、DB 访问走仓储层。
- 纯逻辑（矩阵校验、prompt 拼接、orientation 判定）放可测纯函数模块。
