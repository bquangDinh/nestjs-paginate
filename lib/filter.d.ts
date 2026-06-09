import { EntityMetadata, FindOperator, SelectQueryBuilder } from 'typeorm';
import { PaginateQuery } from './decorator';
import { JoinMethod } from './helper';
type EmbeddedMetadata = EntityMetadata['embeddeds'][number];
type RelationMetadata = EntityMetadata['relations'][number];
type WherePredicateOperator = {
    operator: string;
    parameters: any[];
    condition?: any;
};
export declare enum FilterOperator {
    EQ = "$eq",
    GT = "$gt",
    GTE = "$gte",
    IN = "$in",
    NULL = "$null",
    LT = "$lt",
    LTE = "$lte",
    BTW = "$btw",
    ILIKE = "$ilike",
    SW = "$sw",
    CONTAINS = "$contains"
}
export declare function isOperator(value: unknown): value is FilterOperator;
export declare enum FilterSuffix {
    NOT = "$not"
}
export declare function isSuffix(value: unknown): value is FilterSuffix;
export declare enum FilterQuantifier {
    ALL = "$all",
    ANY = "$any",
    NONE = "$none"
}
export declare function isQuantifier(value: unknown): value is FilterQuantifier;
export declare enum FilterComparator {
    AND = "$and",
    OR = "$or"
}
export declare function isComparator(value: unknown): value is FilterComparator;
/**
 * Returns true when the raw filter string explicitly carries the `$and` comparator token.
 *
 * This is distinct from the default AND comparator that every token carries implicitly —
 * we only want to enter AND-mode when the user deliberately wrote `$and:` in the filter value.
 * Using `parseFilterToken` (rather than a naive substring split) ensures that `$and` embedded
 * inside a user value (e.g. `$eq:$and`) is not misidentified as the comparator.
 *
 * Must be called after `parseFilterToken` is defined (hoisting applies to function declarations).
 */
export declare function hasExplicitAndComparator(raw: string): boolean;
export declare const OperatorSymbolToFunction: Map<FilterOperator | FilterSuffix, (...args: any[]) => FindOperator<string>>;
type Filter = {
    quantifier: FilterQuantifier;
    comparator: FilterComparator;
    findOperator: FindOperator<string>;
};
type ColumnFilters = {
    [columnName: string]: Filter[];
};
type ColumnJoinMethods = {
    [columnName: string]: JoinMethod;
};
/**
 * Matches TypeORM named parameters (`:name` and `:...name` spread form) while skipping
 * PostgreSQL cast syntax (`::type`).
 *
 * TypeORM parameter names may contain letters, digits, underscores, and dots (the latter
 * for embedded-property paths, e.g. `size.height0`). The pattern captures the full name
 * including any embedded-path dots.
 *
 * Capture groups:
 *   1 — optional `...` spread prefix (present for IN parameters)
 *   2 — parameter name (may contain dots for embedded paths)
 *
 * Examples:
 *   `:name`          → matches, spread=undefined, name='name'
 *   `:...vals`       → matches, spread='...', name='vals'
 *   `:size.height0`  → matches, spread=undefined, name='size.height0'
 *   `col::text`      → no match (lookbehind rejects `::`)
 *   `:param::int`    → matches `:param`, skips `::int`
 */
