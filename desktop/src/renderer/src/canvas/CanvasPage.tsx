/**
 * Canvas state ownership model:
 * 1. React Flow owns transient interaction state: drag positions, selection,
 *    viewport gestures, and pending connection gestures.
 * 2. Zustand owns the durable graph snapshot used by undo/redo, autosave,
 *    snippets, realtime job reconciliation, and IPC persistence.
 * 3. React Flow -> Zustand sync is debounced after local user edits.
 * 4. Zustand -> React Flow sync must set `skipNextPersistRef` before writing
 *    local React Flow state, otherwise the next effect can echo the same graph
 *    back into the store and create duplicate history/autosave races.
 * @see docs/api-contracts/canvas-plan.md
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag,
  type Viewport,
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
  IconUpload,
  IconDownload,
  IconHelp,
  IconZoomIn,
  IconZoomOut,
  IconMaximize,
  IconUsers,
  IconPalette,
  IconTemplate,
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
import { CharacterNode } from './nodes/CharacterNode'
import { SceneNode } from './nodes/SceneNode'
import { AudioNode } from './nodes/AudioNode'
import { VideoComposeNode } from './nodes/VideoComposeNode'
import { SuperResolutionNode } from './nodes/SuperResolutionNode'
import { MuxAudioVideoNode } from './nodes/MuxAudioVideoNode'
import { MjImageNode } from './nodes/MjImageNode'
import { useCanvasRealtime } from './hooks/use-canvas-realtime'
import { ProjectManager } from './components/ProjectManager'
import CanvasChatBox from './components/CanvasChatBox'
import { CanvasAssetPanel, type CanvasAssetInsertMode } from './components/CanvasAssetPanel'
import { assetDisplayUrl } from '../assets/asset-url'
import { WorkflowPanel } from './components/WorkflowPanel'
import { CharacterLibraryPanel } from './components/CharacterLibraryPanel'
import { StyleLibraryPanel } from './components/StyleLibraryPanel'
import { ProjectStyleSelector } from './components/ProjectStyleSelector'
import { CanvasJobPanel } from './components/CanvasJobPanel'
import { CanvasCommandPalette, type CanvasCommand } from './components/CanvasCommandPalette'
import { ConnectionFeedback } from './components/ConnectionFeedback'
import PromptOrderEdge from './edges/PromptOrderEdge'
import ImageOrderEdge from './edges/ImageOrderEdge'
import ImageRoleEdge from './edges/ImageRoleEdge'
import DeletableBezierEdge from './edges/DeletableBezierEdge'
import { createCanvasPlanExecutionController } from './lib/canvas-plan-execution'
import { buildGenerationTaskStatusList, reconcileCanvasNodesWithJobs, terminalFailureToNodePatch, terminalResultToNodePatch } from './lib/job-reconciliation'
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
import type { AssetCategory, AssetRecord, ImageEditIntent } from '../../../../../shared/assets'
import type { CanvasPlan } from '../../../../../shared/plan'
import type { CanvasGraphSnapshot } from '../../../../../shared/graph'
import type { CanvasSnippetView } from '../../../../../shared/snippets'
import type { JobType } from '../../../../../shared/jobs'
import { defaultCanvasNodeSize } from '../../../../../shared/node-layout'
import { getAddableNodeDefinitions, getConnectCreateNodeDefinitions } from '../../../../../shared/workflow-node-definitions'
import { planLocalMediaDrops } from './lib/local-media-drop'
import { buildAssetNodeInsertion, buildReferenceAssetPatch } from './lib/asset-node-insertion'
import { computeRelatedNodeIds } from './lib/related-highlight'

/* Debounce utility */

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: never[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as unknown as T
}

function downloadWorkflowJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/* Default node data factories */

function defaultNodeData(type: NodeType, sequence: number): CanvasNodeData {
  if (type === 'text') return { label: `文本 ${sequence}`, content: '' }
  if (type === 'character') return { label: `角色 ${sequence}`, description: '', assetId: null, tags: [] }
  if (type === 'scene') return { label: `场景 ${sequence}`, description: '', assetId: null, category: '' }
  if (type === 'audio') return { label: `音频 ${sequence}`, assetId: null, durationSeconds: 0, status: 'idle' }
  if (type === 'videoCompose')
    return {
      label: `视频合成 ${sequence}`,
      inputOrder: [],
      transitionName: null,
      modelId: 'stub-compose',
      assetId: null,
      status: 'idle',
    }
  if (type === 'superResolution')
    return {
      label: `视频超分 ${sequence}`,
      inputVideoId: '',
      scene: 'aigc',
      resolution: '1080p',
      fps: 30,
      assetId: null,
      status: 'idle',
    }
  if (type === 'muxAudioVideo')
    return { label: `音视频合成 ${sequence}`, modelId: 'stub-mux', assetId: null, status: 'idle' }
  if (type === 'mjImage')
    return {
      label: `MJ 图片 ${sequence}`,
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
      label: type === 'imageConfigV2' ? `图片生成 ${sequence}` : `图片 ${sequence}`,
      promptOverride: '',
      modelId: 'stub-image',
      orientation: 'landscape',
      assetId: null,
      status: 'idle',
    }
  return {
    label: type === 'videoConfigV2' ? `视频生成 ${sequence}` : `视频 ${sequence}`,
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

function jobTypeForNodeType(type: NodeType): JobType | null {
  if (type === 'text') return 'canvas.polishText'
  if (type === 'video') return 'canvas.generateVideo'
  if (type === 'audio') return 'canvas.generateAudio'
  if (type === 'videoCompose') return 'canvas.composeVideo'
  if (type === 'superResolution') return 'canvas.upscaleVideo'
  if (type === 'muxAudioVideo') return 'canvas.muxAudioVideo'
  if (type === 'mjImage') return null
  return 'canvas.generateImage'
}

/* Node wrappers bridge store updates into node components. */

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
  const runContext = useCanvasRunContext()
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
      onPolish={(nodeId) => runContext?.runNode(nodeId)}
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
  const handleApplyImageEdit = useCallback(
    (intent: ImageEditIntent) => {
      updateNodeData(intent.nodeId, { orientation: intent.orientation })
    },
    [updateNodeData],
  )
  return (
    <ImageNode
      id={id}
      data={data}
      {...(data.url ? { assetSafeUrl: data.url } : {})}
      selected={selected ?? false}
      onChange={handleChange}
      onApplyImageEdit={handleApplyImageEdit}
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

/* React Flow node type registry */

const nodeTypes: NodeTypes = {
  text: TextNodeWrapper,
  image: ImageNodeWrapper,
  video: VideoNodeWrapper,
  imageConfigV2: ImageConfigV2Node,
  videoConfigV2: VideoConfigV2Node,
  character: CharacterNode,
  scene: SceneNode,
  audio: AudioNode,
  videoCompose: VideoComposeNode,
  superResolution: SuperResolutionNode,
  muxAudioVideo: MuxAudioVideoNode,
  mjImage: MjImageNode,
}

const edgeTypes: EdgeTypes = {
  promptOrder: PromptOrderEdge,
  imageOrder: ImageOrderEdge,
  imageRole: ImageRoleEdge,
  outputLink: DeletableBezierEdge,
  reference: DeletableBezierEdge,
  default: DeletableBezierEdge,
}

/* Store <-> React Flow mappers */

function edgeTypeForRenderer(data: CanvasEdgeData | undefined): keyof typeof edgeTypes {
  return data?.edgeType ?? 'default'
}

function mapStoreNodes(storeNodes: CanvasStoreNode[], relatedNodeIds: ReadonlySet<string> = new Set()): Node[] {
  return storeNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    ...(n.width ? { width: n.width } : {}),
    ...(n.height ? { height: n.height } : {}),
    ...(n.width || n.height
      ? { style: { ...(n.width ? { width: n.width } : {}), ...(n.height ? { height: n.height } : {}) } }
      : {}),
    data: n.data as unknown as Record<string, unknown>,
    ...(relatedNodeIds.has(n.id) ? { className: 'cc-flow-node-related' } : {}),
  }))
}

