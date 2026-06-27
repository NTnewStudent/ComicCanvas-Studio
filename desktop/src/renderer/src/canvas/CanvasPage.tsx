/**
 * 閸忋劌鐫?ReactFlow 閻㈣绔锋い鐢告桨 閳?閹恒儱鍙?canvas store 閸滃矁濡悙鍦矋娴?
 * 閹嗗厴娴兼ê瀵查敍?
 * 1. ReactFlow 閸愬懐鐤?useNodesState/useEdgesState 娴ｆ粈璐熺€圭偞妞傞悩鑸碘偓浣圭爱
 * 2. Zustand store 娴犲懐鏁ゆ禍搴㈠瘮娑斿懎瀵查敍鍧塭bounced閿涘鎷伴幘銈夋敘/闁插秴浠?
 * 3. nodeTypes 鐎规矮绠熼崷銊х矋娴犺泛顦婚柈顭掔礄濡€虫健缁狙嶇礆闁灝鍘ら柌宥嗚閺?
 * 4. 閼哄倻鍋ｇ紒鍕瀹稿弶鍧婇崝?React.memo閿涘牐顫嗛崥鍕Ν閻愯鏋冩禒璁圭礆
 * 5. 閹碘偓閺堝娲栫拫鍐暏 useCallback 缁嬪啿鐣鹃崠?
 * @see docs/api-contracts/canvas-plan.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  BackgroundVariant,
  SelectionMode,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type OnConnect,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import {
  IconArrowLeft,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPlayerPlay,
  IconTypography,
  IconPhoto,
  IconVideo,
  IconCopy,
  IconTrash,
  IconFileText,
  IconPhotoPlus,
  IconMovie,
  IconDeviceFloppy,
  IconCheck,
  IconLoader2,
  IconPlus,
  IconX,
  IconFolder,
  IconMessage,
  IconListDetails,
  IconMoon,
  IconSun,
  IconChevronDown,
  IconHandGrab,
  IconPointer,
  IconSearch,
} from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import { useStore } from 'zustand'

import { useThemeStore } from '../stores/useThemeStore'

import {
  canvasStore,
  type CanvasStoreNode,
  type CanvasStoreEdge,
} from './store/canvas.store'
import { TextNode } from './nodes/TextNode'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import ImageConfigV2Node from './nodes/ImageConfigV2Node'
import VideoConfigV2Node from './nodes/VideoConfigV2Node'
import { MigratedNode } from './nodes/MigratedNode'
import { useCanvasRealtime } from './hooks/use-canvas-realtime'
import { ProjectManager } from './components/ProjectManager'
import CanvasChatBox from './components/CanvasChatBox'
import { CanvasAssetPanel } from './components/CanvasAssetPanel'
import { ProjectStyleSelector } from './components/ProjectStyleSelector'
import { CanvasJobPanel } from './components/CanvasJobPanel'
import { CanvasCommandPalette, type CanvasCommand } from './components/CanvasCommandPalette'
import { ConnectionFeedback } from './components/ConnectionFeedback'
import { createCanvasPlanExecutionController } from './lib/canvas-plan-execution'
import { reconcileCanvasNodesWithJobs } from './lib/job-reconciliation'
import { guardWorkflowSwitch, installDirtyBeforeUnloadGuard } from './lib/workflow-switch-guard'
import { extractCanvasSnippet, insertCanvasSnippet, type CanvasSnippet } from './lib/canvas-snippet'
import { createCanvasEdge } from './lib/canvas-edge-creation'
import { connectCreatedCanvasNode } from './lib/canvas-connect-to-create'
import { deleteSelectedCanvasNodes, duplicateSelectedCanvasNodes } from './lib/canvas-selection-actions'
import type { ConnectionValidationFeedback } from './lib/connection-validation'
import type { ApplyPlanOptions } from '../chat/PlanCard'
import './canvas.css'

import type {
  NodeType,
  TextNodeData,
  ImageNodeData,
  VideoNodeData,
  CanvasNodeData,
  CanvasEdgeData,
} from '../../../../../shared/nodes'
import type { AssetRecord } from '../../../../../shared/assets'
import type { CanvasPlan } from '../../../../../shared/plan'
import type { CanvasGraphSnapshot } from '../../../../../shared/graph'
import type { CanvasSnippetView } from '../../../../../shared/snippets'
import { planLocalMediaDrop } from './lib/local-media-drop'

/* 閳光偓閳光偓閳光偓 Debounce utility 閳光偓閳光偓閳光偓 */

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: never[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as unknown as T
}

/* 閳光偓閳光偓閳光偓 Default data factories 閳光偓閳光偓閳光偓 */

function defaultNodeData(type: NodeType, sequence: number): CanvasNodeData {
  if (type === 'text') return { label: `Text ${sequence}`, content: '' }
  if (type === 'character') return { label: `Character ${sequence}`, description: '', assetId: null, tags: [] }
  if (type === 'scene') return { label: `Scene ${sequence}`, description: '', assetId: null, category: '' }
  if (type === 'audio') return { label: `Audio ${sequence}`, assetId: null, durationSeconds: 0, status: 'idle' }
  if (type === 'videoCompose')
    return {
      label: `Video Compose ${sequence}`,
      inputOrder: [],
      transitionName: null,
      modelId: 'stub-compose',
      assetId: null,
      status: 'idle',
    }
  if (type === 'superResolution')
    return {
      label: `Super Resolution ${sequence}`,
      scene: 'aigc',
      resolution: '1080p',
      fps: 30,
      assetId: null,
      status: 'idle',
    }
  if (type === 'muxAudioVideo')
    return { label: `Mux Audio Video ${sequence}`, modelId: 'stub-mux', assetId: null, status: 'idle' }
  if (type === 'mjImage')
    return {
      label: `MJ Image ${sequence}`,
      prompt: '',
      modelId: 'stub-mj',
      ratio: '16:9',
      urls: [],
      selectedIndex: 0,
      assetId: null,
      status: 'idle',
    }
  if (type === 'image' || type === 'imageConfigV2')
    return {
      label: type === 'imageConfigV2' ? `Image Generation ${sequence}` : `Image ${sequence}`,
      promptOverride: '',
      modelId: 'stub-image',
      orientation: 'landscape',
      assetId: null,
      status: 'idle',
    }
  return {
    label: type === 'videoConfigV2' ? `Video Generation ${sequence}` : `Video ${sequence}`,
    promptOverride: '',
    modelId: 'stub-video',
    orientation: 'landscape',
    durationSeconds: 3,
    firstFrameAssetId: null,
    lastFrameAssetId: null,
    assetId: null,
    status: 'idle',
  }
}

