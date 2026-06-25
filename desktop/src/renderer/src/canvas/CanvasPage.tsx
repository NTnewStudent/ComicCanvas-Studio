/**
 * 全屏 ReactFlow 画布页面 — 接入 canvas store 和节点组件
 * 性能优化：
 * 1. ReactFlow 内置 useNodesState/useEdgesState 作为实时状态源
 * 2. Zustand store 仅用于持久化（debounced）和撤销/重做
 * 3. nodeTypes 定义在组件外部（模块级）避免重渲染
 * 4. 节点组件已添加 React.memo（见各节点文件）
 * 5. 所有回调用 useCallback 稳定化
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
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Play,
  Type,
  ImageIcon,
  Video,
  Copy,
  Trash2,
  FileText,
  ImagePlus,
  Clapperboard,
  Save,
  Check,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useStore } from 'zustand'

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
import { useCanvasRealtime } from './hooks/use-canvas-realtime'
import './canvas.css'

import type {
  NodeType,
  TextNodeData,
  ImageNodeData,
  VideoNodeData,
  CanvasNodeData,
} from '../../../../../shared/nodes'
import type { CanvasGraphSnapshot } from '../../../../../shared/graph'

/* ─── Debounce utility ─── */

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: never[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as unknown as T
}

/* ─── Default data factories ─── */

function defaultNodeData(type: NodeType, sequence: number): CanvasNodeData {
  if (type === 'text') return { label: `Text ${sequence}`, content: '' }
  if (type === 'image' || type === 'imageConfigV2')
    return {
      label: type === 'imageConfigV2' ? `生图 ${sequence}` : `Image ${sequence}`,
      promptOverride: '',
      modelId: 'stub-image',
      orientation: 'landscape',
      assetId: null,
      status: 'idle',
    }
  return {
    label: type === 'videoConfigV2' ? `生视频 ${sequence}` : `Video ${sequence}`,
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

/* ─── Node wrapper 将 store 回调注入 ReactFlow 自动传入的 props ─── */

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
      selected={selected ?? false}
      onChange={handleChange}
    />
  )
}

/* ─── Node types（模块级常量，避免组件内每次渲染创建新引用） ─── */

const nodeTypes: NodeTypes = {
  text: TextNodeWrapper,
  image: ImageNodeWrapper,
  video: VideoNodeWrapper,
  imageConfigV2: ImageConfigV2Node,
  videoConfigV2: VideoConfigV2Node,
}

/* ─── Store → ReactFlow 映射 ─── */

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
  }))
}

/** 新节点默认位置偏移 */
const NODE_OFFSETS: Record<NodeType, { x: number; y: number }> = {
  text: { x: 160, y: 120 },
  image: { x: 540, y: 120 },
  video: { x: 920, y: 120 },
  imageConfigV2: { x: 540, y: 500 },
  videoConfigV2: { x: 920, y: 500 },
}

/* ─── Context menu node options ─── */

const CONTEXT_MENU_NODE_OPTIONS: {
  type: NodeType
  label: string
  icon: LucideIcon
}[] = [
  { type: 'text', label: '文本', icon: FileText },
  { type: 'image', label: '图片', icon: ImageIcon },
  { type: 'imageConfigV2', label: '生图 V2', icon: ImagePlus },
  { type: 'video', label: '视频', icon: Video },
  { type: 'videoConfigV2', label: '生视频 V2', icon: Clapperboard },
]

/* ─── Default workflow ID ─── */

const DEFAULT_WORKFLOW_ID = 'default'
const DEFAULT_WORKFLOW_NAME = '未命名工作流'

/* ─── Save status type ─── */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/* ─── CanvasPageInner（必须在 ReactFlowProvider 内） ─── */