/** @internal Exported for testing only. */
export declare const TYPEORM_PARAM_REGEX: RegExp;
export interface FilterToken {
    quantifier: FilterQuantifier;
    comparator: FilterComparator;
    suffix?: FilterSuffix;
    operator: FilterOperator;
    value: string;
}
export declare function fixQueryParam(alias: string, column: string, filter: Filter, condition: WherePredicateOperator, parameters: {
    [key: string]: string;
}): {
    [key: string]: string;
};
export declare function generatePredicateCondition(qb: SelectQueryBuilder<unknown>, column: string, filter: Filter, alias: string, isVirtualProperty?: boolean): WherePredicateOperator;
export declare function addWhereCondition<T>(qb: SelectQueryBuilder<T>, column: string, filter: ColumnFilters): void;
export declare function parseFilterToken(raw?: string): FilterToken | null;
export declare function parseFilter<T>(query: PaginateQuery, filterableColumns?: {
    [column: string]: (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[] | true;
}, qb?: SelectQueryBuilder<T>, throwOnInvalidFilter?: boolean): ColumnFilters;
/**
 * Retrieves the relation path for a given column name within the provided metadata.
 *
 * This method analyzes the column name's segments to identify corresponding relations or embedded entities
 * within the hierarchy described by the given metadata and returns a structured path.
 *
 * @param {string} columnName - The dot-delimited name of the column whose relation path is to be determined.
 * @param {EntityMetadata | EmbeddedMetadata} metadata - The metadata of the entity or embedded component
 * which holds the relations or embedded items.
 * @return {[string, RelationMetadata | EmbeddedMetadata][]} The ordered array describing the path,
 * where each element contains a field name and its corresponding relation or embedded metadata.
 * Throws an error if no matching relation or embedded metadata is found.
 */
export declare function getRelationPath(columnName: string, metadata: EntityMetadata | EmbeddedMetadata): [string, RelationMetadata | EmbeddedMetadata][];
export interface AddFilterOptions {
    /**
     * Maximum number of `$and` values allowed per sub-column in a single to-many filter.
     * Each value produces a separate correlated EXISTS subquery, so large values have a
     * linear performance cost. Defaults to 20.
     */
    maxAndValues?: number;
    /**
     * When false, skips the validation that rejects `$and` on non-to-many columns.
     * Set to false when calling `addFilter` recursively for EXISTS sub-queries, where the
     * entity metadata is the leaf entity and the to-many check would incorrectly throw.
     * @internal
     */
    validateAndComparator?: boolean;
}
export declare function addFilter<T>(qb: SelectQueryBuilder<T>, query: PaginateQuery, filterableColumns?: {
    [column: string]: (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[] | true;
}, opts?: AddFilterOptions, throwOnInvalidFilter?: boolean): ColumnJoinMethods;
export declare function addDirectFilters<T>(qb: SelectQueryBuilder<T>, filter: ColumnFilters): void;
/**
 * Adds correlated EXISTS subqueries to `qb` for all to-many relationship filters in `filter`.
 *
 * **AND-mode (`$and` comparator)**
 *
 * When a sub-column filter uses the `$and` comparator (e.g. `filter[toys.name]=$and:Ball`),
 * each distinct `$and` value produces a separate correlated EXISTS subquery, ANDed on the
 * outer query. This is the only correct way to express "entity has ALL of these related values"
 * — a single EXISTS with AND conditions on the same column is always false on a single row.
 *
 * **Performance note**: each `$and` value adds one correlated EXISTS with the full join chain
 * for that relation path. For a relation path of depth D and N `$and` values, this produces
 * N × D joins. The `maxAndValues` option (default 20) caps N to limit query complexity.
 *
 * **Restrictions**:
 * - `$and` may only be used on to-many relationship columns.
 * - `$and` values may not be mixed with non-`$and` values on the same sub-column.
 * - `$and` may not be combined with `$none` or `$all` quantifiers.
 * - `$and` may only be applied to a single sub-column per relation path at a time.
 */
export declare function addToManySubFilters<T>(qb: SelectQueryBuilder<T>, filter: ColumnFilters, query: PaginateQuery, filterableColumns?: {
    [column: string]: (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[] | true;
}, { maxAndValues, validateAndComparator }?: AddFilterOptions): void;
export declare function createSubFilter(query: PaginateQuery, filterableColumns: {
    [column: string]: (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[] | true;
}, column: string): {
    subQuery: PaginateQuery;
    subFilterableColumns: {
        [column: string]: true | (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[];
    };
};
export {};
