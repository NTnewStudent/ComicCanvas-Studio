/**
 * Drizzle table definitions for the M1 SQLite persistence baseline.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const schemaTables = [
  'jobs',
  'assets',
  'asset_folders',
  'asset_references',
  'asset_categories',
  'asset_category_assignments',
  'workflows',
  'workflow_versions',
  'chat_messages',
  'gateway_configs',
  'storage_configs',
  'tools',
  'tool_audit',
  'agents',
  'agent_runs',
  'skills',
  'skill_invocations',
  'style_presets',
  'canvas_snippets',
  'knowledge_documents',
  'knowledge_chunks',
  'context_packs'
] as const

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  targetId: text('target_id'),
  payloadJson: text('payload_json').notNull(),
  resultJson: text('result_json'),
  errorClass: text('error_class'),
  errorMessage: text('error_message'),
  retryable: integer('retryable', { mode: 'boolean' }).notNull().default(false),
  leaseOwner: text('lease_owner'),
  attempts: integer('attempts').notNull().default(0),
  progress: integer('progress').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  mediaType: text('media_type').notNull(),
  status: text('status').notNull(),
  relativePath: text('rel_path').notNull(),
  safeUrl: text('safe_url').notNull(),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  orientation: text('orientation'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  hash: text('hash'),
  url: text('url'),
  s3Key: text('s3_key'),
  folderId: text('folder_id'),
  tagsJson: text('tags_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const assetFolders = sqliteTable('asset_folders', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  relativePath: text('rel_path').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const assetReferences = sqliteTable('asset_references', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  refType: text('ref_type').notNull(),
  refId: text('ref_id').notNull(),
  createdAt: integer('created_at').notNull()
})

export const assetCategories = sqliteTable('asset_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  kind: text('kind').notNull().default('image'),
  description: text('description'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const assetCategoryAssignments = sqliteTable('asset_category_assignments', {
  assetId: text('asset_id').notNull(),
  categoryId: text('category_id').notNull(),
  createdAt: integer('created_at').notNull()
})

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull().default('draft'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  defaultStylePresetId: text('default_style_preset_id'),
  coverAssetId: text('cover_asset_id'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  visibility: text('visibility').notNull().default('private'),
  ownerId: text('owner_id').notNull().default('user-local'),
  tagsJson: text('tags_json').notNull().default('[]'),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const stylePresets = sqliteTable('style_presets', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  promptBefore: text('prompt_before'),
  promptAfter: text('prompt_after'),
  legacyPromptPreset: text('legacy_prompt_preset'),
  negativePrompt: text('negative_prompt'),
  coverAssetId: text('cover_asset_id'),
  tagsJson: text('tags_json').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const canvasSnippets = sqliteTable('canvas_snippets', {
  id: text('id').primaryKey(),
  schemaVersion: integer('schema_version').notNull().default(1),
  name: text('name').notNull(),
  description: text('description'),
  scope: text('scope').notNull().default('my'),
  ownerId: text('owner_id').notNull().default('user-local'),
  tagsJson: text('tags_json').notNull().default('[]'),
  thumbnailUrl: text('thumbnail_url'),
  nodesJson: text('nodes_json').notNull(),
  edgesJson: text('edges_json').notNull(),
  nodeCount: integer('node_count').notNull(),
  edgeCount: integer('edge_count').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const workflowVersions = sqliteTable('workflow_versions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  graphJson: text('graph_json').notNull(),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  restoreSourceVersionId: text('restore_source_version_id'),
  validationWarningsJson: text('validation_warnings_json')
})

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id'),
  agentRunId: text('agent_run_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  planJson: text('plan_json'),
  applyStatus: text('apply_status'),
  createdAt: integer('created_at').notNull()
})

export const gatewayConfigs = sqliteTable('gateway_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  baseUrl: text('base_url').notNull(),
  keyRef: text('key_ref'),
  capabilitiesJson: text('capabilities_json').notNull(),
  modelMapJson: text('model_map_json').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const storageConfigs = sqliteTable('storage_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  endpoint: text('endpoint').notNull(),
  region: text('region'),
  bucket: text('bucket').notNull(),
  accessKeyId: text('access_key_id').notNull(),
  keyRef: text('key_ref').notNull(),
  ciphertext: text('ciphertext').notNull(),
  publicUrlPrefix: text('public_url_prefix'),
  updatedAt: integer('updated_at').notNull()
})

export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),
  ownerKind: text('owner_kind').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  schemaJson: text('schema_json').notNull(),
  permissionJson: text('permission_json').notNull(),
  concurrency: text('concurrency').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const toolAudit = sqliteTable('tool_audit', {
  id: text('id').primaryKey(),
  traceId: text('trace_id').notNull(),
  toolId: text('tool_id').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  capability: text('capability').notNull(),
  targetJson: text('target_json').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason').notNull(),
  createdAt: integer('created_at').notNull()
})

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  policyJson: text('policy_json').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  jobId: text('job_id'),
  status: text('status').notNull(),
  contextPackId: text('context_pack_id'),
  traceJson: text('trace_json').notNull(),
  errorClass: text('error_class'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  version: text('version').notNull(),
  name: text('name').notNull(),
  entry: text('entry').notNull(),
  metadataJson: text('metadata_json').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const skillInvocations = sqliteTable('skill_invocations', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull(),
  version: text('version').notNull(),
  agentRunId: text('agent_run_id').notNull(),
  loadedRefsJson: text('loaded_refs_json').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull()
})

export const knowledgeDocuments = sqliteTable('knowledge_documents', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(),
  sourceRef: text('source_ref').notNull(),
  scopeJson: text('scope_json').notNull(),
  status: text('status').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at')
})

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  ordinal: integer('ordinal').notNull(),
  text: text('text').notNull(),
  metadataJson: text('metadata_json').notNull(),
  embeddingRef: text('embedding_ref'),
  createdAt: integer('created_at').notNull()
})

export const contextPacks = sqliteTable('context_packs', {
  id: text('id').primaryKey(),
  agentRunId: text('agent_run_id'),
  summaryJson: text('summary_json').notNull(),
  sourceRefsJson: text('source_refs_json').notNull(),
  redactionsJson: text('redactions_json').notNull(),
  createdAt: integer('created_at').notNull()
})
