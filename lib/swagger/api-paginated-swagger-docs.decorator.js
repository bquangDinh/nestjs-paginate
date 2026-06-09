"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedSwaggerDocs = PaginatedSwaggerDocs;
const common_1 = require("@nestjs/common");
const api_paginated_query_decorator_1 = require("./api-paginated-query.decorator");
const api_ok_paginated_response_decorator_1 = require("./api-ok-paginated-response.decorator");
function PaginatedSwaggerDocs(dto, paginatedConfig) {
    return (0, common_1.applyDecorators)((0, api_ok_paginated_response_decorator_1.ApiOkPaginatedResponse)(dto, paginatedConfig), (0, api_paginated_query_decorator_1.ApiPaginationQuery)(paginatedConfig));
}
//# sourceMappingURL=api-paginated-swagger-docs.decorator.js.map