/* 閳光偓閳光偓閳光偓 Node wrapper 鐏?store 閸ョ偠鐨熷▔銊ュ弳 ReactFlow 閼奉亜濮╂导鐘插弳閻?props 閳光偓閳光偓閳光偓 */

function TextNodeWrapper({
  id,
  data,
  selected,
}: {
  id: string
  data: TextNodeData
  selected?: boolean
}): JSX.Element {
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const handleChange = useCallback(
    (nodeId: string, patch: Partial<TextNodeData>) =>
      updateNodeData(nodeId, patch),
    [updateNodeData],
  )
  const handleRename = useCallback(
    (nodeId: string, label: string) => updateNodeData(nodeId, { label }),
    [updateNodeData],
  )
  return (
    <TextNode
      id={id}
      data={data}
      selected={selected ?? false}
      onChange={handleChange}
      onRename={handleRename}
    />
  )
}

function ImageNodeWrapper({
  id,
  data,
  selected,
}: {
  id: string
  data: ImageNodeData
  selected?: boolean
}): JSX.Element {
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const handleChange = useCallback(
    (nodeId: string, patch: Partial<ImageNodeData>) =>
      updateNodeData(nodeId, patch),
    [updateNodeData],
  )
  return (
    <ImageNode
      id={id}
      data={data}
      {...(data.url ? { assetSafeUrl: data.url } : {})}
      selected={selected ?? false}
      onChange={handleChange}
    />
  )
}

function VideoNodeWrapper({
  id,
  data,
  selected,
}: {
  id: string
  data: VideoNodeData
  selected?: boolean
}): JSX.Element {
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const handleChange = useCallback(
    (nodeId: string, patch: Partial<VideoNodeData>) =>
      updateNodeData(nodeId, patch),
    [updateNodeData],
  )
  return (
    <VideoNode
      id={id}
      data={data}
      {...(data.url ? { assetSafeUrl: data.url } : {})}
      selected={selected ?? false}
      onChange={handleChange}
    />
  )
}

function createMigratedNodeWrapper(type: NodeType) {
  return function MigratedNodeWrapper({
    id,
    data,
    selected,
  }: {
    id: string
    data: CanvasNodeData
    selected?: boolean
  }): JSX.Element {
    const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
    const handleChange = useCallback(
      (nodeId: string, patch: Partial<CanvasNodeData>) =>
        updateNodeData(nodeId, patch),
      [updateNodeData],
    )

    return (
      <MigratedNode
        id={id}
        type={type}
        data={data}
        selected={selected ?? false}
        onChange={handleChange}
      />
    )
  }
}

/* 閳光偓閳光偓閳光偓 Node types閿涘牊膩閸ф楠囩敮鎼佸櫤閿涘矂浼╅崗宥囩矋娴犺泛鍞村В蹇旑偧濞撳弶鐓嬮崚娑樼紦閺傛澘绱╅悽顭掔礆 閳光偓閳光偓閳光偓 */

const nodeTypes: NodeTypes = {
  text: TextNodeWrapper,
  image: ImageNodeWrapper,
  video: VideoNodeWrapper,
  imageConfigV2: ImageConfigV2Node,
  videoConfigV2: VideoConfigV2Node,
  character: createMigratedNodeWrapper('character'),
  scene: createMigratedNodeWrapper('scene'),
  audio: createMigratedNodeWrapper('audio'),
  videoCompose: createMigratedNodeWrapper('videoCompose'),
  superResolution: createMigratedNodeWrapper('superResolution'),
  muxAudioVideo: createMigratedNodeWrapper('muxAudioVideo'),
  mjImage: createMigratedNodeWrapper('mjImage'),
}

/* 閳光偓閳光偓閳光偓 Store 閳?ReactFlow 閺勭姴鐨?閳光偓閳光偓閳光偓 */

function mapStoreNodes(storeNodes: CanvasStoreNode[]): Node[] {
  return storeNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
  }))
}

function mapStoreEdges(storeEdges: CanvasStoreEdge[]): Edge[] {
  return storeEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
    data: e.data as unknown as Record<string, unknown>,
  }))
}

