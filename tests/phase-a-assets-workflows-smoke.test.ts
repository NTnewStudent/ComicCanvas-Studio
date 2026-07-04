import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { runPhaseAAssetsWorkflowsSmoke } from '../desktop/src/main/smoke/phase-a-assets-workflows-smoke'

describe('Phase A assets/workflows smoke path', () => {
  it('creates a project, saves and reloads canvas graph, inserts assets and snippets, blocks safe delete, and completes a stub run', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-phase-a-smoke-'))

    try {
      const result = await runPhaseAAssetsWorkflowsSmoke({
        dbPath: join(tempDir, 'phase-a-smoke.sqlite'),
        assetRoot: join(tempDir, 'assets')
      })

      expect(result.workflow).toMatchObject({
        projectId: 'phase-a-smoke-project',
        savedNodeCount: 2,
        savedEdgeCount: 1,
        reopenedNodeCount: 2,
        reopenedEdgeCount: 1
      })
      expect(result.asset).toMatchObject({
        importedAssetId: 'asset-imported-1',
        categoryId: 'category-role',
        insertedNodeId: 'node-image-1',
        safeDeleteStatus: 'rejected'
      })
      expect(result.asset.blockingReferenceIds).toContain('node-image-1')
      expect(result.snippet).toMatchObject({
        snippetId: 'snippet-phase-a',
        insertedNodeCount: 2,
        insertedEdgeCount: 1
      })
      expect(result.run).toMatchObject({
        jobId: 'job-phase-a-1',
        status: 'completed',
        assetId: 'asset-generated-1',
        terminalEventChannel: 'job.completed'
      })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
