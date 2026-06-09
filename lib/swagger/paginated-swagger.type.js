"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedDocumented = exports.PaginatedMetaDocumented = void 0;
const swagger_1 = require("@nestjs/swagger");
const paginate_1 = require("../paginate");
class PaginatedLinksDocumented {
}
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Link to first page',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedLinksDocumented.prototype, "first", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Link to previous page',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedLinksDocumented.prototype, "previous", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Link to current page',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedLinksDocumented.prototype, "current", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Link to next page',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedLinksDocumented.prototype, "next", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Link to last page',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedLinksDocumented.prototype, "last", void 0);
class PaginatedMetaDocumented {
}
exports.PaginatedMetaDocumented = PaginatedMetaDocumented;
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Number of items per page',
        required: true,
        type: 'number',
    }),
    __metadata("design:type", Number)
], PaginatedMetaDocumented.prototype, "itemsPerPage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Total number of items',
        required: true,
        type: 'number',
    }),
    __metadata("design:type", Number)
], PaginatedMetaDocumented.prototype, "totalItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Current requested page',
        required: true,
        type: 'number',
    }),
    __metadata("design:type", Number)
], PaginatedMetaDocumented.prototype, "currentPage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Total number of pages',
        required: true,
        type: 'number',
    }),
    __metadata("design:type", Number)
], PaginatedMetaDocumented.prototype, "totalPages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Sorting by columns',
        required: false,
        type: 'array',
        items: {
            type: 'array',
            items: {
                oneOf: [
                    {
                        type: 'string',
                    },
                    {
                        type: 'string',
                        enum: ['ASC', 'DESC'],
                    },
                ],
            },
        },
    }),
    __metadata("design:type", Array)
], PaginatedMetaDocumented.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Search by fields',
        required: false,
        isArray: true,
        type: 'string',
    }),
    __metadata("design:type", Array)
], PaginatedMetaDocumented.prototype, "searchBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Search term',
        required: false,
        type: 'string',
    }),
    __metadata("design:type", String)
], PaginatedMetaDocumented.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'List of selected fields',
        required: false,
        isArray: true,
        type: 'string',
    }),
    __metadata("design:type", Array)
], PaginatedMetaDocumented.prototype, "select", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Filters that applied to the query',
        selfRequired: false,
        required: [],
        isArray: false,
        type: 'object',
        additionalProperties: false,
    }),
    __metadata("design:type", Object)
], PaginatedMetaDocumented.prototype, "filter", void 0);
class PaginatedDocumented extends paginate_1.Paginated {
}
exports.PaginatedDocumented = PaginatedDocumented;
__decorate([
    (0, swagger_1.ApiProperty)({
        isArray: true,
        selfRequired: true,
        title: 'Array of entities',
        type: 'object',
        additionalProperties: false,
    }),
    __metadata("design:type", Array)
], PaginatedDocumented.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Pagination Metadata',
        required: true,
    }),
    __metadata("design:type", PaginatedMetaDocumented)
], PaginatedDocumented.prototype, "meta", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        title: 'Links to pages',
        required: true,
    }),
    __metadata("design:type", PaginatedLinksDocumented)
], PaginatedDocumented.prototype, "links", void 0);
//# sourceMappingURL=paginated-swagger.type.js.map