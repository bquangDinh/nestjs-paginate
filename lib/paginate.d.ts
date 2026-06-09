import { FindOptionsWhere, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginateQuery } from './decorator';
import { AddFilterOptions, FilterComparator, FilterOperator, FilterQuantifier, FilterSuffix } from './filter';
import { Column, JoinMethod, MappedColumns, RelationSchema, RelationSchemaInput, SortBy } from './helper';
export { AddFilterOptions, FilterComparator, FilterOperator, FilterSuffix };
export declare class Paginated<T> {
    data: T[];
    meta: {
        itemsPerPage: number;
        totalItems?: number;
        currentPage?: number;
        totalPages?: number;
        sortBy: SortBy<T>;
        searchBy: Column<T>[] | undefined;
        search: string | undefined;
        select: string[] | undefined;
        filter?: {
            [column: string]: string | string[];
        };
        cursor?: string;
    };
    links: {
        first?: string;
        previous?: string;
        current: string;
        next?: string;
        last?: string;
    };
    constructor();
}
export declare enum PaginationType {
    LIMIT_AND_OFFSET = "limit",
    TAKE_AND_SKIP = "take",
    CURSOR = "cursor"
}
export interface PaginateConfig<T> {
    relations?: RelationSchemaInput<T>;
    sortableColumns: Column<T>[];
    nullSort?: 'first' | 'last';
    searchableColumns?: Column<T>[];
    select?: (Column<T> | (string & {}))[];
    maxLimit?: number;
    defaultSortBy?: SortBy<T>;
    defaultLimit?: number;
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    filterableColumns?: Partial<MappedColumns<T, (FilterOperator | FilterSuffix | FilterQuantifier | FilterComparator)[] | true>>;
    maxAndValues?: number;
    loadEagerRelations?: boolean;
    withDeleted?: boolean;
    allowWithDeletedInQuery?: boolean;
    paginationType?: PaginationType;
    relativePath?: boolean;
    origin?: string;
    ignoreSearchByInQueryParam?: boolean;
    ignoreSelectInQueryParam?: boolean;
    multiWordSearch?: boolean;
    defaultJoinMethod?: JoinMethod;
    joinMethods?: Partial<MappedColumns<T, JoinMethod>>;
    buildCountQuery?: (qb: SelectQueryBuilder<T>) => SelectQueryBuilder<any>;
    throwOnInvalidFilter?: boolean;
}
export declare enum PaginationLimit {
    NO_PAGINATION = -1,
    COUNTER_ONLY = 0
}
export declare function paginate<T extends ObjectLiteral>(query: PaginateQuery, repo: Repository<T> | SelectQueryBuilder<T>, config: PaginateConfig<T>): Promise<Paginated<T>>;
export declare function addRelationsFromSchema<T>(queryBuilder: SelectQueryBuilder<T>, schema: RelationSchema<T>, joinMethods: Partial<MappedColumns<T, JoinMethod>>, defaultJoinMethod?: 'leftJoin' | 'innerJoin' | 'leftJoinAndSelect' | 'innerJoinAndSelect'): void;
