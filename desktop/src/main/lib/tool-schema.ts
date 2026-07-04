/**
 * Zod → JSON Schema helpers for ToolRuntime descriptors and model prompts.
 * @see docs/api-contracts/tools-plugins.md
 */

import type { z } from 'zod'

import type { ToolDescriptor } from '../../../../shared/tools'

/** JSON Schema object shape returned by Zod 4 `toJSONSchema()`. */
export type ToolInputJsonSchema = Record<string, unknown>

interface ZodJsonSchemaConvertible {
  toJSONSchema(): ToolInputJsonSchema
}

function isZodJsonSchemaConvertible(schema: z.ZodType): schema is z.ZodType & ZodJsonSchemaConvertible {
  return typeof (schema as ZodJsonSchemaConvertible).toJSONSchema === 'function'
}

/**
 * Converts a tool input Zod schema into a JSON Schema document for prompts and IPC.
 * @param schema - Tool input schema defined at registration time.
 * @returns JSON Schema draft 2020-12 compatible object.
 * @throws Error when the installed Zod build does not expose `toJSONSchema`.
 * @see docs/api-contracts/tools-plugins.md
 */
export function zodInputSchemaToJson(schema: z.ZodType): ToolInputJsonSchema {
  if (!isZodJsonSchemaConvertible(schema)) {
    // Zod 4 is required for schema export; fail fast instead of returning an empty object.
    throw new Error('tool_schema_export_unsupported')
  }

  return schema.toJSONSchema()
}

/**
 * Attaches an exported JSON Schema snapshot to a tool descriptor clone.
 * @param descriptor - Base descriptor without schema payload.
 * @param inputSchema - Registered Zod input schema.
 * @returns Descriptor enriched with `inputParametersJsonSchema`.
 * @see docs/api-contracts/tools-plugins.md
 */
export function enrichToolDescriptorWithInputSchema(
  descriptor: ToolDescriptor,
  inputSchema: z.ZodType
): ToolDescriptor {
  return {
    ...descriptor,
    inputParametersJsonSchema: zodInputSchemaToJson(inputSchema)
  }
}
