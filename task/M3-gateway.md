# PRD M3 — 网关系统

> **里程碑目标**：真实模型网关接入，Settings 页面管理 API Key，热切换 Provider，多通道模型映射。
> **前置条件**：M2 全部 ✅
> **状态**：⬜ 未开始

---

## 需求列表

### REQ-030 OpenAI 兼容 Provider ⬜

**User Story**：作为用户，我需要接入真实的 OpenAI 兼容图像/视频生成接口，替换 M1 的 stub provider。

**Acceptance Criteria**：
1. THE `OpenAIProvider` SHALL 实现 `IProvider` 接口，支持 `/v1/images/generations` 端点。
2. WHEN 请求发出，THE provider SHALL 携带 `Authorization: Bearer <key>`，key 从 `GatewayConfig` 读取，不出现在日志/LTM。
3. THE provider SHALL 支持 `model`, `size`, `n`, `response_format` 参数透传。
4. WHEN 接口返回 `base64` 格式，THE provider SHALL decode 后传给资产管线；返回 `url` 格式时 SHALL 下载字节后传入。
5. 无 `any`，响应解析使用 Zod schema 校验。

**任务**：
- [ ] `desktop/src/main/providers/openai.provider.ts`
- [ ] Zod schema 校验响应（`OpenAIImageResponse`）
- [ ] base64 / url 两种 response_format 处理
- [ ] 单元测试：mock fetch，验证 key 不泄露到日志

---

### REQ-031 第三方网关异步轮询 ⬜

**User Story**：作为系统，当第三方网关为异步任务模式（返回 task_id 轮询），我需要 JobWorker 内部处理轮询，不阻塞入队入口。

**Acceptance Criteria**：
1. WHEN provider 返回 `{ task_id, status: 'pending' }`，THE JobWorker SHALL 在 worker 内部轮询（非 renderer setInterval）直到 `completed / failed`。
2. 轮询间隔指数退避（初始 1s，最大 30s），最多轮询 60 次后标 failed。
3. THE 轮询循环 SHALL 在 job 被取消（job status 变更为 cancelled）时提前终止。
4. 轮询期间定期 emit `job.progress` IPC 事件携带当前状态。

**任务**：
- [ ] `desktop/src/main/providers/polling-strategy.ts` — 退避轮询逻辑
- [ ] JobWorker 集成 polling strategy
- [ ] 取消逻辑（检查 job status before next poll）
- [ ] 单元测试：mock 轮询，验证退避间隔 + 超限失败

---

### REQ-032 Settings 页面 — 网关管理 ⬜

**User Story**：作为用户，我需要一个设置页面来管理多个 API 网关配置，包括 Base URL、API Key、模型映射。

**Acceptance Criteria**：
1. 设置页面 SHALL 展示已有 `GatewayConfig` 列表（id / name / baseUrl / 状态）。
2. WHEN 用户添加/编辑网关，THE 表单 SHALL 包含：name、baseUrl、apiKey（password input 隐藏明文）、enabled 开关。
3. WHEN 用户保存，THE renderer SHALL 调 `settings.saveGateway` IPC，key 经 `safeStorage` 加密后存 DB。
4. 设置页不显示已保存 key 的明文，只显示 `••••••<后4位>`。
5. 路由：`/settings` 路径（React Router 或 hash routing）。

**任务**：
- [ ] `desktop/src/renderer/settings/GatewayList.tsx`
- [ ] `desktop/src/renderer/settings/GatewayForm.tsx`（新建/编辑）
- [ ] `settings.saveGateway / settings.deleteGateway` IPC handler
- [ ] key 掩码展示工具函数
- [ ] 组件测试：表单提交 → IPC 调用正确

---

### REQ-033 API Key safeStorage 加密 ⬜

**User Story**：作为系统，API Key 必须用 Electron safeStorage 加密存储，不得明文出现在 DB / 日志 / LTM。

**Acceptance Criteria**：
1. WHEN 保存 GatewayConfig，THE 主进程 SHALL 用 `safeStorage.encryptString(key)` 后存 `gateways` 表。
2. WHEN 读取 key 用于请求，THE 主进程 SHALL 用 `safeStorage.decryptString(buf)` 解密，解密值不进日志。
3. 若 `safeStorage.isEncryptionAvailable()` 返回 false，SHALL 拒绝保存并返回错误提示给用户。
4. DB `gateways.api_key` 列类型为 `BLOB`，存密文 Buffer。

**任务**：
- [ ] `desktop/src/main/security/key-vault.ts` — encrypt/decrypt 封装
- [ ] `isEncryptionAvailable` 检查 + 降级提示
- [ ] `settings.saveGateway` handler 集成 key-vault
- [ ] 单元测试：encrypt → decrypt 往返 + 明文不泄露断言

---

### REQ-034 Provider 热切换 ⬜

**User Story**：作为用户，我希望在设置中切换默认 Provider 后，后续生成任务立即使用新 Provider，不需重启。

**Acceptance Criteria**：
1. WHEN 用户在设置中切换 `defaultGatewayId`，THE 主进程 SHALL 在当前 in-flight job 完成后，后续 job 使用新 Provider。
2. THE Provider 注册表 SHALL 支持运行时注入新 `GatewayConfig`（无需重启进程）。
3. 切换时未完成的 job 继续使用原 Provider 直到结束（不中断）。

**任务**：
- [ ] `ProviderRegistry.set(config)` 热更新方法
- [ ] `settings.setDefaultGateway` IPC handler
- [ ] 集成测试：切换 → 新 job 用新 Provider

---

### REQ-035 多通道模型映射 ⬜

**User Story**：作为用户，我需要为不同节点类型（image/video）配置不同的模型，例如图片用 DALL-E，视频用 Kling。

**Acceptance Criteria**：
1. `GatewayConfig` SHALL 包含 `modelMap: Partial<Record<'imageRun' | 'videoRun', string>>`。
2. WHEN JobWorker 处理 `imageRun` job，SHALL 从当前 gateway 的 `modelMap.imageRun` 读取 model 名称传给 Provider。
3. Settings 页面 SHALL 提供 imageRun / videoRun 模型输入框。
4. model 字段为空时 fallback 到 `GatewayConfig.defaultModel`。

**任务**：
- [ ] 更新 `shared/tools-agents.ts` `GatewayConfig` 增加 `modelMap`
- [ ] JobWorker 读取 modelMap 逻辑
- [ ] Settings 表单添加 modelMap 字段
- [ ] 单元测试：modelMap 查找 + fallback

---

## 完成标准

- [ ] OpenAI 兼容 Provider 真实 e2e 生图测试通过（或沙盒 mock）
- [ ] API Key 加密/解密往返测试通过，grep 日志无明文 key
- [ ] Provider 热切换集成测试通过
- [ ] `tsc --noEmit` 无报错
- [ ] Zod schema 校验覆盖所有外部 API 响应
