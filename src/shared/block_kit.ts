/**
 * Block Kit payloads (blocks, elements, views) are plain JSON objects and
 * the Deno Slack SDK ships no types for building them - see the untyped
 * block builders in src/gym/functions/who_is_there/blocks.ts.
 *
 * This alias keeps that one escape hatch in a single place instead of a
 * lint-ignore comment on every builder function.
 */
// deno-lint-ignore no-explicit-any
export type BlockKitObject = any;
