"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiPaginationQuery = void 0;
exports.SortBy = SortBy;
exports.Limit = Limit;
exports.Select = Select;
exports.Where = Where;
exports.Page = Page;
exports.Search = Search;
exports.SearchBy = SearchBy;
exports.WithDeleted = WithDeleted;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const filter_1 = require("../filter");
const paginate_1 = require("../paginate");
const global_config_1 = require("../global-config");
const helper_1 = require("../helper");
const DEFAULT_VALUE_KEY = 'Default Value';
const allFilterSuffixes = Object.values(paginate_1.FilterSuffix).map((v) => v.toString());
function p(key, value) {
    return `
**${key}:** ${value}
`;
}
function li(key, values) {
    return `**${key}**
${values.map((v) => `- ${v}`).join('\n\n')}`;
}
function SortBy(paginationConfig) {
    const sortableColumnNotAvailable = (0, helper_1.isNil)(paginationConfig.sortableColumns) || paginationConfig.sortableColumns.length === 0;
    if ((0, helper_1.isNil)(paginationConfig.defaultSortBy) && sortableColumnNotAvailable) {
        // no sorting allowed or predefined
        return undefined;
    }
    const defaultSortMessage = paginationConfig.defaultSortBy
        ? paginationConfig.defaultSortBy.map(([col, order]) => `${col}:${order}`).join(',')
        : 'No default sorting specified, the result order is not guaranteed if not provided';
    const sortBy = paginationConfig.sortableColumns.reduce((prev, curr) => {
        return [...prev, `${curr}:ASC`, `${curr}:DESC`];
    }, []);
    const exampleValue = sortableColumnNotAvailable
        ? 'Allowed sortable columns are not provided, only default sorting will be used'
        : paginationConfig.sortableColumns
            .slice(0, 2)
            .map((col) => `sortBy=${col}:DESC`)
            .join('&');
    return (0, swagger_1.ApiQuery)({
        name: 'sortBy',
        isArray: true,
        enum: sortBy,
        description: `Parameter to sort by.
To sort by multiple fields, just provide query param multiple types. The order in url defines an order of sorting
${p('Format', '{fieldName}:{DIRECTION}')}
${p('Example', exampleValue)}
${p('Default Value', defaultSortMessage)}
${li('Available Fields', paginationConfig.sortableColumns)}
`,
        required: false,
        type: 'string',
    });
}
function Limit(paginationConfig) {
    var _a, _b;
    return (0, swagger_1.ApiQuery)({
        name: 'limit',
        description: `Number of records per page.

${p('Example', global_config_1.default.defaultLimit.toString())}

${p(DEFAULT_VALUE_KEY, ((_a = paginationConfig === null || paginationConfig === void 0 ? void 0 : paginationConfig.defaultLimit) === null || _a === void 0 ? void 0 : _a.toString()) || global_config_1.default.defaultLimit.toString())}

${p('Max Value', ((_b = paginationConfig.maxLimit) === null || _b === void 0 ? void 0 : _b.toString()) || global_config_1.default.defaultMaxLimit.toString())}

If provided value is greater than max value, max value will be applied.
`,
        required: false,
        type: 'number',
    });
}
function Select(paginationConfig) {
    if (!paginationConfig.select) {
        return;
    }
    return (0, swagger_1.ApiQuery)({
        name: 'select',
        description: `List of fields to select.
${p('Example', paginationConfig.select.slice(0, 5).join(','))}
${p(DEFAULT_VALUE_KEY, 'By default all fields returns. If you want to select only some fields, provide them in query param')}
`,
        required: false,
        type: 'string',
    });
}
function Where(paginationConfig) {
    if (!paginationConfig.filterableColumns)
        return;
    const allColumnsDecorators = Object.entries(paginationConfig.filterableColumns)
        .map(([fieldName, filterOperations]) => {
        const operations = filterOperations === true || filterOperations === undefined
            ? [...Object.values(paginate_1.FilterOperator), ...Object.values(paginate_1.FilterSuffix)]
            : filterOperations.map((fo) => fo.toString());
        const operationsForExample = operations
            .filter((v) => !allFilterSuffixes.includes(v))
            .sort()
            .slice(0, 2) || [];
        return (0, swagger_1.ApiQuery)({
            name: `filter.${fieldName}`,
            description: `Filter by ${fieldName} query param.
${p('Format', `filter.${fieldName}={$not}:OPERATION:VALUE`)}

${p('Example', operationsForExample.length === 0
                ? 'No filtering allowed'
                : operationsForExample.map((v) => `filter.${fieldName}=${v}:John Doe`).join('&'))}
${li('Available Operations', [...operations, ...Object.values(filter_1.FilterComparator)])}`,
            required: false,
            type: 'string',
            isArray: true,
        });
    })
        .filter((v) => v !== undefined);
    return (0, common_1.applyDecorators)(...allColumnsDecorators);
}
function Page() {
    return (0, swagger_1.ApiQuery)({
        name: 'page',
        description: `Page number to retrieve. If you provide invalid value the default page number will applied
${p('Example', '1')}
${p(DEFAULT_VALUE_KEY, '1')}
`,
        required: false,
        type: 'number',
    });
}
function Search(paginateConfig) {
    if (!paginateConfig.searchableColumns)
        return;
    return (0, swagger_1.ApiQuery)({
        name: 'search',
        description: `Search term to filter result values
${p('Example', 'John')}
${p(DEFAULT_VALUE_KEY, 'No default value')}
`,
        required: false,
        type: 'string',
    });
}
function SearchBy(paginateConfig) {
    if (!paginateConfig.searchableColumns)
        return;
    return (0, swagger_1.ApiQuery)({
        name: 'searchBy',
        description: `List of fields to search by term to filter result values
${p('Example', paginateConfig.searchableColumns.slice(0, Math.min(5, paginateConfig.searchableColumns.length)).join(','))}
${p(DEFAULT_VALUE_KEY, 'By default all fields mentioned below will be used to search by term')}
${li('Available Fields', paginateConfig.searchableColumns)}
`,
        required: false,
        isArray: true,
        type: 'string',
    });
}
function WithDeleted(paginateConfig) {
    if (!paginateConfig.allowWithDeletedInQuery)
        return;
    return (0, swagger_1.ApiQuery)({
        name: 'withDeleted',
        description: `Retrieve records including soft deleted ones`,
        required: false,
        type: 'boolean',
    });
}
const ApiPaginationQuery = (paginationConfig) => {
    return (0, common_1.applyDecorators)(...[
        Page(),
        Limit(paginationConfig),
        Where(paginationConfig),
        SortBy(paginationConfig),
        Search(paginationConfig),
        SearchBy(paginationConfig),
        Select(paginationConfig),
        WithDeleted(paginationConfig),
    ].filter((v) => v !== undefined));
};
exports.ApiPaginationQuery = ApiPaginationQuery;
//# sourceMappingURL=api-paginated-query.decorator.js.map