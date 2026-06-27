import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconPlayerPlay, IconRefresh, IconX } from '@tabler/icons-react'

import type { JobListFilter, JobRecord, JobTerminalEvent } from '../../../../../../shared/jobs'

export interface CanvasJobPanelApi {
  listJobs(input?: JobListFilter): Promise<JobRecord[]>
  runNode?(nodeId: string): Promise<unknown>
  onJobCompleted(handler: (event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void): () => void
  onJobFailed(handler: (event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void): () => void
}

export interface CanvasJobPanelProps {
  api?: CanvasJobPanelApi
  onClose?: () => void
}

function getDefaultApi(): CanvasJobPanelApi {
  return window.comicCanvas
}

const statusLabels: Record<JobRecord['status'], string> = {
  pending: '排队中',
  processing: '运行中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
}

const statusClasses: Record<JobRecord['status'], string> = {
  pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  processing: 'border-brand/30 bg-brand/10 text-brand',
  completed: 'border-green-500/30 bg-green-500/10 text-green-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  canceled: 'border-border-secondary bg-bg-hover text-text-muted',
}

function formatJobType(type: JobRecord['type']): string {
  if (type === 'canvas.generateImage') return '图片生成'
  if (type === 'canvas.generateVideo') return '视频生成'
  if (type === 'canvas.polishText') return '文本润色'
  if (type === 'canvas.generateAudio') return '音频生成'
  if (type === 'canvas.composeVideo') return '视频合成'
  if (type === 'canvas.upscaleVideo') return '视频超分'
  if (type === 'canvas.muxAudioVideo') return '音视频合成'
  if (type === 'agent.run') return 'Agent 编排'
  if (type === 'gateway.test') return '网关测试'
  if (type === 'knowledge.ingest') return '知识导入'
  if (type === 'knowledge.rebuild') return '知识重建'
  if (type === 'plugin.reload') return '插件重载'
  if (type === 'skill.reload') return 'Skill 重载'
  return type
}

function formatOutput(result: JobRecord['result']): { label: string; value: string } | null {
  if (!result) return null
  if (result.kind === 'text') return { label: '输出类型：文本', value: result.text }
  if (result.kind === 'asset') return { label: '输出类型：资产', value: result.assetId }
  if (result.kind === 'agentRun') return { label: '输出类型：Agent', value: result.runId }
  return { label: '输出类型：报告', value: result.summary }
}

function statusSummary(jobs: JobRecord[], status: JobRecord['status']): string {
  const count = jobs.filter((job) => job.status === status).length
  return `${count} 个${statusLabels[status]}`
}

export function CanvasJobPanel({ api = getDefaultApi(), onClose }: CanvasJobPanelProps): JSX.Element {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filter = useMemo<JobListFilter>(() => ({ limit: 8 }), [])
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const selectedOutput = selectedJob ? formatOutput(selectedJob.result) : null

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setJobs(await api.listJobs(filter))
    } catch {
      setError('运行任务加载失败')
    } finally {
      setLoading(false)
    }
  }, [api, filter])

  const rerunSelectedJob = useCallback(async () => {
    if (!selectedJob?.targetId || !api.runNode) return
    await api.runNode(selectedJob.targetId)
    await loadJobs()
  }, [api, loadJobs, selectedJob])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    const refresh = () => {
      void loadJobs()
    }
    const unsubscribeCompleted = api.onJobCompleted(refresh)
    const unsubscribeFailed = api.onJobFailed(refresh)

    return () => {
      unsubscribeCompleted()
      unsubscribeFailed()
    }
  }, [api, loadJobs])

  return (
    <section
      aria-label="运行任务"
      className="absolute right-4 top-4 z-30 flex max-h-[min(560px,calc(100vh-96px))] w-[360px] flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-panel shadow-pop"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary px-3">
        <div>
          <h2 className="text-[14px] font-bold text-text-base">{selectedJob ? '运行详情' : '运行任务'}</h2>
          <p className="text-[11px] text-text-muted">
            {selectedJob ? selectedJob.id : '最近 8 个本地任务'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {selectedJob && (
            <button
              type="button"
              onClick={() => setSelectedJobId(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
              aria-label="返回运行列表"
              title="返回运行列表"
            >
              <IconArrowLeft className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
            aria-label="刷新运行任务"
            title="刷新运行任务"
          >
            <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95"
              aria-label="关闭运行任务"
              title="关闭运行任务"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {error}
          </div>
        )}
        {!error && jobs.length === 0 && (
          <div className="rounded-lg border border-border-secondary bg-bg-card px-3 py-6 text-center text-[12px] text-text-muted">
            暂无运行任务
          </div>
        )}
        {!error && selectedJob && (
          <article className="space-y-3 rounded-lg border border-border-secondary bg-bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text-base">{formatJobType(selectedJob.type)}</p>
                <p className="mt-1 break-all text-[11px] text-text-muted">{selectedJob.targetId ?? '未绑定节点'}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses[selectedJob.status]}`}>
                {statusLabels[selectedJob.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
              <span>进度：{selectedJob.progress}%</span>
              <span>更新时间：{selectedJob.updatedAt}</span>
            </div>
            {selectedOutput && (
              <div className="rounded-md border border-border-secondary bg-bg-input px-2 py-2 text-[12px] text-text-secondary">
                <p className="font-semibold text-text-base">{selectedOutput.label}</p>
                <p className="mt-1 break-words">{selectedOutput.value}</p>
              </div>
            )}
            {selectedJob.error?.message && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-2 text-[12px] text-red-300">
                <p>错误类型：{selectedJob.error.errorClass}</p>
                <p className="mt-1">{selectedJob.error.message}</p>
              </div>
            )}
            {selectedJob.targetId && api.runNode && (
              <button
                type="button"
                onClick={() => void rerunSelectedJob()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary bg-bg-input px-3 text-[12px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:border-border-primary hover:text-text-base active:scale-95"
                aria-label={`重新运行 ${selectedJob.targetId}`}
              >
                <IconPlayerPlay className="h-3.5 w-3.5" />
                重新运行
              </button>
            )}
          </article>
        )}
        {!error && !selectedJob && jobs.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1 text-[11px] text-text-muted">
              <span>{statusSummary(jobs, 'completed')}</span>
              <span>{statusSummary(jobs, 'failed')}</span>
              <span>{statusSummary(jobs, 'canceled')}</span>
            </div>
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                aria-label={`查看运行详情 ${job.id}`}
                onClick={() => setSelectedJobId(job.id)}
                className="block w-full rounded-lg border border-border-secondary bg-bg-card px-3 py-2 text-left transition-all duration-200 ease-luxury hover:border-border-primary hover:bg-bg-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-text-base">{job.id}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">{formatJobType(job.type)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses[job.status]}`}>
                    {statusLabels[job.status]}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-text-muted">
                  <span className="truncate">{job.targetId ?? '未绑定节点'}</span>
                  <span>{job.progress}%</span>
                </div>
                {job.error?.message && (
                  <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                    {job.error.message}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