function CanvasPageInner(): JSX.Element {
  /* ── ReactFlow hooks ── */
  const { screenToFlowPosition } = useReactFlow()

  /* ── Context menu state ── */
  const [contextMenu, setContextMenu] = useState<{
    type: 'pane' | 'node'
    x: number
    y: number
    nodeId?: string
  } | null>(null)

  /* ── Save/Load state ── */
  const [currentWorkflowId] = useState(DEFAULT_WORKFLOW_ID)
  const [workflowName, setWorkflowName] = useState(DEFAULT_WORKFLOW_NAME)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const isDirtyRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Store selectors（仅用于撤销/重做 UI 和持久化回调） ── */
  const pastLen = useStore(canvasStore, (s) => s.past.length)
  const futureLen = useStore(canvasStore, (s) => s.future.length)

  /* ── ReactFlow 作为实时状态唯一来源 ── */
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

  /* ── Debounced 持久化到 store ── */
  const skipNextPersistRef = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          data: { edgeType: 'default' as const, createdAt: Date.now() },
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

  /* ── Save graph handler ── */
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
    } catch {
      setSaveStatus('error')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [currentWorkflowId])

  /* ── Ctrl+S / Cmd+S keyboard shortcut ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  /* ── Debounced auto-save (2s after changes) ── */
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        handleSave()
      }
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [rfNodes, rfEdges, handleSave])

  /* ── Load graph on mount ── */
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
          canvasStore.getState().setNodes(
            snapshot.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
          )
          canvasStore.getState().setEdges(
            snapshot.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              data: e.data,
            })),
          )
          setRfNodes(snapshot.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data as unknown as Record<string, unknown>,
          })))
          setRfEdges(snapshot.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'default',
          })))
          if (snapshot.viewport) {
            canvasStore.getState().setViewport(snapshot.viewport)
          }
        }
        setWorkflowName(DEFAULT_WORKFLOW_NAME)
        isDirtyRef.current = false
      } catch {
        // Silently fall back to empty canvas
      }
    }
    loadGraph()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Cleanup timers ── */
  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  /* ── Undo/Redo：从 store 重新同步到 ReactFlow ── */
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

  /* ── 实时事件 ── */
  useCanvasRealtime()

  /* ── 连接处理器 ── */
  const handleConnect = useCallback<OnConnect>((connection) => {
    const result = canvasStore
      .getState()
      .addEdge(connection.source!, connection.target!)
    if (result.ok) {
      setRfEdges((eds) => [
        ...eds,
        {
          id: result.edgeId,
          source: connection.source!,
          target: connection.target!,
          type: 'default',
        },
      ])
    }
  }, [setRfEdges])

  /* ── 拖拽结束：提交位置到 store + 历史 ── */
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

  /* ── 操作回调 ── */
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

      // 同步压入 store 历史栈（用于撤销）
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
    },
    [setRfNodes],
  )

  /* ── Context menu handlers ── */
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

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const storeNodes = canvasStore.getState().nodes
      const source = storeNodes.find((n) => n.id === nodeId)
      if (!source) return
      const id = `node-${crypto.randomUUID()}`
      const position = {
        x: source.position.x + 40,
        y: source.position.y + 40,
      }
      const newNode: Node = {
        id,
        type: source.type,
        position,
        data: structuredClone(source.data) as unknown as Record<string, unknown>,
      }
      setRfNodes((nds) => [...nds, newNode])
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
            { ...structuredClone(source), id, position } as typeof prev.nodes[number],
          ],
        }
      })
      setContextMenu(null)
    },
    [setRfNodes],
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setRfNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setRfEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      )
      canvasStore.setState((prev) => {
        const snapshot = {
          nodes: prev.nodes,
          edges: prev.edges,
          viewport: prev.viewport,
        }
        return {
          past: [...prev.past, structuredClone(snapshot)].slice(-50),
          future: [],
          nodes: prev.nodes.filter((n) => n.id !== nodeId),
          edges: prev.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId,
          ),
        }
      })
      setContextMenu(null)
    },
    [setRfNodes, setRfEdges],
  )

  const handleRunAll = useCallback(() => {
    // 预留：未来触发全节点运行
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base">
      {/* ── 顶栏 ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary bg-bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
            aria-label="返回设置"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-semibold text-text-base">{workflowName}</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={pastLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition hover:bg-bg-hover hover:text-text-base disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="撤销"
          >
            <Undo2 className="h-3.5 w-3.5" />
            撤销
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={futureLen === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition hover:bg-bg-hover hover:text-text-base disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="重做"
          >
            <Redo2 className="h-3.5 w-3.5" />
            重做
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
            aria-label="保存"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                保存中...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">已保存</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <Save className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-400">保存失败</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                保存
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleRunAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
            aria-label="运行全部"
          >
            <Play className="h-3.5 w-3.5" />
            运行全部
          </button>
        </div>
      </header>

      {/* ── 画布区域 ── */}
      <div className="relative flex-1">
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

        {/* ── 右键菜单 ── */}
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
              className="fixed z-50 w-[180px] rounded-xl border border-border-secondary bg-bg-panel p-1.5 shadow-[0_15px_45px_rgba(0,0,0,0.12)]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.type === 'pane' ? (
                <>
                  <p className="px-3 py-1.5 text-[11px] font-bold uppercase text-text-muted select-none">
                    添加节点
                  </p>
                  {CONTEXT_MENU_NODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => handleAddNodeAtContextMenu(opt.type)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg-hover"
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
                    onClick={() => handleCopyNode(contextMenu.nodeId!)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                  >
                    <Copy className="h-4 w-4 text-text-secondary group-hover:text-brand" />
                    <span className="text-[13px] font-medium text-text-base">
                      复制节点
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteNode(contextMenu.nodeId!)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                  >
                    <Trash2 className="h-4 w-4 text-text-secondary group-hover:text-red-400" />
                    <span className="text-[13px] font-medium text-text-base">
                      删除节点
                    </span>
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── 左侧浮动添加节点工具栏 ── */}
        <aside className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          <button
            type="button"
            onClick={() => handleAddNode('text')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-secondary bg-bg-card text-text-secondary shadow-card transition hover:border-border-primary hover:text-text-base hover:shadow-active"
            aria-label="添加文本节点"
            title="添加文本"
          >
            <Type className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('image')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-secondary bg-bg-card text-text-secondary shadow-card transition hover:border-border-primary hover:text-text-base hover:shadow-active"
            aria-label="添加图片节点"
            title="添加图片"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('imageConfigV2')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-secondary bg-bg-card text-text-secondary shadow-card transition hover:border-border-primary hover:text-text-base hover:shadow-active"
            aria-label="添加生图 V2 节点"
            title="生图 V2"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('video')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-secondary bg-bg-card text-text-secondary shadow-card transition hover:border-border-primary hover:text-text-base hover:shadow-active"
            aria-label="添加视频节点"
            title="添加视频"
          >
            <Video className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('videoConfigV2')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-secondary bg-bg-card text-text-secondary shadow-card transition hover:border-border-primary hover:text-text-base hover:shadow-active"
            aria-label="添加生视频 V2 节点"
            title="生视频 V2"
          >
            <Video className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  )
}

/* ─── CanvasPage（带 ReactFlowProvider） ─── */

export default function CanvasPage(): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasPageInner />
    </ReactFlowProvider>
  )
}
