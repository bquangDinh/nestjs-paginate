import { EntityMetadata, FindOperator, FindOptionsRelations, Repository, SelectQueryBuilder } from 'typeorm';
type ColumnMetadata = EntityMetadata['columns'][number];
/**
 * Joins 2 keys as `K`, `K.P`, `K.(P` or `K.P)`
 * The parenthesis notation is included for embedded columns
 */
type Join<K, P> = K extends string ? P extends string ? `${K}${'' extends P ? '' : '.'}${P | `(${P}` | `${P})`}` : never : never;
/**
 * Get the previous number between 0 and 10. Examples:
 *   Prev[3] = 2
 *   Prev[0] = never.
 *   Prev[20] = 0
 */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...0[]];
/**
 * Unwrap Promise<T> to T
 */
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;
/**
 * Unwrap Array<T> to T
 */
type UnwrapArray<T> = T extends Array<infer U> ? UnwrapArray<U> : T;
/**
 * Find all the dotted path properties for a given column.
 *
 * T: The column
 * D: max depth
 */
export type Column<T, D extends number = 2> = [D] extends [never] ? never : T extends Record<string, any> ? {
    [K in keyof T]-?: K extends string ? T[K] extends string | number ? `${K}` : T[K] extends Date ? `${K}` : T[K] extends Array<infer U> ? // yes, unwrap it, and recurse deeper
    `${K}` | Join<K, Column<UnwrapArray<U>, Prev[D]>> : T[K] extends Promise<infer U> ? U extends Array<infer V> ? `${K}` | Join<K, Column<UnwrapArray<V>, Prev[D]>> : `${K}` | Join<K, Column<UnwrapPromise<U>, Prev[D]>> : // no, we have no more special cases, so treat it as an
    `${K}` | Join<K, Column<T[K], Prev[D]>> : never;
}[keyof T] : '';
export type RelationColumn<T> = Extract<Column<T>, {
    [K in Column<T>]: K extends `${infer R}.${string}` ? R : never;
}[Column<T>]>;
export type Order<T> = [Column<T> | Column<T>[], 'ASC' | 'DESC'];
export type SortBy<T> = Order<T>[];
export type MappedColumns<T, S> = {
    [key in Column<T> | (string & {})]: S;
};
export type JoinMethod = 'leftJoinAndSelect' | 'innerJoinAndSelect';
export type RelationSchemaInput<T = any> = FindOptionsRelations<T> | RelationColumn<T>[];
export type RelationSchema<T = any> = {
    [relation in Column<T> | (string & {})]: true;
};
export declare function isEntityKey<T>(entityColumns: Column<T>[], column: string): column is Column<T>;
export declare const positiveNumberOrDefault: (value: number | undefined, defaultValue: number, minValue?: 0 | 1) => number;
export type ColumnProperties = {
    propertyPath?: string;
    propertyName: string;
    isNested: boolean;
    column: string;
};
export declare function getPropertiesByColumnName(column: string): ColumnProperties;
export declare function extractVirtualProperty(qb: SelectQueryBuilder<unknown>, columnProperties: ColumnProperties): Partial<ColumnMetadata>;
export declare function includesAllPrimaryKeyColumns(qb: SelectQueryBuilder<unknown>, propertyPath: string[]): boolean;
export declare function getPrimaryKeyColumns(qb: SelectQueryBuilder<any>, entityName?: string): string[];
export declare function getMissingPrimaryKeyColumns(qb: SelectQueryBuilder<any>, transformedCols: string[]): string[];
export declare function hasColumnWithPropertyPath(qb: SelectQueryBuilder<unknown>, columnProperties: ColumnProperties): boolean;
export declare function checkIsRelation(qb: SelectQueryBuilder<unknown>, propertyPath: string): boolean;
export declare function checkIsNestedRelation(qb: SelectQueryBuilder<unknown>, propertyPath: string): boolean;
export declare function checkIsOneOfNestedPrimaryColumns(qb: SelectQueryBuilder<unknown>, propertyPath: string): boolean;
export declare function checkIsEmbedded(qb: SelectQueryBuilder<unknown>, propertyPath: string): boolean;
export declare function checkIsArray(qb: SelectQueryBuilder<unknown>, propertyName: string): boolean;
export declare function checkIsJsonb(qb: SelectQueryBuilder<unknown>, propertyName: string): boolean;
/**
 * Describes how a dot-separated filter path maps to a JSONB column.
 *
 * Given a path like `detail.referrer.source.platform`:
 *   - relationPath: ['detail']           — segments that are TypeORM relations (require JOIN)
 *   - jsonbColumn:  'referrer'           — the JSONB column on the final relation entity
 *   - jsonPath:     ['source', 'platform'] — the key path inside the JSON value
 */