function mapStoreEdges(storeEdges: CanvasStoreEdge[]): Edge[] {
  return storeEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: edgeTypeForRenderer(e.data),
    data: e.data as unknown as Record<string, unknown>,
  }))
}

/* Default positions for newly-created node types. */
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

function clientPointFromConnectEvent(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches.item(0)
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  return { x: event.clientX, y: event.clientY }
}

const NODE_OPTION_ICONS: Record<NodeType, TablerIcon> = {
  text: IconTypography,
  image: IconPhoto,
  video: IconVideo,
  character: IconFileText,
  scene: IconPhoto,
  audio: IconMovie,
  imageConfigV2: IconPhotoPlus,
  videoConfigV2: IconMovie,
  videoCompose: IconMovie,
  superResolution: IconMovie,
  muxAudioVideo: IconMovie,
  mjImage: IconPhotoPlus,
}

const ADDABLE_NODE_OPTIONS = getAddableNodeDefinitions().map((definition) => ({
  type: definition.type,
  label: definition.label,
  icon: NODE_OPTION_ICONS[definition.type],
  category: definition.category,
}))

const QUICK_TOOLS = ADDABLE_NODE_OPTIONS
  .filter((option) => ['text', 'image', 'imageConfigV2', 'video', 'videoConfigV2'].includes(option.type))
  .map((option) => ({
    ...option,
    label: option.label,
  }))

/* Default workflow metadata */

const DEFAULT_WORKFLOW_ID = 'default'
const DEFAULT_WORKFLOW_NAME = '未命名工作流'

/* Save status type */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type ConnectCreateMenuState = {
  type: 'connect-create'
  x: number
  y: number
  sourceNodeId: string
}

interface CanvasRunContextValue {
  runNode(nodeId: string): void
}

const CanvasRunContext = createContext<CanvasRunContextValue | null>(null)

function useCanvasRunContext(): CanvasRunContextValue | null {
  return useContext(CanvasRunContext)
}

/* Canvas body mounted inside ReactFlowProvider. */

