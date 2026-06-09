"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Paginate = void 0;
const common_1 = require("@nestjs/common");
const lodash_1 = require("lodash");
const helper_1 = require("./helper");
function isRecord(data) {
    return data !== null && typeof data === 'object' && !Array.isArray(data);
}
function isExpressRequest(request) {
    return isRecord(request) && typeof request.get === 'function';
}
const singleSplit = (param, res) => res.push(param);
const multipleSplit = (param, res) => {
    const items = param.split(':');
    if (items.length === 2) {
        res.push(items);
    }
};
const multipleAndCommaSplit = (param, res) => {
    const set = new Set(param.split(','));
    set.forEach((item) => res.push(item));
};
function parseParam(queryParam, parserLogic) {
    const res = [];
    if (queryParam) {
        const params = !Array.isArray(queryParam) ? [queryParam] : queryParam;
        for (const param of params) {
            if ((0, lodash_1.isString)(param)) {
                parserLogic(param, res);
            }
        }
    }
    return res.length ? res : undefined;
}
function parseIntParam(v) {
    if ((0, helper_1.isNil)(v)) {
        return undefined;
    }
    const result = Number.parseInt(v.toString(), 10);
    if (Number.isNaN(result)) {
        return undefined;
    }
    return result;
}
exports.Paginate = (0, common_1.createParamDecorator)((_data, ctx) => {
    var _a;
    let path;
    let query;
    switch (ctx.getType()) {
        case 'http':
            const request = ctx.switchToHttp().getRequest();
            query = request.query;
            // Determine if Express or Fastify to rebuild the original url and reduce down to protocol, host and base url
            let originalUrl;
            if (isExpressRequest(request)) {
                originalUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
            }
            else {
                originalUrl = request.protocol + '://' + request.hostname + request.url;
            }
            const urlParts = new URL(originalUrl);
            path = urlParts.protocol + '//' + urlParts.host + urlParts.pathname;
            break;
        case 'ws':
            query = ctx.switchToWs().getData();
            path = null;
            break;
        case 'rpc':
            query = ctx.switchToRpc().getData();
            path = null;
            break;
    }
    const searchBy = parseParam(query.searchBy, singleSplit);
    const sortBy = (_a = parseParam(query.sortBy, multipleSplit)) === null || _a === void 0 ? void 0 : _a.map(([column, order]) => [column.includes('~') ? column.split('~') : column, order]);
    const select = parseParam(query.select, multipleAndCommaSplit);
    const filter = (0, lodash_1.mapKeys)((0, lodash_1.pickBy)(query, (param, name) => name.includes('filter.') &&
        ((0, lodash_1.isString)(param) || (Array.isArray(param) && param.every((p) => (0, lodash_1.isString)(p))))), (_param, name) => name.replace('filter.', ''));
    return {
        page: parseIntParam(query.page),
        limit: parseIntParam(query.limit),
        sortBy,
        search: query.search ? query.search.toString() : undefined,
        searchBy,
        filter: Object.keys(filter).length ? filter : undefined,
        select,
        cursor: query.cursor ? query.cursor.toString() : undefined,
        withDeleted: query.withDeleted === 'true' ? true : query.withDeleted === 'false' ? false : undefined,
        path,
    };
});
//# sourceMappingURL=decorator.js.map