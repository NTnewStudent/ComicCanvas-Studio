/**
 * 确定性 Prompt 拼接 — 前后端唯一真源
 *
 * 纯函数：无 DB / 网络 / 随机 / 时间依赖。
 * 相同入参必产出字节等价结果。
 */

import type { NodeType, CanvasEdgeData, TextNodeData, ImageNodeData, VideoNodeData } from './nodes'

// ── Graph Snapshot 类型 ─────────────────────────────────────

export interface SnapshotNode {
  id: string
  type: NodeType
  data: TextNodeData | ImageNodeData | VideoNodeData
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
      if (d.assetId) referenceImages.push({ nodeId: srcNode.id, assetId: d.assetId })
    } else if (srcNode.type === 'video') {
      const d = srcNode.data as VideoNodeData
      if (d.assetId) referenceVideos.push({ nodeId: srcNode.id, assetId: d.assetId })
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