function CanvasPageInner(): JSX.Element {
  /* React Flow hooks */
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, getNodes } = useReactFlow()

  /* Toolbar and panel state */
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false)
  const [showAssetPanel, setShowAssetPanel] = useState(false)
  const [showCharacterPanel, setShowCharacterPanel] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showJobPanel, setShowJobPanel] = useState(false)
  const [showChatBox, setShowChatBox] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select')
  const themePreference = useThemeStore((s) => s.preference)
  const setThemePreference = useThemeStore((s) => s.setPreference)

  /* Context menu state */
  const [contextMenu, setContextMenu] = useState<{
    type: 'pane' | 'node'
    x: number
    y: number
    nodeId?: string
  } | null>(null)
  const [connectCreateMenu, setConnectCreateMenu] = useState<ConnectCreateMenuState | null>(null)

  /* Save, load, and feedback state */
  const [innerSearchParams, setInnerSearchParams] = useSearchParams()
  const [currentWorkflowId, setCurrentWorkflowId] = useState(innerSearchParams.get('id') || DEFAULT_WORKFLOW_ID)
  const [workflowName, setWorkflowName] = useState(DEFAULT_WORKFLOW_NAME)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dropFeedback, setDropFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [snippetFeedback, setSnippetFeedback] = useState<string | null>(null)
  const [generationRecoveryFeedback, setGenerationRecoveryFeedback] = useState<string | null>(null)
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionValidationFeedback | null>(null)
  const [focusedRelatedNodeId, setFocusedRelatedNodeId] = useState<string | null>(null)
  const [snippets, setSnippets] = useState<CanvasSnippetView[]>([])
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([])
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>('')
  const [showProjectManager, setShowProjectManager] = useState(false)
  const importWorkflowInputRef = useRef<HTMLInputElement | null>(null)
  const isDirtyRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMacLikePlatform = useMemo(() => (
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)
  ), [])
  const deleteShortcutLabel = isMacLikePlatform ? 'Backspace' : 'Delete'

  /* Store selectors used by toolbar controls */
  const pastLen = useStore(canvasStore, (s) => s.past.length)
  const futureLen = useStore(canvasStore, (s) => s.future.length)

  /* React Flow local state mirrors the durable store snapshot. */
  const initialNodes = useMemo<Node[]>(
    () => mapStoreNodes(canvasStore.getState().nodes),
    [],
  )
  const initialEdges = useMemo<Edge[]>(
    () => mapStoreEdges(canvasStore.getState().edges),
    [],
  )
  const [rfNodes, setRfNodes, reactFlowOnNodesChange] = useNodesState<Node>(initialNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const isDraggingNodeRef = useRef(false)
  const connectStartNodeIdRef = useRef<string | null>(null)
  const [graphRevision, setGraphRevision] = useState(0)
  const markGraphDirty = useCallback(() => {
    isDirtyRef.current = true
    setGraphRevision((revision) => revision + 1)
  }, [])
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    isDraggingNodeRef.current = changes.some((change) => change.type === 'position' && change.dragging)
    reactFlowOnNodesChange(changes)
  }, [reactFlowOnNodesChange])
  const selectedNodeIds = useMemo(
    () => rfNodes.filter((node) => node.selected).map((node) => node.id),
    [rfNodes],
  )
  const focusedNodeId = focusedRelatedNodeId ?? (selectedNodeIds.length === 1 ? selectedNodeIds[0] : null)
  const relatedNodeIds = useMemo(
    () => (focusedNodeId ? computeRelatedNodeIds(focusedNodeId, rfEdges) : new Set<string>()),
    [focusedNodeId, rfEdges],
  )
  const displayNodes = useMemo(() => {
    if (relatedNodeIds.size === 0) return rfNodes
    return rfNodes.map((node) => ({
      ...node,
      ...(relatedNodeIds.has(node.id) ? { className: 'cc-flow-node-related' } : {}),
    }))
  }, [relatedNodeIds, rfNodes])
  const selectedSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === selectedSnippetId) ?? snippets[0] ?? null,
    [selectedSnippetId, snippets],
  )
  const skipNextPersistRef = useRef(false)
  const manualRunJobsRef = useRef(new Map<string, { nodeId: string; jobType: JobType }>())

  const syncReactFlowFromStore = useCallback(() => {
    skipNextPersistRef.current = true
    const state = canvasStore.getState()
    setRfNodes(mapStoreNodes(state.nodes))
    setRfEdges(mapStoreEdges(state.edges))
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
      setSnippetFeedback('加载片段失败')
    }
  }, [])

  const restoreWorkflowGraph = useCallback(async (snapshot: CanvasGraphSnapshot) => {
    let restoredNodes = snapshot.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      ...(n.width ? { width: n.width } : {}),
      ...(n.height ? { height: n.height } : {}),
      data: n.data,
    }))

    if (restoredNodes.length > 0) {
      try {
        const jobs = await window.comicCanvas.listJobs({ limit: 100 })
        const recoveredTasks = buildGenerationTaskStatusList(restoredNodes, jobs)
        restoredNodes = reconcileCanvasNodesWithJobs(restoredNodes, jobs)
        if (recoveredTasks.length > 0) {
          const completed = recoveredTasks.filter((task) => task.status === 'completed').length
          const active = recoveredTasks.filter((task) => task.phase === 'active').length
          const failed = recoveredTasks.filter((task) => task.status === 'failed').length
          setGenerationRecoveryFeedback(`已恢复 ${recoveredTasks.length} 个生成任务：${completed} 个已完成，${active} 个进行中，${failed} 个失败`)
        } else {
          setGenerationRecoveryFeedback(null)
        }
      } catch {
        // Job reconciliation is best-effort; graph loading must remain available offline.
        setGenerationRecoveryFeedback(null)
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
    syncReactFlowFromStore()
    if (snapshot.viewport) {
      canvasStore.getState().setViewport(snapshot.viewport)
    }
  }, [syncReactFlowFromStore])

  const planExecutionController = useMemo(
    () =>
      createCanvasPlanExecutionController({
        store: canvasStore,
        runNode: async (nodeId) => {
          const result = await window.comicCanvas.runCanvasNode({ workflowId: currentWorkflowId, nodeId })
          if ('errorClass' in result) {
            throw new Error(result.message)
          }
          return result
        },
      }),
    [currentWorkflowId],
  )

  const handleRunNode = useCallback(async (nodeId: string) => {
    const node = canvasStore.getState().nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return

    const jobType = jobTypeForNodeType(node.type)
    if (!jobType) return
    canvasStore.getState().updateNodeData(
      nodeId,
      jobType === 'canvas.polishText'
        ? { polishStatus: 'pending' }
        : { status: 'pending', assetId: null } as Partial<CanvasNodeData>
    )
    syncReactFlowFromStore()

    try {
      const result = await window.comicCanvas.runCanvasNode({ workflowId: currentWorkflowId, nodeId })
      if ('errorClass' in result) {
        canvasStore.getState().updateNodeData(nodeId, terminalFailureToNodePatch(jobType, {
          errorClass: result.errorClass,
          message: result.message,
          retryable: result.retryable,
        }))
        syncReactFlowFromStore()
        return
      }

      manualRunJobsRef.current.set(result.jobId, { nodeId, jobType })
    } catch {
      // The preload/main boundary can fail before a durable ticket exists; surface it on the node.
      canvasStore.getState().updateNodeData(nodeId, terminalFailureToNodePatch(jobType, {
        errorClass: 'run_node_enqueue_failed',
        message: '运行请求失败',
        retryable: false,
      }))
      syncReactFlowFromStore()
    }
  }, [currentWorkflowId, syncReactFlowFromStore])

  const canvasRunContextValue = useMemo<CanvasRunContextValue>(
    () => ({ runNode: (nodeId) => { void handleRunNode(nodeId) } }),
    [handleRunNode],
  )

  const persistToStore = useCallback(
    debounce((nodes: Node[], edges: Edge[]) => {
      if (skipNextPersistRef.current) {
        skipNextPersistRef.current = false
        return
      }
      if (isDraggingNodeRef.current) return
      canvasStore.getState().setNodes(
        nodes.map((n) => ({
          id: n.id,
          type: n.type as NodeType,
          position: n.position,
          ...(n.width ? { width: n.width } : {}),
          ...(n.height ? { height: n.height } : {}),
          data: n.data as unknown as CanvasNodeData,
        })),
      )
      canvasStore.getState().setEdges(
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          data: (e.data as unknown as CanvasEdgeData) ?? { edgeType: 'default' as const, createdAt: Date.now() },
        })),
      )
      markGraphDirty()
    }, 300),
    [markGraphDirty],
  )

  useEffect(() => {
    persistToStore(rfNodes, rfEdges)
  }, [rfNodes, rfEdges, persistToStore])

  useEffect(() => {
    void loadSnippets()
  }, [loadSnippets])

  useEffect(() => {
    let cancelled = false
    async function loadAssetCategories(): Promise<void> {
      try {
        const categories = await window.comicCanvas.getAssetCategories()
        if (!cancelled) {
          setAssetCategories(categories)
        }
      } catch {
        if (!cancelled) {
          setAssetCategories([])
        }
      }
    }

    void loadAssetCategories()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribeCompleted = window.comicCanvas.onJobCompleted((event) => {
      planExecutionController.notifyJobCompleted(event)
      const manualJob = manualRunJobsRef.current.get(event.jobId)
      if (manualJob) {
        manualRunJobsRef.current.delete(event.jobId)
        const patch = terminalResultToNodePatch(event.result)
        if (patch) {
          canvasStore.getState().updateNodeData(manualJob.nodeId, patch)
        }
      }
      syncReactFlowFromStore()
    })
    const unsubscribeFailed = window.comicCanvas.onJobFailed((event) => {
      planExecutionController.notifyJobFailed(event)
      const manualJob = manualRunJobsRef.current.get(event.jobId)
      if (manualJob) {
        manualRunJobsRef.current.delete(event.jobId)
        canvasStore.getState().updateNodeData(manualJob.nodeId, terminalFailureToNodePatch(manualJob.jobType, event.error))
      }
      syncReactFlowFromStore()
    })

    return () => {
      unsubscribeCompleted()
      unsubscribeFailed()
    }
  }, [planExecutionController, syncReactFlowFromStore])

  /* Save graph handler */
  const handleSave = useCallback(async () => {
    try {
      setSaveStatus('saving')
      const state = canvasStore.getState()
      const snapshot: CanvasGraphSnapshot = {
        nodes: state.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          ...(n.width ? { width: n.width } : {}),
          ...(n.height ? { height: n.height } : {}),
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

  const handleExportWorkflow = useCallback(async () => {
    try {
      await handleSave()
      const exported = await window.comicCanvas.exportWorkflow({ workflowId: currentWorkflowId })
      downloadWorkflowJson(exported, `${exported.name || currentWorkflowId}.json`)
      setSnippetFeedback(`已导出 ${exported.name}`)
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSnippetFeedback(null), 2400)
    } catch {
      setSnippetFeedback('导出失败')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSnippetFeedback(null), 3000)
    }
  }, [currentWorkflowId, handleSave])

  useEffect(() => installDirtyBeforeUnloadGuard({
    target: window,
    isDirty: () => isDirtyRef.current,
  }), [])

  /* Debounced autosave after local graph changes */
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
  }, [graphRevision, handleSave])

  /* Load graph helper reused by initial load and workflow switch. */
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
        syncReactFlowFromStore()
      }
      isDirtyRef.current = false
    } catch {
      // Silently fall back to empty canvas
    }
  }, [restoreWorkflowGraph, syncReactFlowFromStore])

  const handleImportWorkflowFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const json = await file.text()
      const result = await window.comicCanvas.importWorkflow({
        json,
        name: file.name.replace(/\.json$/iu, ''),
      })
      if ('errorClass' in result) {
        setSnippetFeedback(`导入失败：${result.message}`)
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
        saveStatusTimerRef.current = setTimeout(() => setSnippetFeedback(null), 3600)
        return
      }

      setCurrentWorkflowId(result.workflowId)
      setWorkflowName(file.name.replace(/\.json$/iu, '') || DEFAULT_WORKFLOW_NAME)
      setInnerSearchParams({ id: result.workflowId })
      await loadGraphForWorkflow(result.workflowId)
      setSnippetFeedback(`已导入工作流，跳过 ${result.dropped.length} 个不兼容项目`)
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSnippetFeedback(null), 3600)
    } catch {
      setSnippetFeedback('导入失败')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSnippetFeedback(null), 3000)
    }
  }, [loadGraphForWorkflow, setInnerSearchParams])

  /* Initial graph load */
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

  /* Dirty-safe workflow switch handler */
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

  /* Timer cleanup */
  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  /* Undo/redo store -> React Flow sync */
  const prevPastLen = useRef(pastLen)
  const prevFutureLen = useRef(futureLen)

  useEffect(() => {
    if (
      pastLen !== prevPastLen.current ||
      futureLen !== prevFutureLen.current
    ) {
      prevPastLen.current = pastLen
      prevFutureLen.current = futureLen
      syncReactFlowFromStore()
    }
  }, [pastLen, futureLen, syncReactFlowFromStore])

  /* Realtime terminal event invalidation and graph sync */
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
          type: edgeTypeForRenderer(storeEdge?.data),
          data: storeEdge?.data as unknown as Record<string, unknown>,
        },
      ])
      setConnectionFeedback(null)
      markGraphDirty()
    }
  }, [markGraphDirty, setRfEdges])

  /* Commit final drag positions into the durable store. */
  const handleNodeDragStop = useCallback<OnNodeDrag>((_event, node) => {
    isDraggingNodeRef.current = false
    setFocusedRelatedNodeId(node.id)
    const finalNodes = new Map(getNodes().map((currentNode) => [currentNode.id, currentNode]))
    canvasStore.setState((prev) => {
      const snapshot = {
        nodes: prev.nodes,
        edges: prev.edges,
        viewport: prev.viewport,
      }
      return {
        past: [...prev.past, structuredClone(snapshot)].slice(-50),
        future: [],
        nodes: prev.nodes.map((n) => {
          const nextNode = finalNodes.get(n.id)
          return nextNode
            ? {
                ...n,
                position: { x: nextNode.position.x, y: nextNode.position.y },
                ...(nextNode.width ? { width: nextNode.width } : {}),
                ...(nextNode.height ? { height: nextNode.height } : {}),
              }
            : n
        }),
      }
    })
    markGraphDirty()
  }, [getNodes, markGraphDirty])

  const handleNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    setFocusedRelatedNodeId(node.id)
  }, [])

  const handleNodeMouseLeave = useCallback(() => {
    setFocusedRelatedNodeId(null)
  }, [])

  /* Graph edit actions */
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
      const size = defaultCanvasNodeSize(type)
      const newNode: Node = {
        id,
        type,
        position,
        width: size.width,
        height: size.height,
        style: { width: size.width, height: size.height },
        data: defaultNodeData(type, count + 1) as unknown as Record<
          string,
          unknown
        >,
      }
      setRfNodes((nds) => [...nds, newNode])

      // Keep React Flow local state and Zustand durable state in sync.
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
              width: size.width,
              height: size.height,
              data: defaultNodeData(type, count + 1),
            },
          ],
        }
      })
      markGraphDirty()
      return id
    },
    [markGraphDirty, setRfNodes],
  )

  const handleCreateCharacterFromCategory = useCallback(
    (category: AssetCategory | null) => {
      const nodeType: NodeType = category?.slug === 'scene' || category?.name.includes('场景') ? 'scene' : 'character'
      const id = handleAddNode(nodeType)
      canvasStore.getState().updateNodeData(id, {
        label: category?.name ?? (nodeType === 'scene' ? '场景' : '角色'),
        ...(category?.description ? { description: category.description } : {}),
        ...(nodeType === 'scene' && category?.slug ? { category: category.slug } : {}),
      })
      syncReactFlowFromStore()
      setShowCharacterPanel(false)
    },
    [handleAddNode, syncReactFlowFromStore],
  )

  /* Context menu handlers */
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

  const handleViewportMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    canvasStore.getState().setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom })
    isDirtyRef.current = true
  }, [])

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

  const handleCreateConnectedNodeFromDragMenu = useCallback(
    (type: NodeType) => {
      if (!connectCreateMenu) return
      const pos = screenToFlowPosition({ x: connectCreateMenu.x, y: connectCreateMenu.y })
      const createdNodeId = handleAddNode(type, pos)
      const result = connectCreatedCanvasNode({
        store: canvasStore,
        sourceNodeId: connectCreateMenu.sourceNodeId,
        createdNodeId,
        notify: setConnectionFeedback,
      })
      if (result.ok) {
        syncReactFlowFromStore()
        setConnectionFeedback(null)
      }
      setConnectCreateMenu(null)
    },
    [connectCreateMenu, handleAddNode, screenToFlowPosition, syncReactFlowFromStore],
  )

  const handleConnectStart = useCallback<OnConnectStart>((_event, params) => {
    connectStartNodeIdRef.current = params.nodeId
    setConnectCreateMenu(null)
  }, [])

  const handleConnectEnd = useCallback<OnConnectEnd>((event, connectionState) => {
    const sourceNodeId = connectStartNodeIdRef.current
    connectStartNodeIdRef.current = null
    if (!sourceNodeId || connectionState.toNode !== null) return

    const point = clientPointFromConnectEvent(event)
    if (!point) return

    setContextMenu(null)
    setConnectCreateMenu({
      type: 'connect-create',
      sourceNodeId,
      x: point.x,
      y: point.y,
    })
  }, [])

  const getAllowedConnectCreateOptions = useCallback((sourceNodeId: string | undefined) => {
    const sourceNode = canvasStore.getState().nodes.find((node) => node.id === sourceNodeId)
    if (!sourceNode) return []
    return getConnectCreateNodeDefinitions(sourceNode.type).map((definition) => ({
      type: definition.type,
      label: definition.label,
      icon: NODE_OPTION_ICONS[definition.type],
      category: definition.category,
    }))
  }, [])

  const handleDuplicateSelection = useCallback(
    (nodeIds: string[]) => {
      const result = duplicateSelectedCanvasNodes({
        store: canvasStore,
        selectedNodeIds: nodeIds,
      })
      if (result.duplicatedNodeIds.length === 0) return
      syncReactFlowFromStore()
      setContextMenu(null)
    },
    [syncReactFlowFromStore],
  )

  const handleDeleteSelection = useCallback(
    (nodeIds: string[]) => {
      const result = deleteSelectedCanvasNodes({
        store: canvasStore,
        selectedNodeIds: nodeIds,
      })
      if (result.deletedNodeIds.length === 0) return
      syncReactFlowFromStore()
      setContextMenu(null)
    },
    [syncReactFlowFromStore],
  )

  const canvasCommands = useMemo<CanvasCommand[]>(() => [
    ...ADDABLE_NODE_OPTIONS.map((option) => ({
      id: `add-node-${option.type}`,
      label: `添加${option.label}`,
      keywords: ['add', 'node', '添加', '节点', option.type, option.label],
      run: () => handleAddNode(option.type),
    })),
    {
      id: 'fit-view',
      label: '适配视图',
      keywords: ['fit', 'zoom', 'view', '适配', '缩放', '视图'],
      run: () => { void fitView({ padding: 0.18, duration: 240 }) },
    },
    {
      id: 'select-mode',
      label: '选择模式',
      keywords: ['select', 'pointer', '选择', '指针'],
      run: () => setInteractionMode('select'),
    },
    {
      id: 'pan-mode',
      label: '拖拽画布模式',
      keywords: ['pan', 'hand', '拖拽', '画布'],
      run: () => setInteractionMode('pan'),
    },
    {
      id: 'duplicate-selection',
      label: '复制选中节点',
      keywords: ['duplicate', 'copy', '复制', '节点'],
      disabled: selectedNodeIds.length === 0,
      run: () => handleDuplicateSelection(selectedNodeIds),
    },
    {
      id: 'delete-selection',
      label: '删除选中节点',
      keywords: ['delete', 'remove', '删除', '移除'],
      disabled: selectedNodeIds.length === 0,
      run: () => handleDeleteSelection(selectedNodeIds),
    },
  ], [fitView, handleAddNode, handleDeleteSelection, handleDuplicateSelection, selectedNodeIds])

  const handleCanvasShortcut = useCallback((event: KeyboardEvent) => {
    if (isEditableKeyboardTarget(event.target)) return

    const key = event.key.toLowerCase()
    const mod = event.ctrlKey || event.metaKey

    if (mod && key === 's') {
      event.preventDefault()
      void handleSave().catch(() => undefined)
      return
    }

    if (mod && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) handleRedo()
      else handleUndo()
      return
    }

    if (mod && key === 'y') {
      event.preventDefault()
      handleRedo()
      return
    }

    if (mod && key === '1') {
      event.preventDefault()
      void fitView({ padding: 0.18, duration: 240 })
      return
    }

    if (mod && key === '2') {
      event.preventDefault()
      setInteractionMode('select')
      return
    }

    if (mod && key === '3') {
      event.preventDefault()
      setInteractionMode('pan')
      return
    }

    if (mod && key === 'k') {
      event.preventDefault()
      setShowCommandPalette(true)
      return
    }

    if (mod && key === 'd') {
      event.preventDefault()
      handleDuplicateSelection(selectedNodeIds)
      return
    }

    if (event.key === 'Delete' || (isMacLikePlatform && event.key === 'Backspace')) {
      if (selectedNodeIds.length === 0) return
      event.preventDefault()
      handleDeleteSelection(selectedNodeIds)
    }
  }, [
    fitView,
    handleDeleteSelection,
    handleDuplicateSelection,
    handleRedo,
    handleSave,
    handleUndo,
    isMacLikePlatform,
    selectedNodeIds,
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleCanvasShortcut)
    return () => window.removeEventListener('keydown', handleCanvasShortcut)
  }, [handleCanvasShortcut])

  const handleRunAll = useCallback(() => {
    // Keep React Flow local state and Zustand durable state in sync.
  }, [])

  const handleSaveSnippet = useCallback(async () => {
    try {
      const snippet = extractCanvasSnippet({
        name: `片段 ${new Date().toLocaleString('zh-CN')}`,
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
      setSnippetFeedback(`已保存片段，包含 ${saved.nodes.length} 个节点`)
    } catch {
      setSnippetFeedback('请至少选择两个节点再保存片段')
    }
  }, [loadSnippets, selectedNodeIds])

  const handleInsertSnippet = useCallback(async () => {
    if (!selectedSnippet) {
      setSnippetFeedback('未选择片段')
      return
    }

    const detail = await window.comicCanvas.getCanvasSnippet({ snippetId: selectedSnippet.id })
    if ('errorClass' in detail) {
      setSnippetFeedback(detail.message)
      return
    }

    const snippet: CanvasSnippet = {
      schemaVersion: 1,
      name: detail.name,
      createdAt: detail.createdAt,
      nodes: detail.nodes,
      edges: detail.edges,
    }

    insertCanvasSnippet(snippet, canvasStore, {
      origin: {
        x: Math.max(120, ...canvasStore.getState().nodes.map((node) => node.position.x + 360)),
        y: Math.max(120, ...canvasStore.getState().nodes.map((node) => node.position.y)),
      },
    })
    syncReactFlowFromStore()
    setSnippetFeedback(`已插入片段，包含 ${detail.nodes.length} 个节点`)
  }, [selectedSnippet, syncReactFlowFromStore])

  const handleDeleteSnippet = useCallback(async (snippetId: string) => {
    const result = await window.comicCanvas.deleteCanvasSnippet({ snippetId })
    if (!result.deleted) {
      setSnippetFeedback(result.message ?? '删除片段失败')
      return
    }

    await loadSnippets()
    setSnippetFeedback('已删除片段')
  }, [loadSnippets])

  /* Local media drop and asset insertion handlers */
  const showDropFeedback = useCallback((kind: 'success' | 'error', message: string) => {
    const normalizedMessage =
      kind === 'success' && !message.startsWith('\u5df2\u5bfc\u5165')
        ? `已导入${message.replace(/^.*?\?/u, '')}`
        : kind === 'error' && message.includes('{plan.label}')
          ? '\u5bfc\u5165\u5931\u8d25'
          : message
    setDropFeedback({ kind, message: normalizedMessage })
    window.setTimeout(() => setDropFeedback(null), 2800)
  }, [])

  const appendAssetNode = useCallback(
    (asset: { id: string; safeUrl: string; mediaType: 'image' | 'video' | 'audio'; name: string; mode?: CanvasAssetInsertMode }, flowPosition?: { x: number; y: number }) => {
      const nodeType: NodeType =
        asset.mediaType === 'image' && (asset.mode === 'character' || asset.mode === 'scene')
          ? asset.mode
          : asset.mediaType
      const currentNodes = canvasStore.getState().nodes
      const count = currentNodes.filter((n) => n.type === nodeType).length
      const position = flowPosition
        ? { x: flowPosition.x - 140, y: flowPosition.y - 40 }
        : (() => {
            const offset = NODE_OFFSETS[nodeType]
            return { x: offset.x + count * 40, y: offset.y + count * 60 }
          })()
      const id = `node-${crypto.randomUUID()}`
      const size = defaultCanvasNodeSize(nodeType)
      const data =
        nodeType === 'image' || nodeType === 'character' || nodeType === 'scene'
          ? buildAssetNodeInsertion({
              asset: {
                id: asset.id,
                mediaType: 'image',
                status: 'ready',
                relativePath: asset.name,
                safeUrl: asset.safeUrl,
                metadata: {},
                displayName: asset.name,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              mode: nodeType,
              sequence: count + 1,
            }).node.data
          : {
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
        width: size.width,
        height: size.height,
        style: { width: size.width, height: size.height },
        data: data as unknown as Record<string, unknown>,
      }
      setRfNodes((nds) => [...nds, newNode])
      canvasStore.setState((prev) => {
        const snapshot = { nodes: prev.nodes, edges: prev.edges, viewport: prev.viewport }
        return {
          past: [...prev.past, structuredClone(snapshot)].slice(-50),
          future: [],
          nodes: [...prev.nodes, { id, type: nodeType, position, width: size.width, height: size.height, data }],
        }
      })
      markGraphDirty()
    },
    [markGraphDirty, setRfNodes],
  )

  const handleInsertAsset = useCallback(
    (asset: { id: string; url: string; type: 'image' | 'video' | 'audio'; name: string; mode?: CanvasAssetInsertMode }) => {
      if (asset.mode === 'reference' && asset.type === 'image') {
        const state = canvasStore.getState()
        const targetNode = state.nodes.find(
          (node) => selectedNodeIds.includes(node.id) && (node.type === 'video' || node.type === 'videoConfigV2')
        )
        if (targetNode) {
          const patch = buildReferenceAssetPatch({
            currentReferences: 'referenceAssets' in targetNode.data && Array.isArray(targetNode.data.referenceAssets)
              ? targetNode.data.referenceAssets
              : [],
            asset: {
              id: asset.id,
              mediaType: 'image',
              status: 'ready',
              relativePath: asset.name,
              safeUrl: asset.url,
              metadata: {},
              displayName: asset.name,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          })
          canvasStore.getState().updateNodeData(targetNode.id, patch)
          syncReactFlowFromStore()
          return
        }
      }

      appendAssetNode({
        id: asset.id,
        safeUrl: asset.url,
        mediaType: asset.type,
        name: asset.name,
        ...(asset.mode ? { mode: asset.mode } : {}),
      })
    },
    [appendAssetNode, selectedNodeIds, syncReactFlowFromStore],
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
      if (files.length === 0) return
      event.preventDefault()

      const batchPlan = planLocalMediaDrops(files)
      if (!batchPlan.ok) {
        showDropFeedback('error', batchPlan.reason)
        return
      }

      const basePosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      let insertedCount = 0
      let failedCount = 0
      try {
        for (const [index, plan] of batchPlan.plans.entries()) {
          try {
            const imported: AssetRecord = await window.comicCanvas.importAsset({
              sourcePath: plan.sourcePath,
              mediaType: plan.mediaType,
            })
            appendAssetNode(
              {
                id: imported.id,
                safeUrl: assetDisplayUrl(imported),
                mediaType: plan.mediaType,
                name: plan.label,
              },
              { x: basePosition.x + index * 36, y: basePosition.y + index * 36 },
            )
            insertedCount += 1
          } catch {
            // Individual import failures should not prevent the remaining dropped media from importing.
            failedCount += 1
          }
        }
      } finally {
        if (insertedCount > 0) {
          const rejectedCount = batchPlan.rejected.length + failedCount
          const suffix = rejectedCount > 0 ? `，${rejectedCount} 个文件未导入` : ''
          showDropFeedback('success', `已导入 ${insertedCount} 个媒体文件${suffix}`)
        } else {
          const firstRejected = batchPlan.rejected[0]?.reason
          showDropFeedback('error', firstRejected ?? '导入失败')
        }
      }
    },
    [appendAssetNode, screenToFlowPosition, showDropFeedback],
  )

  /* AI plan application */
  const handleApplyPlan = useCallback(
    (p: CanvasPlan, { autoExecute }: ApplyPlanOptions) => {
      planExecutionController.applyPlan(p, { autoExecute })
      syncReactFlowFromStore()
    },
    [planExecutionController, syncReactFlowFromStore],
  )

  return (
    <CanvasRunContext.Provider value={canvasRunContextValue}>
      <div className="flex h-screen w-screen flex-col bg-bg-base">
      <header
        data-testid="canvas-topbar"
        className="flex h-14 shrink-0 items-center justify-between border-b border-border-secondary bg-bg-surface px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-secondary bg-bg-card text-text-secondary shadow-sm transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="返回项目"
            title="返回项目"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowProjectManager(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold text-text-base transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
            aria-label="打开工作流切换器"
            title="打开工作流切换器"
          >
            {workflowName}
            <IconChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            画布项目
          </span>
          <ProjectStyleSelector workflowId={currentWorkflowId} />
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={importWorkflowInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportWorkflowFile(event)}
            aria-label="工作流 JSON 文件"
          />
          <button
            type="button"
            onClick={handleUndo}
            disabled={pastLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="撤销"
            title="撤销"
          >
            <IconArrowBackUp className="h-3.5 w-3.5" />
            撤销
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={futureLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="重做"
            title="重做"
          >
            <IconArrowForwardUp className="h-3.5 w-3.5" />
            重做
          </button>
          <span className="h-5 w-px bg-border-secondary" />
          <button
            type="button"
            onClick={() => importWorkflowInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
            aria-label="导入工作流 JSON"
            title="导入工作流 JSON"
          >
            <IconUpload className="h-3.5 w-3.5" />
            导入
          </button>
          <button
            type="button"
            onClick={() => void handleExportWorkflow()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
            aria-label="导出工作流 JSON"
            title="导出工作流 JSON"
          >
            <IconDownload className="h-3.5 w-3.5" />
            导出
          </button>
          <button
            type="button"
            onClick={() => void handleSave().catch(() => undefined)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
            aria-label="保存工作流"
            title="保存工作流"
          >
            {saveStatus === 'saving' ? (
              <>
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                保存中...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">已保存</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <IconDeviceFloppy className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-400">保存失败</span>
              </>
            ) : (
              <>
                <IconDeviceFloppy className="h-3.5 w-3.5" />
                保存
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
            aria-label="运行全部"
          >
            <IconPlayerPlay className="h-3.5 w-3.5" />
            运行全部
          </button>
          <button
            type="button"
            onClick={() => setShowJobPanel((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary px-3 text-[13px] font-medium transition-all duration-200 ease-luxury active:scale-95 ${showJobPanel ? 'bg-brand/10 text-brand' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-base'}`}
            aria-label="切换任务状态"
            title="切换任务状态"
          >
            <IconListDetails className="h-3.5 w-3.5" />
            任务
          </button>
          <button
            type="button"
            onClick={() => setThemePreference(themePreference === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="切换主题"
            title={themePreference === 'dark' ? '切换到亮色' : '切换到暗色'}
          >
            {themePreference === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>
        </div>
      </header>
      <div className="relative flex-1" onDragOver={handleCanvasDragOver} onDrop={(event) => void handleCanvasDrop(event)}>
        <ReactFlow
          nodes={displayNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onNodeDragStop={handleNodeDragStop}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onMoveEnd={handleViewportMoveEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
        {generationRecoveryFeedback && (
          <div
            role="status"
            data-testid="generation-recovery-feedback"
            className="pointer-events-none absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-lg border border-border-secondary bg-bg-panel px-3 py-2 text-[13px] text-text-base shadow-card"
          >
            {generationRecoveryFeedback}
          </div>
        )}
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
                    添加节点
                  </p>
                  {ADDABLE_NODE_OPTIONS.map((opt) => (
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
                    节点操作
                  </p>
                  <button
                    onClick={() => handleDuplicateSelection([contextMenu.nodeId!])}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                  >
                    <IconCopy className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                    <span className="text-[13px] font-medium text-text-base">
                      复制节点
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteSelection([contextMenu.nodeId!])}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                  >
                    <IconTrash className="h-4 w-4 text-text-secondary group-hover:text-red-400" />
                    <span className="text-[13px] font-medium text-text-base">
                      删除节点
                    </span>
                  </button>
                  <span className="my-1 block h-px bg-border-secondary" />
                  {getAllowedConnectCreateOptions(contextMenu.nodeId).map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => handleCreateConnectedNodeAtContextMenu(opt.type)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                    >
                      <opt.icon className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                      <span className="text-[13px] font-medium text-text-base">
                        连接到{opt.label}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
        {connectCreateMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setConnectCreateMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setConnectCreateMenu(null)
              }}
            />
            <div
              className="cc-anim-fade-in fixed z-50 w-[180px] rounded-xl border border-border-secondary bg-bg-panel p-1.5 shadow-[0_15px_45px_rgba(0,0,0,0.12)]"
              style={{ left: connectCreateMenu.x, top: connectCreateMenu.y }}
            >
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">
                生成引用节点
              </p>
              {getAllowedConnectCreateOptions(connectCreateMenu.sourceNodeId).map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleCreateConnectedNodeFromDragMenu(opt.type)}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
                >
                  <opt.icon className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                  <span className="text-[13px] font-medium text-text-base">
                    连接到{opt.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <aside
          data-testid="canvas-left-toolbar"
          className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-full border border-border-primary bg-bg-panel p-1.5 shadow-card"
        >
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury active:scale-90 ${isAddMenuOpen ? 'bg-brand text-bg-base' : 'text-text-secondary hover:border-brand/30 hover:bg-bg-hover hover:text-text-base'}`}
            title={isAddMenuOpen ? '收起' : '添加节点'}
            aria-label={isAddMenuOpen ? '关闭添加菜单' : '添加节点'}
          >
            {isAddMenuOpen ? <IconX className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
          </button>
          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />

          <button
            type="button"
            onClick={() => setInteractionMode('select')}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${interactionMode === 'select' ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="选择模式"
            aria-label="选择模式"
          >
            <IconPointer className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setInteractionMode('pan')}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${interactionMode === 'pan' ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="拖拽画布模式"
            aria-label="拖拽画布模式"
          >
            <IconHandGrab className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showCommandPalette ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="命令面板"
            aria-label="命令面板"
          >
            <IconSearch className="h-4 w-4" />
          </button>

          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />
          {QUICK_TOOLS.map((tool) => (
            <button
              key={tool.type}
              type="button"
              onClick={() => { handleAddNode(tool.type); setIsAddMenuOpen(false) }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-text-secondary transition-all duration-200 ease-luxury hover:border-brand/30 hover:bg-bg-hover hover:text-text-base active:scale-90"
              title={`添加${tool.label}`}
            >
              <tool.icon className="h-4 w-4" />
            </button>
          ))}
          <span className="mx-auto my-0.5 h-px w-6 bg-border-primary" />
          <button
            type="button"
            onClick={() => void handleSave().catch(() => undefined)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${saveStatus === 'saving' ? 'text-brand' : saveStatus === 'saved' ? 'text-green-400' : 'text-text-secondary hover:text-text-base'}`}
            title={saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '保存 (Ctrl+S)'}
            aria-label="保存工作流"
          >
            {saveStatus === 'saving' ? <IconLoader2 className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <IconCheck className="h-4 w-4" /> : <IconDeviceFloppy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowAssetPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showAssetPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-base'}`}
            title="资产库"
            aria-label="切换资产库"
          >
            <IconFolder className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowWorkflowPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showWorkflowPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="工作流片段"
            aria-label="切换工作流面板"
          >
            <IconTemplate className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCharacterPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showCharacterPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="角色分类"
            aria-label="切换角色分类面板"
          >
            <IconUsers className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowStylePanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showStylePanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="风格库"
            aria-label="切换风格面板"
          >
            <IconPalette className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowChatBox((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showChatBox ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="对话"
            aria-label="切换对话面板"
          >
            <IconMessage className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowJobPanel((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showJobPanel ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="任务"
            aria-label="切换任务状态"
          >
            <IconListDetails className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setThemePreference(themePreference === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            title={themePreference === 'dark' ? '切换到亮色' : '切换到暗色'}
            aria-label="切换主题"
          >
            {themePreference === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowShortcutHelp((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-90 ${showShortcutHelp ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:text-text-base'}`}
            title="画布快捷键"
            aria-label="切换快捷键帮助"
          >
            <IconHelp className="h-4 w-4" />
          </button>
        </aside>
        <div
          className={`absolute left-[72px] top-1/2 z-30 w-[220px] -translate-y-1/2 rounded-xl border border-border-primary bg-bg-panel p-3 shadow-pop transition-all duration-300 ease-luxury ${isAddMenuOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-2 opacity-0'}`}
        >
          {Array.from(new Set(ADDABLE_NODE_OPTIONS.map((n) => n.category))).map((cat) => (
            <div key={cat}>
              <p className="px-2 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">{cat}</p>
              <div className="flex flex-col gap-0.5">
                {ADDABLE_NODE_OPTIONS.filter((n) => n.category === cat).map((opt) => (
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
        {showShortcutHelp && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-4" onClick={() => setShowShortcutHelp(false)}>
            <section
              className="w-full max-w-[420px] rounded-2xl border border-border-secondary bg-bg-panel p-4 shadow-pop"
              onClick={(event) => event.stopPropagation()}
              aria-label="画布快捷键"
            >
              <div className="flex items-center justify-between border-b border-border-secondary pb-3">
                <h2 className="text-[15px] font-semibold text-text-base">画布快捷键</h2>
                <button
                  type="button"
                  onClick={() => setShowShortcutHelp(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
                  aria-label="关闭快捷键帮助"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-[13px] text-text-secondary">
                {[
                  ['Ctrl/Cmd+S', '保存工作流'],
                  ['Ctrl/Cmd+Z', '撤销'],
                  ['Ctrl/Cmd+Shift+Z / Ctrl+Y', '重做'],
                  ['Ctrl/Cmd+K', '命令面板'],
                  ['Ctrl/Cmd+D', '复制选中节点'],
                  ['Ctrl/Cmd+1', '适配视图'],
                  ['Ctrl/Cmd+2', '选择模式'],
                  ['Ctrl/Cmd+3', '拖拽画布模式'],
                  [deleteShortcutLabel, '删除选中节点'],
                ].map(([keys, description]) => (
                  <div key={keys} className="flex items-center justify-between rounded-lg bg-bg-card px-3 py-2">
                    <span>{description}</span>
                    <kbd className="rounded-md border border-border-secondary bg-bg-input px-2 py-0.5 font-mono text-[11px] font-semibold text-text-base">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        <div
          data-testid="canvas-viewport-toolbar"
          className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-full border border-border-primary bg-bg-panel p-1.5 shadow-card"
        >
          <button
            type="button"
            onClick={() => { void fitView({ padding: 0.18, duration: 240 }) }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="适配视图"
            title="适配视图"
          >
            <IconMaximize className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { void zoomOut() }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="缩小"
            title="缩小"
          >
            <IconZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { void zoomIn() }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
            aria-label="放大"
            title="放大"
          >
            <IconZoomIn className="h-4 w-4" />
          </button>
        </div>
        {showProjectManager && (
          <ProjectManager
            currentWorkflowId={currentWorkflowId}
            onSwitchWorkflow={(workflowId, name) => void handleSwitchWorkflow(workflowId, name)}
            onClose={() => setShowProjectManager(false)}
          />
        )}
        {showAssetPanel && (
          <CanvasAssetPanel
            open={showAssetPanel}
            onClose={() => setShowAssetPanel(false)}
            onInsertAsset={handleInsertAsset}
          />
        )}
        <WorkflowPanel
          open={showWorkflowPanel}
          snippets={snippets}
          selectedSnippetId={selectedSnippetId}
          onSelectSnippet={setSelectedSnippetId}
          onInsertSnippet={() => void handleInsertSnippet()}
          onSaveSnippet={() => void handleSaveSnippet()}
          onDeleteSnippet={(snippetId) => void handleDeleteSnippet(snippetId)}
          onClose={() => setShowWorkflowPanel(false)}
        />
        <CharacterLibraryPanel
          open={showCharacterPanel}
          categories={assetCategories}
          onCreateCharacterNode={handleCreateCharacterFromCategory}
          onClose={() => setShowCharacterPanel(false)}
        />
        <StyleLibraryPanel
          open={showStylePanel}
          workflowId={currentWorkflowId}
          onClose={() => setShowStylePanel(false)}
        />

        {showJobPanel && (
          <CanvasJobPanel onClose={() => setShowJobPanel(false)} />
        )}
        <CanvasCommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          commands={canvasCommands}
        />
        <CanvasChatBox
          open={showChatBox}
          onToggle={() => setShowChatBox((v) => !v)}
          agentEnabled={false}
          onApplyPlan={handleApplyPlan}
        />
      </div>
      </div>
    </CanvasRunContext.Provider>
  )
}

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
