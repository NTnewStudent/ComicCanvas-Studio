# Design Document — <FEATURE>

> Source of truth：同目录 `requirements.md`。

## Overview

<总体改造思路，对应 R1..Rn + INV-1..INV-n。>

## Architecture

```mermaid
sequenceDiagram
  participant R as Renderer
  participant M as Main
  participant Q as JobQueue
  participant P as Provider
  R->>M: IPC 请求
  M->>Q: 入队 + 返回票据
  Q->>P: 调模型
  P-->>Q: 字节/结果
  Q-->>R: IPC 事件(终态)
```

## Components and Interfaces

### <组件>
<接口签名 + 集成点。>

## Data Models

| 表/字段 | 类型 | 备注 |
| :--- | :--- | :--- |

## Correctness Properties

### Property 1: <名>
*For any* ...

**Validates: Requirements x.y**

## Testing Strategy

| INV | 测试层 | 思路 |
| :--- | :--- | :--- |

## Migration & Cutover

| 阶段 | 内容 | 可逆性 |
| :--- | :--- | :--- |
