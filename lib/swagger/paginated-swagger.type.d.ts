import { Column, SortBy } from '../helper';
import { Paginated } from '../paginate';
declare class PaginatedLinksDocumented {
    first?: string;
    previous?: string;
    current: string;
    next?: string;
    last?: string;
}
export declare class PaginatedMetaDocumented<T> {
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
    sortBy: SortBy<T>;
    searchBy: Column<T>[];
    search: string;
    select: string[];
    filter?: {
        [p: string]: string | string[];
    };
}
export declare class PaginatedDocumented<T> extends Paginated<T> {
    data: T[];
    meta: PaginatedMetaDocumented<T>;
    links: PaginatedLinksDocumented;
}
export {};