export interface JsonbPathResolution {
    isJsonb: boolean;
    /** Relation segments leading up to the entity that owns the JSONB column */
    relationPath: string[];
    /** Name of the JSONB column on that entity */
    jsonbColumn: string;
    /** Key path inside the JSON value (may be empty for a top-level JSONB filter) */
    jsonPath: string[];
}
/**
 * Walks the dot-separated `column` path through TypeORM entity metadata to determine
 * whether the path terminates in a JSONB column and, if so, where the relation chain
 * ends and the JSON key path begins.
 *
 * Algorithm:
 *   For each segment, check whether the current entity metadata has a relation
 *   with that name.  If yes, follow the relation and continue.  If no, check
 *   whether it is a JSONB column on the current entity.  If yes, all remaining
 *   segments are JSON key path.  Otherwise, the path is not JSONB.
 */
export declare function resolveJsonbPath(qb: SelectQueryBuilder<unknown>, column: string): JsonbPathResolution;
export declare function fixColumnAlias(properties: ColumnProperties, alias: string, isRelation?: boolean, isVirtualProperty?: boolean, isEmbedded?: boolean, query?: ColumnMetadata['query'], qb?: SelectQueryBuilder<unknown>): string;
export declare function getQueryUrlComponents(path: string): {
    queryOrigin: string;
    queryPath: string;
};
export declare function isISODate(str: string): boolean;
export declare function isRepository<T>(repo: unknown | Repository<T>): repo is Repository<T>;
export declare function isFindOperator<T>(value: unknown | FindOperator<T>): value is FindOperator<T>;
export declare function createRelationSchema<T>(configurationRelations: RelationSchemaInput<T>): RelationSchema<T>;
export declare function mergeRelationSchema(...schemas: RelationSchema[]): any;
export declare function getPaddedExpr(valueExpr: string, length: number, dbType: string): string;
export declare function isDateColumnType(type: any): boolean;
export declare function quoteColumn(columnName: string, isMySqlOrMariaDb: boolean): string;
export declare function isNil(v: unknown): boolean;
export declare function isNotNil(v: unknown): boolean;
export declare function andWhereNoneExist(qb: SelectQueryBuilder<any>, existsQb: SelectQueryBuilder<any>): SelectQueryBuilder<any>;
/**
 * Adds a condition to the query builder that ensures all related entities match the given filter criteria.
 *
 * This method combines two conditions:
 * 1. EXISTS(X) - There must be at least one related entity matching the criteria
 * 2. NOT EXISTS(NOT X) - There must not be any related entities that don't match the criteria
 *
 * Together, these conditions ensure that all related entities match the filter criteria X.
 * For example, when filtering pillows in a cat home, this could find homes where ALL pillows are red.
 *
 * If you need to include cases where there are either 0 or all entities match, use $none:$not:X instead.
 *
 * @param {SelectQueryBuilder<any>} qb The main query builder instance to add the condition to.
 * @param {SelectQueryBuilder<any>} existsQb The subquery builder containing the filter criteria.
 * @return {SelectQueryBuilder<any>} The modified query builder with the combined EXISTS conditions.
 */
export declare function andWhereAllExist(qb: SelectQueryBuilder<any>, existsQb: SelectQueryBuilder<any>): SelectQueryBuilder<any>;
export {};
