"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiOkPaginatedResponse = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const paginated_swagger_type_1 = require("./paginated-swagger.type");
const ApiOkPaginatedResponse = (dataDto, paginatedConfig) => {
    const cols = (paginatedConfig === null || paginatedConfig === void 0 ? void 0 : paginatedConfig.filterableColumns) || {};
    return (0, common_1.applyDecorators)(...(typeof dataDto !== 'string' ? [(0, swagger_1.ApiExtraModels)(paginated_swagger_type_1.PaginatedDocumented, dataDto)] : []), (0, swagger_1.ApiOkResponse)({
        schema: {
            allOf: [
                { $ref: (0, swagger_1.getSchemaPath)(paginated_swagger_type_1.PaginatedDocumented) },
                {
                    properties: {
                        data: { type: 'array', items: { $ref: (0, swagger_1.getSchemaPath)(dataDto) } },
                        meta: {
                            properties: {
                                select: { type: 'array', items: { type: 'string', enum: paginatedConfig === null || paginatedConfig === void 0 ? void 0 : paginatedConfig.select } },
                                filter: {
                                    type: 'object',
                                    properties: Object.keys(cols).reduce((acc, key) => {
                                        acc[key] = {
                                            oneOf: [
                                                { type: 'string' },
                                                { type: 'array', items: { type: 'string' } },
                                            ],
                                        };
                                        return acc;
                                    }, {}),
                                },
                            },
                        },
                    },
                },
            ],
        },
    }));
};
exports.ApiOkPaginatedResponse = ApiOkPaginatedResponse;
//# sourceMappingURL=api-ok-paginated-response.decorator.js.map