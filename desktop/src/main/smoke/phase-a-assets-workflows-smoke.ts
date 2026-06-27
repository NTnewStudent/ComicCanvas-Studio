/**
 * Phase A smoke path for assets/workflows parity.
 * @see specs/hjwall-assets-workflows-100-migration/tasks.md
 * @see docs/progress/human-desktop-review-checklist.md
 */

import { createAssetPipeline } from '../assets/pipeline'
import { syncCanvasAssetReferences } from '../assets/asset-reference-sync'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../db/migrate'
import { createAssetRepository } from '../db/repositories/asset.repo'
import { createCanvasSnippetRepository } from '../db/repositories/canvas-snippet.repo'
import { createJobRepository } from '../db/repositories/job.repo'
import { createWorkflowRepository } from '../db/repositories/workflow.repo'
import { createJobEventBus } from '../jobs/events'
import { createJobQueue } from '../jobs/queue'
import { createJobWorker } from '../jobs/worker'
import { createGatewayRegistry } from '../providers/registry'
import { createStubProvider } from '../providers/stub.provider'
import { createCanvasStore } from '../../renderer/src/canvas/store/canvas.store'
import { extractCanvasSnippet, insertCanvasSnippet } from '../../renderer/src/canvas/lib/canvas-snippet'
import { runImageNodeSmokePath } from './m1-smoke'
import type { CanvasGraphSnapshot } from '../../../../shared/graph'

export interface PhaseAAssetsWorkflowsSmokeOptions {
  dbPath: string
  assetRoot: string
}

export interface PhaseAAssetsWorkflowsSmokeResult {
  workflow: {
    projectId: string
    graphVersion: string
    savedNodeCount: number
    savedEdgeCount: number
    reopenedNodeCount: number
    reopenedEdgeCount: number
  }
  asset: {
    importedAssetId: string
    categoryId: string
    insertedNodeId: string
    safeDeleteStatus: string
    blockingReferenceIds: string[]
  }
  snippet: {
    snippetId: string
    insertedNodeCount: number
    insertedEdgeCount: number
  }
  run: {
    jobId: string
    status: string
    assetId: string
    terminalEventChannel: string
  }
}

function graphFromStore(store: ReturnType<typeof createCanvasStore>): CanvasGraphSnapshot {
  const state = store.getState()
  return {
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport
  }
}

/**
 * Runs the Phase A assets/workflows smoke path against local repositories.
 * @param options - Temporary database path and asset root to use for the smoke run.
 * @returns A compact evidence summary for tests and progress reports.
 * @throws Error when persistence, reference sync, snippet, or stub generation fails.
 */
