import type { paths } from "./api-types.js";

/**
 * Canonical locale file format identifiers, derived directly from the generated
 * OpenAPI types so this list can never drift from the production contract. If
 * the API adds or renames a format, regenerating `api-types.ts` makes the
 * `satisfies` check below fail until `FILE_FORMATS` is updated to match.
 */
export type FileFormat = NonNullable<
  paths["/api/repositories/{id}/patterns"]["post"]["requestBody"]
>["content"]["application/json"]["fileFormat"];

export const FILE_FORMATS = [
  "json-flat",
  "json-nested",
  "xliff-1",
  "xliff-2",
  "po",
  "arb",
  "yaml-rails",
  "xcstrings",
  "android-strings",
] as const satisfies readonly FileFormat[];

// Compile-time drift guard. `satisfies` above rejects an INVALID entry; this
// rejects a MISSING one. If the API schema adds a new format, `FILE_FORMATS` no
// longer covers `FileFormat`, the conditional resolves to `never`, and this
// assignment fails to type-check — forcing the list above to be updated.
const _allFormatsListed: [Exclude<FileFormat, (typeof FILE_FORMATS)[number]>] extends [never] ? true : never = true;
void _allFormatsListed;
