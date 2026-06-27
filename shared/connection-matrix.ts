/**
 * 节点连接矩阵 — 前后端唯一真源
 * 前端 onConnect、后端图校验器、Plan 清洗器都消费此函数。
 * @see docs/api-contracts/connection-matrix.md
 */

import type { NodeType } from './nodes'

export const NODE_CONNECTION_MATRIX: Readonly<Record<NodeType, ReadonlyArray<NodeType>>> = {
  text: ['text', 'image', 'video', 'audio', 'character', 'scene', 'imageConfigV2', 'videoConfigV2', 'mjImage'],
  image: ['image', 'video', 'character', 'scene', 'imageConfigV2', 'videoConfigV2', 'mjImage'],
  video: ['video', 'videoCompose', 'superResolution', 'videoConfigV2', 'muxAudioVideo'],
  character: ['image', 'video', 'character', 'scene', 'imageConfigV2', 'videoConfigV2', 'mjImage'],
  scene: ['image', 'video', 'character', 'scene', 'imageConfigV2', 'videoConfigV2', 'mjImage'],
  audio: ['video', 'videoConfigV2', 'muxAudioVideo'],
  imageConfigV2: ['image', 'video', 'character', 'scene', 'imageConfigV2', 'videoConfigV2', 'mjImage'],
  videoConfigV2: ['video', 'videoCompose', 'superResolution'],
  videoCompose: ['video'],
  superResolution: ['video'],
  muxAudioVideo: ['video'],
  mjImage: ['image', 'video', 'character', 'scene', 'imageConfigV2', 'videoConfigV2'],
}

/**
 * 判断两个节点类型是否可连接。
 * @param upstream - 上游节点类型
 * @param downstream - 下游节点类型
 */
export function canConnect(upstream: NodeType, downstream: NodeType): boolean {
  return NODE_CONNECTION_MATRIX[upstream]?.includes(downstream) ?? false
}