export async function runPhaseAAssetsWorkflowsSmoke(
  options: PhaseAAssetsWorkflowsSmokeOptions
): Promise<PhaseAAssetsWorkflowsSmokeResult> {
  migrateDatabaseAtPath(options.dbPath)
  const db = openDatabaseAtPath(options.dbPath)

  try {
    const workflows = createWorkflowRepository(db)
    const assets = createAssetRepository(db)
    const snippets = createCanvasSnippetRepository(db)
    const jobs = createJobRepository(db)
    const events = createJobEventBus()
    const queue = createJobQueue({
      jobs,
      idFactory: () => 'job-phase-a-1',
      clock: () => 1_785_000_000_000
    })
    const pipeline = createAssetPipeline({
      assetRoot: options.assetRoot,
      assets,
      idFactory: () => 'asset-generated-1',
      clock: () => 1_785_000_000_010
    })
    const gateways = createGatewayRegistry()
    gateways.set('stub-main', createStubProvider())
    const worker = createJobWorker({
      jobs,
      events,
      leaseOwner: 'phase-a-smoke-worker',
      clock: () => 1_785_000_000_020,
      handlers: {
        'canvas.generateImage': async (job) =>
          runImageNodeSmokePath({
            job,
            gateways,
            assets: pipeline,
            gatewayId: 'stub-main'
          })
      }
    })

    const projectId = 'phase-a-smoke-project'
    workflows.create({
      id: projectId,
      name: 'Phase A Smoke Project',
      createdAt: 1_785_000_000_000,
      updatedAt: 1_785_000_000_000
    })

    assets.ensureStarterCategories(1_785_000_000_001)
    assets.create({
      id: 'asset-imported-1',
      displayName: 'Smoke角色',
      mediaType: 'image',
      status: 'ready',
      relativePath: 'imported/image/smoke-role.png',
      safeUrl: 'cc-asset://asset/asset-imported-1',
      metadata: {
        width: 768,
        height: 768,
        orientation: 'square',
        mimeType: 'image/png'
      },
      categoryIds: ['category-role'],
      tags: ['phase-a-smoke'],
      createdAt: 1_785_000_000_002,
      updatedAt: 1_785_000_000_002
    })

    const store = createCanvasStore({
      idFactory: (() => {
        const ids = ['node-text-1', 'node-image-1', 'node-snippet-text-1', 'node-snippet-image-1']
        let index = 0
        return () => ids[index++] ?? `node-extra-${index}`
      })(),
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 1_785_000_000_003
    })
    const textNodeId = store.getState().addNode('text', { x: 0, y: 0 }, { label: 'Smoke Prompt', content: '雨夜角色海报' })
    const imageNodeId = store.getState().addNode('image', { x: 320, y: 0 }, {
      label: 'Smoke Image',
      promptOverride: '雨夜角色海报',
      modelId: 'stub-image',
      assetId: 'asset-imported-1',
      url: 'cc-asset://asset/asset-imported-1',
      status: 'done'
    })
    const connect = store.getState().addEdge(textNodeId, imageNodeId)
    if (!connect.ok) {
      throw new Error(`phase_a_smoke_connect_failed:${connect.reason}`)
    }

    const savedGraph = graphFromStore(store)
    const graphVersion = 'phase-a-smoke-version-1'
    workflows.addVersion({
      id: graphVersion,
      workflowId: projectId,
      graph: savedGraph,
      createdAt: 1_785_000_000_004,
      createdBy: 'phase-a-smoke'
    })
    syncCanvasAssetReferences({
      assets,
      graph: savedGraph,
      clock: () => 1_785_000_000_005,
      idFactory: (index) => `asset-ref-phase-a-${index}`
    })
    const reopenedGraph = workflows.getLatestVersion(projectId)?.graph
    if (!reopenedGraph) {
      throw new Error('phase_a_smoke_reopen_failed')
    }

    const safeDelete = assets.trashAsset({
      assetId: 'asset-imported-1',
      mode: 'safe'
    }, 1_785_000_000_006)

    const snippet = extractCanvasSnippet({
      name: 'Phase A Smoke Snippet',
      graph: store.getState(),
      selectedNodeIds: [textNodeId, imageNodeId],
      createdAt: 1_785_000_000_007
    })
    const savedSnippet = snippets.save({
      id: 'snippet-phase-a',
      name: snippet.name,
      nodes: snippet.nodes,
      edges: snippet.edges
    }, 1_785_000_000_008)
    const inserted = insertCanvasSnippet(snippet, store, {
      origin: { x: 720, y: 240 },
      nodeIdFactory: (_node, index) => `snippet-node-${index + 1}`,
      edgeIdFactory: (_edge, index) => `snippet-edge-${index + 1}`
    })

    const ticket = queue.enqueue({
      type: 'canvas.generateImage',
      targetId: imageNodeId,
      payload: {
        prompt: '雨夜角色海报',
        modelKey: 'stub-image',
        parameters: { orientation: 'landscape' }
      },
      requestedBy: { type: 'user', id: 'phase-a-smoke' }
    })
    await worker.runNext()
    const completedJob = jobs.getById(ticket.jobId)
    if (!completedJob || completedJob.status !== 'completed' || completedJob.result?.kind !== 'asset') {
      throw new Error('phase_a_smoke_job_failed')
    }
    const terminalEvent = events.getTerminalEvents().find((event) => event.jobId === ticket.jobId)
    if (!terminalEvent) {
      throw new Error('phase_a_smoke_terminal_event_missing')
    }

    return {
      workflow: {
        projectId,
        graphVersion,
        savedNodeCount: savedGraph.nodes.length,
        savedEdgeCount: savedGraph.edges.length,
        reopenedNodeCount: reopenedGraph.nodes.length,
        reopenedEdgeCount: reopenedGraph.edges.length
      },
      asset: {
        importedAssetId: 'asset-imported-1',
        categoryId: 'category-role',
        insertedNodeId: imageNodeId,
        safeDeleteStatus: safeDelete.status,
        blockingReferenceIds: safeDelete.blockingReferences.map((reference) => reference.refId)
      },
      snippet: {
        snippetId: savedSnippet.id,
        insertedNodeCount: inserted.nodeIds.length,
        insertedEdgeCount: inserted.edgeIds.length
      },
      run: {
        jobId: ticket.jobId,
        status: completedJob.status,
        assetId: completedJob.result.assetId,
        terminalEventChannel: terminalEvent.channel
      }
    }
  } finally {
    db.close()
  }
}
