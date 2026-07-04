import type { AssetReferenceCreateRecord } from '../db/repositories/asset.repo'
import type { CanvasGraphSnapshot } from '../../../../shared/graph'
import type { JobRecord, JobResult } from '../../../../shared/jobs'
import type { AssetReference } from '../../../../shared/assets'
import type { ReferenceAsset } from '../../../../shared/nodes'

export interface AssetReferenceWriter {
  addReference(record: AssetReferenceCreateRecord): void
}

export interface SyncCanvasAssetReferencesRequest {
  assets: AssetReferenceWriter
  graph: CanvasGraphSnapshot
  jobs?: JobRecord[]
  clock?: () => number
  idFactory?: (index: number) => string
}

export interface SyncCanvasAssetReferencesReport {
  inserted: number
  skipped: number
}

interface PendingReference {
  assetId: string
  refType: AssetReference['refType']
  refId: string
}

function readAssetId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readReferenceAssets(value: unknown): ReferenceAsset[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ReferenceAsset => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Partial<ReferenceAsset>
    return typeof candidate.id === 'string' && typeof candidate.url === 'string' && candidate.type === 'image'
  })
}

function collectGraphReferences(graph: CanvasGraphSnapshot): PendingReference[] {
  const references: PendingReference[] = []
  for (const node of graph.nodes) {
    const data = node.data as unknown as Record<string, unknown>
    const assetId = readAssetId(data.assetId)
    if (assetId) {
      references.push({ assetId, refType: 'node', refId: node.id })
    }

    for (const referenceAsset of readReferenceAssets(data.referenceAssets)) {
      references.push({ assetId: referenceAsset.id, refType: 'node', refId: node.id })
    }
  }
  return references
}

function assetIdFromJobResult(result: JobResult | undefined): string | null {
  if (!result) return null
  if (result.kind === 'asset') return result.assetId
  if (result.kind === 'report') {
    return readAssetId(result.data?.assetId)
  }
  return null
}

function collectJobReferences(jobs: JobRecord[]): PendingReference[] {
  return jobs.flatMap((job) => {
    if (job.status !== 'completed') return []
    const assetId = assetIdFromJobResult(job.result)
    return assetId ? [{ assetId, refType: 'job' as const, refId: job.id }] : []
  })
}

/**
 * Syncs asset references from canvas graph nodes and completed jobs into SQLite.
 * @param request - Asset repository boundary, graph snapshot, optional jobs, clock, and deterministic ID factory.
 * @returns Number of inserted and skipped duplicate references from this sync call.
 * @see docs/api-contracts/assets-files.md
 */
export function syncCanvasAssetReferences(request: SyncCanvasAssetReferencesRequest): SyncCanvasAssetReferencesReport {
  const clock = request.clock ?? Date.now
  const idFactory = request.idFactory ?? ((index: number) => `asset-ref-${clock()}-${index}`)
  const pending = [
    ...collectGraphReferences(request.graph),
    ...collectJobReferences(request.jobs ?? [])
  ]
  const seen = new Set<string>()
  let inserted = 0
  let skipped = 0

  for (const reference of pending) {
    const key = `${reference.assetId}:${reference.refType}:${reference.refId}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    request.assets.addReference({
      id: idFactory(inserted),
      assetId: reference.assetId,
      refType: reference.refType,
      refId: reference.refId,
      createdAt: clock()
    })
    inserted++
  }

  return { inserted, skipped }
}
