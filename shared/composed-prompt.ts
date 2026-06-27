/**
 * 确定性 Prompt 拼接 — 前后端唯一真源
 *
 * 纯函数：无 DB / 网络 / 随机 / 时间依赖。
 * 相同入参必产出字节等价结果。
 */

import type {
  NodeType,
  CanvasEdgeData,
  CanvasNodeData,
  TextNodeData,
  ImageNodeData,
  VideoNodeData,
  CharacterNodeData,
  SceneNodeData,
  MjImageNodeData
} from './nodes'

// ── Graph Snapshot 类型 ─────────────────────────────────────

export interface SnapshotNode {
  id: string
  type: NodeType
  data: CanvasNodeData
}

export interface SnapshotEdge {
  id: string
  source: string
  target: string
  data: CanvasEdgeData
}

export interface GraphSnapshot {
  nodes: SnapshotNode[]
  edges: SnapshotEdge[]
}

// ── Asset 引用 ───────────────────────────────────────────────

export interface AssetRef {
  nodeId: string
  assetId: string
}

// ── 固定中文前缀 ─────────────────────────────────────────────

const IMAGE_REF_PREFIX = '参考图像：'
const VIDEO_REF_PREFIX = '参考视频：'

// ── 核心函数 ─────────────────────────────────────────────────

function pushAssetRef(refs: AssetRef[], nodeId: string, assetId: string | null | undefined): void {
  if (!assetId) return
  if (refs.some((ref) => ref.nodeId === nodeId && ref.assetId === assetId)) return
  refs.push({ nodeId, assetId })
}

function semanticLine(kind: string, label: string, content: string | undefined): string | null {
  const normalized = content?.trim()
  if (!normalized) return null
  return `${kind} ${label}: ${normalized}`
}

export function composeFinalPrompt(
  graph: GraphSnapshot,
  nodeId: string,
): { composedPrompt: string; referenceImages: AssetRef[]; referenceVideos: AssetRef[] } {
  // 收集所有入边（source → nodeId），按 edge.data.createdAt 升序
  const inEdges = graph.edges
    .filter((e) => e.target === nodeId)
    .sort((a, b) => a.data.createdAt - b.data.createdAt)

  const textParts: string[] = []
  const referenceImages: AssetRef[] = []
  const referenceVideos: AssetRef[] = []

  for (const edge of inEdges) {
    const srcNode = graph.nodes.find((n) => n.id === edge.source)
    if (!srcNode) continue

    if (srcNode.type === 'text') {
      const d = srcNode.data as TextNodeData
      if (d.content) textParts.push(d.content)
    } else if (srcNode.type === 'image') {
      const d = srcNode.data as ImageNodeData
      pushAssetRef(referenceImages, srcNode.id, d.assetId)
    } else if (srcNode.type === 'video') {
      const d = srcNode.data as VideoNodeData
      pushAssetRef(referenceVideos, srcNode.id, d.assetId)
    } else if (srcNode.type === 'character') {
      const d = srcNode.data as CharacterNodeData
      const line = semanticLine('Character', d.label, d.description)
      if (line) textParts.push(line)
      pushAssetRef(referenceImages, srcNode.id, d.assetId)
    } else if (srcNode.type === 'scene') {
      const d = srcNode.data as SceneNodeData
      const line = semanticLine('Scene', d.label, d.description)
      if (line) textParts.push(line)
      pushAssetRef(referenceImages, srcNode.id, d.assetId)
    } else if (srcNode.type === 'mjImage') {
      const d = srcNode.data as MjImageNodeData
      const line = semanticLine('MJ Image', d.label, d.prompt)
      if (line) textParts.push(line)
      pushAssetRef(referenceImages, srcNode.id, d.assetId)
    }
  }

  // 当前节点自身的 promptOverride
  const selfNode = graph.nodes.find((n) => n.id === nodeId)
  const promptOverride =
    selfNode && selfNode.type !== 'text'
      ? (selfNode.data as ImageNodeData | VideoNodeData).promptOverride
      : ''

  // 组装 prefix（有引用资产时添加固定前缀）
  const prefixParts: string[] = []
  if (referenceImages.length > 0) prefixParts.push(IMAGE_REF_PREFIX)
  if (referenceVideos.length > 0) prefixParts.push(VIDEO_REF_PREFIX)

  const allParts = [...prefixParts, ...textParts]
  if (promptOverride) allParts.push(promptOverride)

  const composedPrompt = allParts.join('\n')

  return { composedPrompt, referenceImages, referenceVideos }
}