/** 閺傛媽濡悙褰掔帛鐠併倓缍呯純顔间焊缁?*/
const NODE_OFFSETS: Record<NodeType, { x: number; y: number }> = {
  text: { x: 160, y: 120 },
  image: { x: 540, y: 120 },
  video: { x: 920, y: 120 },
  character: { x: 160, y: 360 },
  scene: { x: 160, y: 600 },
  audio: { x: 540, y: 760 },
  imageConfigV2: { x: 540, y: 500 },
  videoConfigV2: { x: 920, y: 500 },
  videoCompose: { x: 1240, y: 300 },
  superResolution: { x: 1240, y: 560 },
  muxAudioVideo: { x: 1240, y: 820 },
  mjImage: { x: 540, y: 300 },
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/* 閳光偓閳光偓閳光偓 Context menu node options 閳光偓閳光偓閳光偓 */

const CONTEXT_MENU_NODE_OPTIONS: {
  type: NodeType
  label: string
  icon: TablerIcon
}[] = [
  { type: 'text', label: 'Text', icon: IconFileText },
  { type: 'character', label: 'Character', icon: IconFileText },
  { type: 'scene', label: 'Scene', icon: IconPhoto },
  { type: 'image', label: 'Image', icon: IconPhoto },
  { type: 'mjImage', label: 'MJ Image', icon: IconPhotoPlus },
  { type: 'imageConfigV2', label: 'Image V2', icon: IconPhotoPlus },
  { type: 'audio', label: 'Audio', icon: IconMovie },
  { type: 'video', label: 'Video', icon: IconVideo },
  { type: 'videoConfigV2', label: 'Video V2', icon: IconMovie },
  { type: 'videoCompose', label: 'Video Compose', icon: IconMovie },
  { type: 'superResolution', label: 'Super Resolution', icon: IconMovie },
  { type: 'muxAudioVideo', label: 'Mux Audio Video', icon: IconMovie },
]

/* 閳光偓閳光偓閳光偓 Quick tools閿涘牆涔忔笟褏娲块幒銉﹀潑閸旂姵瀵滈柦顕嗙礆 閳光偓閳光偓閳光偓 */

const QUICK_TOOLS: { type: NodeType; label: string; icon: TablerIcon }[] = [
  { type: 'text', label: 'Text', icon: IconTypography },
  { type: 'image', label: 'Image', icon: IconPhoto },
  { type: 'imageConfigV2', label: 'Image V2', icon: IconPhotoPlus },
  { type: 'video', label: 'Video', icon: IconVideo },
  { type: 'videoConfigV2', label: 'Video V2', icon: IconMovie },
]

/* 閳光偓閳光偓閳光偓 Extra node types閿涘牆鐫嶅鈧懣婊冨礋娑擃厼鍨庣猾璇插灙鐞涱煉绱?閳光偓閳光偓閳光偓 */

const EXTRA_NODE_TYPES: {
  type: NodeType
  label: string
  icon: TablerIcon
  category: string
}[] = [
  { type: 'text', label: 'Text Node', icon: IconTypography, category: 'Base' },
  { type: 'character', label: 'Character Node', icon: IconFileText, category: 'Context' },
  { type: 'scene', label: 'Scene Node', icon: IconPhoto, category: 'Context' },
  { type: 'image', label: 'Image Node', icon: IconPhoto, category: 'Base' },
  { type: 'audio', label: 'Audio Node', icon: IconMovie, category: 'Base' },
  { type: 'video', label: 'Video Node', icon: IconVideo, category: 'Base' },
  { type: 'mjImage', label: 'MJ Image', icon: IconPhotoPlus, category: 'AI Generation' },
  { type: 'imageConfigV2', label: 'Image V2', icon: IconPhotoPlus, category: 'AI Generation' },
  { type: 'videoConfigV2', label: 'Video V2', icon: IconMovie, category: 'AI Generation' },
  { type: 'videoCompose', label: 'Video Compose', icon: IconMovie, category: 'Post Tools' },
  { type: 'superResolution', label: 'Super Resolution', icon: IconMovie, category: 'Post Tools' },
  { type: 'muxAudioVideo', label: 'Mux Audio Video', icon: IconMovie, category: 'Post Tools' },
]

/* 閳光偓閳光偓閳光偓 Default workflow ID 閳光偓閳光偓閳光偓 */

const DEFAULT_WORKFLOW_ID = 'default'
const DEFAULT_WORKFLOW_NAME = 'Untitled workflow'

/* 閳光偓閳光偓閳光偓 Save status type 閳光偓閳光偓閳光偓 */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/* 閳光偓閳光偓閳光偓 CanvasPageInner閿涘牆绻€妞よ婀?ReactFlowProvider 閸愬拑绱?閳光偓閳光偓閳光偓 */

function CanvasPageInner(): JSX.Element {
  /* 閳光偓閳光偓 ReactFlow hooks 閳光偓閳光偓 */
  const { screenToFlowPosition, fitView } = useReactFlow()

  /* 閳光偓閳光偓 Toolbar state 閳光偓閳光偓 */
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [showAssetPanel, setShowAssetPanel] = useState(false)
  const [showJobPanel, setShowJobPanel] = useState(false)
  const [showChatBox, setShowChatBox] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select')
  const themePreference = useThemeStore((s) => s.preference)
  const setThemePreference = useThemeStore((s) => s.setPreference)

  /* 閳光偓閳光偓 Context menu state 閳光偓閳光偓 */
  const [contextMenu, setContextMenu] = useState<{
    type: 'pane' | 'node'
    x: number
    y: number
    nodeId?: string
  } | null>(null)

  /* 閳光偓閳光偓 Save/Load state 閳光偓閳光偓 */
  const [innerSearchParams] = useSearchParams()
  const [currentWorkflowId, setCurrentWorkflowId] = useState(innerSearchParams.get('id') || DEFAULT_WORKFLOW_ID)
  const [workflowName, setWorkflowName] = useState(DEFAULT_WORKFLOW_NAME)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dropFeedback, setDropFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [snippetFeedback, setSnippetFeedback] = useState<string | null>(null)
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionValidationFeedback | null>(null)
  const [snippets, setSnippets] = useState<CanvasSnippetView[]>([])
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>('')
  const [showProjectManager, setShowProjectManager] = useState(false)
  const isDirtyRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* 閳光偓閳光偓 Store selectors閿涘牅绮庨悽銊ょ艾閹俱倝鏀?闁插秴浠?UI 閸滃本瀵旀稊鍛閸ョ偠鐨熼敍?閳光偓閳光偓 */
  const pastLen = useStore(canvasStore, (s) => s.past.length)
  const futureLen = useStore(canvasStore, (s) => s.future.length)

  /* 閳光偓閳光偓 ReactFlow 娴ｆ粈璐熺€圭偞妞傞悩鑸碘偓浣告暜娑撯偓閺夈儲绨?閳光偓閳光偓 */
  const initialNodes = useMemo<Node[]>(
    () => mapStoreNodes(canvasStore.getState().nodes),
    [],
  )
  const initialEdges = useMemo<Edge[]>(
    () => mapStoreEdges(canvasStore.getState().edges),
    [],
  )
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const selectedNodeIds = useMemo(
    () => rfNodes.filter((node) => node.selected).map((node) => node.id),
    [rfNodes],
  )
  const selectedSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === selectedSnippetId) ?? snippets[0] ?? null,
    [selectedSnippetId, snippets],
  )

  const syncReactFlowFromStore = useCallback(() => {
    const state = canvasStore.getState()
    setRfNodes(state.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
    })))
    setRfEdges(state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'default' as const,
      data: e.data as unknown as Record<string, unknown>,
    })))
  }, [setRfNodes, setRfEdges])

  const loadSnippets = useCallback(async () => {
    try {
      const nextSnippets = await window.comicCanvas.listCanvasSnippets()
      setSnippets(nextSnippets)
      setSelectedSnippetId((current) => (
        current && nextSnippets.some((snippet) => snippet.id === current)
          ? current
          : nextSnippets[0]?.id ?? ''
      ))
    } catch {
      setSnippetFeedback('Failed to load snippets')
    }
  }, [])

  const restoreWorkflowGraph = useCallback(async (snapshot: CanvasGraphSnapshot) => {
    let restoredNodes = snapshot.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }))

    if (restoredNodes.length > 0) {
      try {
        const jobs = await window.comicCanvas.listJobs({ limit: 100 })
        restoredNodes = reconcileCanvasNodesWithJobs(restoredNodes, jobs)
      } catch {
        // Job reconciliation is best-effort; graph loading must remain available offline.
      }
    }

    canvasStore.getState().setNodes(restoredNodes)
    canvasStore.getState().setEdges(
      snapshot.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data,
      })),
    )
    setRfNodes(restoredNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
    })))
    setRfEdges(snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'default' as const,
      data: e.data as unknown as Record<string, unknown>,
    })))
    if (snapshot.viewport) {
      canvasStore.getState().setViewport(snapshot.viewport)
    }
  }, [setRfNodes, setRfEdges])

  const planExecutionController = useMemo(
    () =>
      createCanvasPlanExecutionController({
        store: canvasStore,
        runNode: (nodeId) => window.comicCanvas.runCanvasNode({ workflowId: currentWorkflowId, nodeId }),
      }),
    [currentWorkflowId],
  )

  /* 閳光偓閳光偓 Debounced 閹镐椒绠欓崠鏍у煂 store 閳光偓閳光偓 */
  const skipNextPersistRef = useRef(false)

  const persistToStore = useCallback(
    debounce((nodes: Node[], edges: Edge[]) => {
      if (skipNextPersistRef.current) {
        skipNextPersistRef.current = false
        return
      }
      canvasStore.getState().setNodes(
        nodes.map((n) => ({
          id: n.id,
          type: n.type as NodeType,
          position: n.position,
          data: n.data as unknown as CanvasNodeData,
        })),
      )
      canvasStore.getState().setEdges(
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          // 娣囨繄鏆€瀹稿弶婀佹潏瑙勬殶閹诡噯绱欓崥?edgeType閿涘绱濋柆鍨帳鐟曞棛娲婃稉?default
          data: (e.data as unknown as CanvasEdgeData) ?? { edgeType: 'default' as const, createdAt: Date.now() },
        })),
      )
    }, 300),
    [],
  )

  useEffect(() => {
    persistToStore(rfNodes, rfEdges)
    // Mark dirty for auto-save
    isDirtyRef.current = true
  }, [rfNodes, rfEdges, persistToStore])

  useEffect(() => {
    void loadSnippets()
  }, [loadSnippets])

  useEffect(() => {
    const unsubscribeCompleted = window.comicCanvas.onJobCompleted((event) => {
      planExecutionController.notifyJobCompleted(event)
      syncReactFlowFromStore()
    })
    const unsubscribeFailed = window.comicCanvas.onJobFailed((event) => {
      planExecutionController.notifyJobFailed(event)
      syncReactFlowFromStore()
    })

    return () => {
      unsubscribeCompleted()
      unsubscribeFailed()
    }
  }, [planExecutionController, syncReactFlowFromStore])

  /* 閳光偓閳光偓 Save graph handler 閳光偓閳光偓 */
  const handleSave = useCallback(async () => {
    try {
      setSaveStatus('saving')
      const state = canvasStore.getState()
      const snapshot: CanvasGraphSnapshot = {
        nodes: state.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: state.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          data: e.data,
        })),
        viewport: state.viewport,
      }
      await window.comicCanvas.saveGraph({
        projectId: currentWorkflowId,
        graph: snapshot,
      })
      isDirtyRef.current = false
      setSaveStatus('saved')
      // Reset status after 2s
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
      throw error
    }
  }, [currentWorkflowId])

  /* 閳光偓閳光偓 Ctrl+S / Cmd+S keyboard shortcut 閳光偓閳光偓 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave().catch(() => undefined)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  useEffect(() => installDirtyBeforeUnloadGuard({
    target: window,
    isDirty: () => isDirtyRef.current,
  }), [])

  /* 閳光偓閳光偓 Debounced auto-save (2s after changes) 閳光偓閳光偓 */
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        void handleSave().catch(() => undefined)
      }
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [rfNodes, rfEdges, handleSave])

  /* 閳光偓閳光偓 Load graph helper (reusable for initial load and workflow switch) 閳光偓閳光偓 */
  const loadGraphForWorkflow = useCallback(async (workflowId: string) => {
    try {
      const snapshot = await window.comicCanvas.loadGraph({
        projectId: workflowId,
      })
      if (!snapshot) return
      // Only restore if there are actual nodes/edges
      if (snapshot.nodes.length > 0 || snapshot.edges.length > 0) {
        await restoreWorkflowGraph(snapshot)
      } else {
        // Empty workflow - clear canvas
        canvasStore.getState().setNodes([])
        canvasStore.getState().setEdges([])
        setRfNodes([])
        setRfEdges([])
      }
      isDirtyRef.current = false
    } catch {
      // Silently fall back to empty canvas
    }
  }, [setRfNodes, setRfEdges])

  /* 閳光偓閳光偓 Load graph on mount 閳光偓閳光偓 */
  useEffect(() => {
    let cancelled = false
    async function loadGraph() {
      try {
        const snapshot = await window.comicCanvas.loadGraph({
          projectId: currentWorkflowId,
        })
        if (cancelled || !snapshot) return
        // Only restore if there are actual nodes/edges
        if (snapshot.nodes.length > 0 || snapshot.edges.length > 0) {
          await restoreWorkflowGraph(snapshot)
        }
        setWorkflowName(DEFAULT_WORKFLOW_NAME)
        isDirtyRef.current = false
      } catch {
        // Silently fall back to empty canvas
      }
    }
    void loadGraph()
    return () => { cancelled = true }
  }, [currentWorkflowId, restoreWorkflowGraph])

  /* 閳光偓閳光偓 Switch workflow handler 閳光偓閳光偓 */
  const handleSwitchWorkflow = useCallback(async (workflowId: string, name: string) => {
    await guardWorkflowSwitch({
      isDirty: isDirtyRef.current,
      saveCurrent: handleSave,
      onSaveFailed: () => setSaveStatus('error'),
      switchWorkflow: async () => {
        setCurrentWorkflowId(workflowId)
        setWorkflowName(name)
        skipNextPersistRef.current = true
        await loadGraphForWorkflow(workflowId)
        setShowProjectManager(false)
      },
    })
  }, [handleSave, loadGraphForWorkflow])

  /* 閳光偓閳光偓 Cleanup timers 閳光偓閳光偓 */
  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  /* 閳光偓閳光偓 Undo/Redo閿涙矮绮?store 闁插秵鏌婇崥灞绢劄閸?ReactFlow 閳光偓閳光偓 */
  const prevPastLen = useRef(pastLen)
  const prevFutureLen = useRef(futureLen)

  useEffect(() => {
    if (
      pastLen !== prevPastLen.current ||
      futureLen !== prevFutureLen.current
    ) {
      prevPastLen.current = pastLen
      prevFutureLen.current = futureLen
      skipNextPersistRef.current = true
      const state = canvasStore.getState()
      setRfNodes(mapStoreNodes(state.nodes))
      setRfEdges(mapStoreEdges(state.edges))
    }
  }, [pastLen, futureLen, setRfNodes, setRfEdges])

  /* 閳光偓閳光偓 鐎圭偞妞傛禍瀣╂ 閳光偓閳光偓 */
  useCanvasRealtime()
  const handleConnect = useCallback<OnConnect>((connection) => {
    const result = createCanvasEdge({
      store: canvasStore,
      notify: setConnectionFeedback,
      request: {
        source: connection.source,
        target: connection.target,
        reason: 'direct',
      },
    })

    if (result.ok) {
      const edgeId = (result as { edgeId: string }).edgeId
      const storeEdge = canvasStore.getState().edges.find((edge) => edge.id === edgeId)
      setRfEdges((eds) => [
        ...eds,
        {
          id: edgeId,
          source: connection.source,
          target: connection.target,
          type: 'default',
          data: storeEdge?.data as unknown as Record<string, unknown>,
        },
      ])
      setConnectionFeedback(null)
    }
  }, [setRfEdges])

  /* 閳光偓閳光偓 閹锋牗瀚跨紒鎾存将閿涙碍褰佹禍銈勭秴缂冾喖鍩?store + 閸樺棗褰?閳光偓閳光偓 */
  const handleNodeDragStop = useCallback<OnNodeDrag>((_event, node) => {
    canvasStore.setState((prev) => {
      const snapshot = {
        nodes: prev.nodes,
        edges: prev.edges,
        viewport: prev.viewport,
      }
      return {
        past: [...prev.past, structuredClone(snapshot)].slice(-50),
        future: [],
        nodes: prev.nodes.map((n) =>
          n.id === node.id
            ? { ...n, position: { x: node.position.x, y: node.position.y } }
            : n,
        ),
      }
    })
  }, [])

  /* 閳光偓閳光偓 閹垮秳缍旈崶鐐剁殶 閳光偓閳光偓 */
  const handleUndo = useCallback(() => {
    canvasStore.getState().undo()
  }, [])

  const handleRedo = useCallback(() => {
    canvasStore.getState().redo()
  }, [])

  const handleAddNode = useCallback(
    (type: NodeType, flowPosition?: { x: number; y: number }) => {
      const currentNodes = canvasStore.getState().nodes
      const count = currentNodes.filter((n) => n.type === type).length
      const position = flowPosition
        ? { x: flowPosition.x - 140, y: flowPosition.y - 40 }
        : (() => {
            const offset = NODE_OFFSETS[type] ?? { x: 160, y: 120 }
            return { x: offset.x + count * 40, y: offset.y + count * 60 }
          })()
      const id = `node-${crypto.randomUUID()}`
      const newNode: Node = {
        id,
        type,
        position,
        data: defaultNodeData(type, count + 1) as unknown as Record<
          string,
          unknown
        >,
      }
      setRfNodes((nds) => [...nds, newNode])

      // 閸氬本顒為崢瀣弳 store 閸樺棗褰堕弽鍫礄閻劋绨幘銈夋敘閿?
      canvasStore.setState((prev) => {
        const snapshot = {
          nodes: prev.nodes,
          edges: prev.edges,
          viewport: prev.viewport,
        }
        return {
          past: [...prev.past, structuredClone(snapshot)].slice(-50),
          future: [],
          nodes: [
            ...prev.nodes,
            {
              id,
              type,
              position,
              data: defaultNodeData(type, count + 1),
            },
          ],
        }
      })
      return id
    },
    [setRfNodes],
  )

  /* 閳光偓閳光偓 Context menu handlers 閳光偓閳光偓 */
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      setContextMenu({
        type: 'pane',
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      })
    },
    [],
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        type: 'node',
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      })
    },
    [],
  )

  const handleAddNodeAtContextMenu = useCallback(
    (type: NodeType) => {
      if (!contextMenu) return
      const pos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
      handleAddNode(type, pos)
      setContextMenu(null)
    },
    [contextMenu, screenToFlowPosition, handleAddNode],
  )

  const handleCreateConnectedNodeAtContextMenu = useCallback(
    (type: NodeType) => {
      if (!contextMenu?.nodeId) return
      const pos = screenToFlowPosition({ x: contextMenu.x + 260, y: contextMenu.y })
      const createdNodeId = handleAddNode(type, pos)
      const result = connectCreatedCanvasNode({
        store: canvasStore,
        sourceNodeId: contextMenu.nodeId,
        createdNodeId,
        notify: setConnectionFeedback,
      })
      if (result.ok) {
        syncReactFlowFromStore()
        setConnectionFeedback(null)
      }
      setContextMenu(null)
    },
    [contextMenu, handleAddNode, screenToFlowPosition, syncReactFlowFromStore],
  )

  const syncStoreSnapshotToReactFlow = useCallback(() => {
    const state = canvasStore.getState()
    setRfNodes(mapStoreNodes(state.nodes))
    setRfEdges(mapStoreEdges(state.edges))
  }, [setRfNodes, setRfEdges])

  const handleDuplicateSelection = useCallback(
    (nodeIds: string[]) => {
      const result = duplicateSelectedCanvasNodes({
        store: canvasStore,
        selectedNodeIds: nodeIds,
      })
      if (result.duplicatedNodeIds.length === 0) return
      skipNextPersistRef.current = true
      syncStoreSnapshotToReactFlow()
      setContextMenu(null)
    },
    [syncStoreSnapshotToReactFlow],
  )

  const handleDeleteSelection = useCallback(
    (nodeIds: string[]) => {
      const result = deleteSelectedCanvasNodes({
        store: canvasStore,
        selectedNodeIds: nodeIds,
      })
      if (result.deletedNodeIds.length === 0) return
      skipNextPersistRef.current = true
      syncStoreSnapshotToReactFlow()
      setContextMenu(null)
    },
    [syncStoreSnapshotToReactFlow],
  )

  const canvasCommands = useMemo<CanvasCommand[]>(() => [
    {
      id: 'fit-view',
      label: 'Fit view',
      keywords: ['fit', 'zoom', 'view'],
      run: () => fitView({ padding: 0.18, duration: 240 }),
    },
    {
      id: 'select-mode',
      label: 'Select mode',
      keywords: ['select', 'pointer'],
      run: () => setInteractionMode('select'),
    },
    {
      id: 'pan-mode',
      label: 'Pan mode',
      keywords: ['pan', 'hand'],
      run: () => setInteractionMode('pan'),
    },
    {
      id: 'duplicate-selection',
      label: 'Duplicate selected nodes',
      keywords: ['duplicate', 'copy'],
      disabled: selectedNodeIds.length === 0,
      run: () => handleDuplicateSelection(selectedNodeIds),
    },
    {
      id: 'delete-selection',
      label: 'Delete selected nodes',
      keywords: ['delete', 'remove'],
      disabled: selectedNodeIds.length === 0,
      run: () => handleDeleteSelection(selectedNodeIds),
    },
  ], [fitView, handleDeleteSelection, handleDuplicateSelection, selectedNodeIds])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableKeyboardTarget(e.target)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleDuplicateSelection(selectedNodeIds)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length === 0) return
        e.preventDefault()
        handleDeleteSelection(selectedNodeIds)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDeleteSelection, handleDuplicateSelection, selectedNodeIds])

  const handleRunAll = useCallback(() => {
    // 妫板嫮鏆€閿涙碍婀弶銉ㄐ曢崣鎴濆弿閼哄倻鍋ｆ潻鎰攽
  }, [])

  const handleSaveSnippet = useCallback(async () => {
    try {
      const snippet = extractCanvasSnippet({
        name: `Snippet ${new Date().toLocaleString('zh-CN')}`,
        graph: canvasStore.getState(),
        selectedNodeIds,
        createdAt: Date.now(),
      })
      const saved = await window.comicCanvas.saveCanvasSnippet({
        name: snippet.name,
        nodes: snippet.nodes,
        edges: snippet.edges,
      })

      if ('errorClass' in saved) {
        setSnippetFeedback(saved.message)
        return
      }

      await loadSnippets()
      setSelectedSnippetId(saved.id)
      setSnippetFeedback(`Saved snippet with ${saved.nodes.length} nodes`)
    } catch {
      setSnippetFeedback('Select at least two nodes before saving a snippet')
    }
  }, [loadSnippets, selectedNodeIds])

  const handleInsertSnippet = useCallback(() => {
    if (!selectedSnippet) {
      setSnippetFeedback('No snippet selected')
      return
    }

    const snippet: CanvasSnippet = {
      schemaVersion: 1,
      name: selectedSnippet.name,
      createdAt: selectedSnippet.createdAt,
      nodes: selectedSnippet.nodes,
      edges: selectedSnippet.edges,
    }

    insertCanvasSnippet(snippet, canvasStore, {
      origin: {
        x: Math.max(120, ...canvasStore.getState().nodes.map((node) => node.position.x + 360)),
        y: Math.max(120, ...canvasStore.getState().nodes.map((node) => node.position.y)),
      },
    })
    syncReactFlowFromStore()
    setSnippetFeedback(`Inserted snippet with ${selectedSnippet.nodes.length} nodes`)
  }, [selectedSnippet, syncReactFlowFromStore])

  /* 閳光偓閳光偓 鐠у嫪楠囬幓鎺戝弳閸ョ偠鐨熼敍姘殺鐠у嫪楠囨担婊€璐熼弬鎷屽Ν閻愯鍧婇崝鐘插煂閻㈣绔?閳光偓閳光偓 */
  const showDropFeedback = useCallback((kind: 'success' | 'error', message: string) => {
    const normalizedMessage =
      kind === 'success' && !message.startsWith('\u5df2\u5bfc\u5165')
        ? `Imported ${message.replace(/^.*?\?/u, '')}`
        : kind === 'error' && message.includes('{plan.label}')
          ? '\u5bfc\u5165\u5931\u8d25'
          : message
    setDropFeedback({ kind, message: normalizedMessage })
    window.setTimeout(() => setDropFeedback(null), 2800)
  }, [])

  const appendAssetNode = useCallback(
    (asset: { id: string; safeUrl: string; mediaType: 'image' | 'video' | 'audio'; name: string }, flowPosition?: { x: number; y: number }) => {
      const nodeType: Extract<NodeType, 'image' | 'video' | 'audio'> = asset.mediaType
      const currentNodes = canvasStore.getState().nodes
      const count = currentNodes.filter((n) => n.type === nodeType).length
      const position = flowPosition
        ? { x: flowPosition.x - 140, y: flowPosition.y - 40 }
        : (() => {
            const offset = NODE_OFFSETS[nodeType]
            return { x: offset.x + count * 40, y: offset.y + count * 60 }
          })()
      const id = `node-${crypto.randomUUID()}`
      const data = {
        ...defaultNodeData(nodeType, count + 1),
        assetId: asset.id,
        label: asset.name,
        status: 'done' as const,
        url: asset.safeUrl,
      }
      const newNode: Node = {
        id,
        type: nodeType,
        position,
        data,
      }
      setRfNodes((nds) => [...nds, newNode])
      canvasStore.setState((prev) => {
        const snapshot = { nodes: prev.nodes, edges: prev.edges, viewport: prev.viewport }
        return {
          past: [...prev.past, structuredClone(snapshot)].slice(-50),
          future: [],
          nodes: [...prev.nodes, { id, type: nodeType, position, data }],
        }
      })
    },
    [setRfNodes],
  )

  const handleInsertAsset = useCallback(
    (asset: { id: string; url: string; type: 'image' | 'video' | 'audio'; name: string }) => {
      appendAssetNode({ id: asset.id, safeUrl: asset.url, mediaType: asset.type, name: asset.name })
    },
    [appendAssetNode],
  )

  const handleCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleCanvasDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      const files = Array.from(event.dataTransfer.files)
      const firstFile = files[0]
      if (!firstFile) return
      event.preventDefault()

      const plan = planLocalMediaDrop(firstFile)
      if (!plan.ok) {
        showDropFeedback('error', plan.reason)
        return
      }

      try {
        const imported: AssetRecord = await window.comicCanvas.importAsset({
          sourcePath: plan.sourcePath,
          mediaType: plan.mediaType,
        })
        appendAssetNode({
          id: imported.id,
          safeUrl: imported.safeUrl,
          mediaType: plan.mediaType,
          name: plan.label,
        }, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
        showDropFeedback('success', `Inserted ${plan.label}`)
      } catch {
        showDropFeedback('error', `Failed to insert ${plan.label}`)
      }
    },
    [appendAssetNode, screenToFlowPosition, showDropFeedback],
  )

  /* 閳光偓閳光偓 AI 鐎电鐦?Plan 鎼存梻鏁ら崶鐐剁殶 閳光偓閳光偓 */
  const handleApplyPlan = useCallback(
    (p: CanvasPlan, { autoExecute }: ApplyPlanOptions) => {
      planExecutionController.applyPlan(p, { autoExecute })
      syncReactFlowFromStore()
    },
    [planExecutionController, syncReactFlowFromStore],
  )

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base">
      {/* 閳光偓閳光偓 妞よ埖鐖?閳光偓閳光偓 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary bg-bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="Back to projects"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowProjectManager(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[15px] font-semibold text-text-base transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
          >
            {workflowName}
            <IconChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
          <ProjectStyleSelector workflowId={currentWorkflowId} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={pastLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Undo"
          >
            <IconArrowBackUp className="h-3.5 w-3.5" />
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={futureLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Redo"
          >
            <IconArrowForwardUp className="h-3.5 w-3.5" />
            Redo
          </button>
          <button
            type="button"
            onClick={() => void handleSave().catch(() => undefined)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
            aria-label="Save"
          >
            {saveStatus === 'saving' ? (
              <>
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Saved</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <IconDeviceFloppy className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-400">Save failed</span>
              </>
            ) : (
              <>
                <IconDeviceFloppy className="h-3.5 w-3.5" />
                Save
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleSaveSnippet()}
            disabled={selectedNodeIds.length < 2}
            className="inline-flex h-8 items-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="保存片段"
            title={selectedNodeIds.length < 2 ? '请选择至少两个节点' : '保存选中节点为片段'}
          >
            保存片段
          </button>
          <select
            value={selectedSnippet?.id ?? ''}
            onChange={(event) => setSelectedSnippetId(event.target.value)}
            className="h-8 max-w-[180px] rounded-lg border border-border-secondary bg-bg-card px-2 text-[13px] font-medium text-text-secondary outline-none transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
            aria-label="片段库"
          >
            {snippets.length === 0 ? (
              <option value="">暂无片段</option>
            ) : snippets.map((snippet) => (
              <option key={snippet.id} value={snippet.id}>
                {snippet.name} ({snippet.nodeCount})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleInsertSnippet}
            disabled={!selectedSnippet}
            className="inline-flex h-8 items-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="插入片段"
          >
            插入片段
          </button>
          <button
            type="button"
            onClick={handleRunAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition-all duration-200 ease-luxury hover:bg-brand-hover active:scale-95"
            aria-label="Run all"
          >
            <IconPlayerPlay className="h-3.5 w-3.5" />
            Run all
          </button>
          <button
            type="button"
            onClick={() => setShowJobPanel((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary px-3 text-[13px] font-medium transition-all duration-200 ease-luxury active:scale-95 ${showJobPanel ? 'bg-brand/10 text-brand' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-base'}`}
            aria-label="Jobs"
          >
            <IconListDetails className="h-3.5 w-3.5" />
            Jobs
          </button>
        </div>
      </header>

      {/* 閳光偓閳光偓 閻㈣绔烽崠鍝勭厵 閳光偓閳光偓 */}
      <div className="relative flex-1" onDragOver={handleCanvasDragOver} onDrop={(event) => void handleCanvasDrop(event)}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeDragStop={handleNodeDragStop}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          snapToGrid
          snapGrid={[20, 20]}
          defaultViewport={{ x: 120, y: 80, zoom: 0.75 }}
          minZoom={0.15}
          maxZoom={2}
          selectionOnDrag={interactionMode === 'select'}
          panOnDrag={interactionMode === 'pan'}
          selectionMode={SelectionMode.Partial}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          className="cc-flow"
          fitView={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="var(--color-border-secondary)"
          />
          <MiniMap position="bottom-right" pannable zoomable />
          <Controls position="bottom-left" />
        </ReactFlow>

        {dropFeedback && (
          <div
            role="status"
            className={`pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border px-3 py-2 text-[13px] shadow-card ${
              dropFeedback.kind === 'success'
                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {dropFeedback.message}
          </div>
        )}

        <ConnectionFeedback
          feedback={connectionFeedback}
          className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2"
        />

        {snippetFeedback && (
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-border-secondary bg-bg-panel px-3 py-2 text-[13px] text-text-base shadow-card"
          >
            {snippetFeedback}
          </div>
        )}

        {/* 閳光偓閳光偓 閸欐娊鏁懣婊冨礋 閳光偓閳光偓 */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu(null)
              }}
            />
            <div
              className="cc-anim-fade-in fixed z-50 w-[180px] rounded-xl border border-border-secondary bg-bg-panel p-1.5 shadow-[0_15px_45px_rgba(0,0,0,0.12)]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.type === 'pane' ? (
                <>
                  <p className="px-3 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">
                    Add node
                  </p>
                  {CONTEXT_MENU_NODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => handleAddNodeAtContextMenu(opt.type)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                    >
                      <opt.icon className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                      <span className="text-[13px] font-medium text-text-base">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">
                    Node actions
                  </p>
                  <button
                    onClick={() => handleDuplicateSelection([contextMenu.nodeId!])}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                  >
                    <IconCopy className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                    <span className="text-[13px] font-medium text-text-base">
                      Duplicate node
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteSelection([contextMenu.nodeId!])}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                  >
                    <IconTrash className="h-4 w-4 text-text-secondary group-hover:text-red-400" />
                    <span className="text-[13px] font-medium text-text-base">
                      Delete node
                    </span>
                  </button>
                  <span className="my-1 block h-px bg-border-secondary" />
                  {CONTEXT_MENU_NODE_OPTIONS.map((opt) => (
                    <button
                      key={`connect-${opt.type}`}
                      onClick={() => handleCreateConnectedNodeAtContextMenu(opt.type)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                    >
                      <opt.icon className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                      <span className="text-[13px] font-medium text-text-base">
                        Link {opt.label}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* 閳光偓閳光偓 瀹革缚鏅跺ù顔煎З瀹搞儱鍙块弽?閳光偓閳光偓 */}
        <aside className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border-primary bg-bg-panel p-1 shadow-card">
          {/* Plus 鐏炴洖绱戦幐澶愭尦 */}
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury active:scale-90 ${isAddMenuOpen ? 'bg-brand text-bg-base' : 'text-text-secondary hover:border-brand/30 hover:bg-bg-hover hover:text-text-base'}`}
            title={isAddMenuOpen ? 'Collapse' : 'Add node'}
          >
            {isAddMenuOpen ? <IconX className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
          </button>

          {/* 閸掑棝娈х痪?*/}
          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />

          <button
            type="button"
            onClick={() => setInteractionMode('select')}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${interactionMode === 'select' ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="Select mode"
            aria-label="Select mode"
          >
            <IconPointer className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setInteractionMode('pan')}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${interactionMode === 'pan' ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="Pan mode"
            aria-label="Pan mode"
          >
            <IconHandGrab className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showCommandPalette ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="Command palette"
            aria-label="Command palette"
          >
            <IconSearch className="h-4 w-4" />
          </button>

          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />
          {/* Quick tools 閻╁瓨甯村ǎ璇插 */}
          {QUICK_TOOLS.map((tool) => (
            <button
              key={tool.type}
              type="button"
              onClick={() => { handleAddNode(tool.type); setIsAddMenuOpen(false) }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-text-secondary transition-all duration-200 ease-luxury hover:border-brand/30 hover:bg-bg-hover hover:text-text-base active:scale-90"
              title={`Add ${tool.label}`}
            >
              <tool.icon className="h-4 w-4" />
            </button>
          ))}

          {/* 閸掑棝娈х痪?*/}
          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />

          {/* 娣囨繂鐡?*/}
          <button
            type="button"
            onClick={() => void handleSave().catch(() => undefined)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${saveStatus === 'saving' ? 'text-brand' : saveStatus === 'saved' ? 'text-green-400' : 'text-text-secondary hover:text-text-base'}`}
            title={saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save (Ctrl+S)'}
          >
            {saveStatus === 'saving' ? <IconLoader2 className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <IconCheck className="h-4 w-4" /> : <IconDeviceFloppy className="h-4 w-4" />}
          </button>

          {/* 鐠у嫪楠囨惔?*/}
          <button
            type="button"
            onClick={() => setShowAssetPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showAssetPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-base'}`}
            title="Asset library"
          >
            <IconFolder className="h-4 w-4" />
          </button>

          {/* 鐎电鐦?*/}
          <button
            type="button"
            onClick={() => setShowChatBox((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showChatBox ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="Chat"
          >
            <IconMessage className="h-4 w-4" />
          </button>

          {/* 鏉╂劘顢戞禒璇插 */}
          <button
            type="button"
            onClick={() => setShowJobPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showJobPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="Jobs"
            aria-label="Jobs"
          >
            <IconListDetails className="h-4 w-4" />
          </button>

          {/* 娑撳顣介崚鍥ㄥ床 */}
          <button
            type="button"
            onClick={() => setThemePreference(themePreference === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            title={themePreference === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {themePreference === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>
        </aside>

        {/* 閳光偓閳光偓 鐏炴洖绱戝蹇氬Ν閻愮褰嶉崡鏇礄婵绮撳〒鍙夌厠閿涘苯鍨忛幑銏犲讲鐟欎焦鈧冪杽閻滄媽绻冨〒鈥冲З閻紮绱?閳光偓閳光偓 */}
        <div
          className={`absolute left-[72px] top-1/2 z-30 w-[220px] -translate-y-1/2 rounded-xl border border-border-primary bg-bg-panel p-3 shadow-pop transition-all duration-300 ease-luxury ${isAddMenuOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-2 opacity-0'}`}
        >
          {Array.from(new Set(EXTRA_NODE_TYPES.map((n) => n.category))).map((cat) => (
            <div key={cat}>
              <p className="px-2 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">{cat}</p>
              <div className="flex flex-col gap-0.5">
                {EXTRA_NODE_TYPES.filter((n) => n.category === cat).map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => { handleAddNode(opt.type); setIsAddMenuOpen(false) }}
                    className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-hover text-text-secondary transition-all duration-200 ease-luxury group-hover:bg-brand/10 group-hover:text-brand group-hover:scale-110">
                      <opt.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] font-medium text-text-base">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 閳光偓閳光偓 妞ゅ湱娲扮粻锛勬倞閸?閳光偓閳光偓 */}
        {showProjectManager && (
          <ProjectManager
            currentWorkflowId={currentWorkflowId}
            onSwitchWorkflow={(workflowId, name) => void handleSwitchWorkflow(workflowId, name)}
            onClose={() => setShowProjectManager(false)}
          />
        )}

        {/* 閳光偓閳光偓 鐠у嫪楠囨惔鎾绘桨閺?閳光偓閳光偓 */}
        {showAssetPanel && (
          <CanvasAssetPanel
            open={showAssetPanel}
            onClose={() => setShowAssetPanel(false)}
            onInsertAsset={handleInsertAsset}
          />
        )}

        {showJobPanel && (
          <CanvasJobPanel onClose={() => setShowJobPanel(false)} />
        )}

        <CanvasCommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          commands={canvasCommands}
        />

        {/* 閳光偓閳光偓 AI 鐎电鐦介棃銏℃緲 閳光偓閳光偓 */}
        <CanvasChatBox
          open={showChatBox}
          onToggle={() => setShowChatBox((v) => !v)}
          onApplyPlan={handleApplyPlan}
        />
      </div>
    </div>
  )
}

/* 閳光偓閳光偓閳光偓 CanvasPage閿涘牆鐢?ReactFlowProvider閿?閳光偓閳光偓閳光偓 */

export default function CanvasPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const workflowId = searchParams.get('id')
  if (!workflowId) {
    return <Navigate to="/projects" replace />
  }
  return (
    <ReactFlowProvider>
      <CanvasPageInner />
    </ReactFlowProvider>
  )
}
