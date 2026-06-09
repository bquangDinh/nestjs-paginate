export interface PaginateQuery {
    page?: number;
    limit?: number;
    sortBy?: [string | string[], string][];
    searchBy?: string[];
    search?: string;
    filter?: {
        [column: string]: string | string[];
    };
    select?: string[];
    cursor?: string;
    withDeleted?: boolean;
    path: string;
}
export declare const Paginate: (...dataOrPipes: unknown[]) => ParameterDecorator;
