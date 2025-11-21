/**
 * @beztack/state
 *
 * Centralized state management package.
 * Currently exports nuqs for URL search params state management.
 *
 * @see https://nuqs.dev/docs
 */

// Types
export type {
  inferParserType,
  Options,
  Parser,
  ParserBuilder,
  UseQueryStateOptions,
  UseQueryStatesOptions,
} from "nuqs";
// Core hooks
export {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsHex,
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
  parseAsTimestamp,
  useQueryState,
  useQueryStates,
} from "nuqs";
export type { SearchParams } from "nuqs/server";
// Server-side
export {
  createSearchParamsCache,
  parseAsArrayOf as serverParseAsArrayOf,
  parseAsBoolean as serverParseAsBoolean,
  parseAsFloat as serverParseAsFloat,
  parseAsHex as serverParseAsHex,
  parseAsInteger as serverParseAsInteger,
  parseAsIsoDateTime as serverParseAsIsoDateTime,
  parseAsJson as serverParseAsJson,
  parseAsNumberLiteral as serverParseAsNumberLiteral,
  parseAsString as serverParseAsString,
  parseAsStringEnum as serverParseAsStringEnum,
  parseAsStringLiteral as serverParseAsStringLiteral,
  parseAsTimestamp as serverParseAsTimestamp,
} from "nuqs/server";
