"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationLimit = exports.PaginationType = exports.Paginated = exports.FilterSuffix = exports.FilterOperator = exports.FilterComparator = void 0;
exports.paginate = paginate;
exports.addRelationsFromSchema = addRelationsFromSchema;
const common_1 = require("@nestjs/common");
const lodash_1 = require("lodash");
const querystring_1 = require("querystring");
const typeorm_1 = require("typeorm");
const filter_1 = require("./filter");
Object.defineProperty(exports, "FilterComparator", { enumerable: true, get: function () { return filter_1.FilterComparator; } });
Object.defineProperty(exports, "FilterOperator", { enumerable: true, get: function () { return filter_1.FilterOperator; } });
Object.defineProperty(exports, "FilterSuffix", { enumerable: true, get: function () { return filter_1.FilterSuffix; } });
const helper_1 = require("./helper");
const global_config_1 = __importDefault(require("./global-config"));
const logger = new common_1.Logger('nestjs-paginate');
class Paginated {
    constructor() { }
}
exports.Paginated = Paginated;
var PaginationType;
(function (PaginationType) {
    PaginationType["LIMIT_AND_OFFSET"] = "limit";
    PaginationType["TAKE_AND_SKIP"] = "take";
    PaginationType["CURSOR"] = "cursor";
})(PaginationType || (exports.PaginationType = PaginationType = {}));
var PaginationLimit;
(function (PaginationLimit) {
    PaginationLimit[PaginationLimit["NO_PAGINATION"] = -1] = "NO_PAGINATION";
    PaginationLimit[PaginationLimit["COUNTER_ONLY"] = 0] = "COUNTER_ONLY";
})(PaginationLimit || (exports.PaginationLimit = PaginationLimit = {}));
function generateWhereStatement(queryBuilder, obj) {
    const toTransform = Array.isArray(obj) ? obj : [obj];
    return toTransform.map((item) => flattenWhereAndTransform(queryBuilder, item).join(' AND ')).join(' OR ');
}
function flattenWhereAndTransform(queryBuilder, obj, separator = '.', parentKey = '') {
    return Object.entries(obj).flatMap(([key, value]) => {
        var _a, _b;
        if (obj.hasOwnProperty(key)) {
            const joinedKey = parentKey ? `${parentKey}${separator}${key}` : key;
            if (typeof value === 'object' && value !== null && !(0, helper_1.isFindOperator)(value)) {
                return flattenWhereAndTransform(queryBuilder, value, separator, joinedKey);
            }
            else {
                const property = (0, helper_1.getPropertiesByColumnName)(joinedKey);
                const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(queryBuilder, property);
                const isRelation = (0, helper_1.checkIsRelation)(queryBuilder, (_a = property.propertyPath) !== null && _a !== void 0 ? _a : '');
                const isEmbedded = (0, helper_1.checkIsEmbedded)(queryBuilder, (_b = property.propertyPath) !== null && _b !== void 0 ? _b : '');
                const alias = (0, helper_1.fixColumnAlias)(property, queryBuilder.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, queryBuilder);
                const whereClause = queryBuilder['createWhereConditionExpression'](queryBuilder['getWherePredicateCondition'](alias, value));
                const allJoinedTables = queryBuilder.expressionMap.joinAttributes.reduce((acc, attr) => {
                    acc[attr.alias.name] = true;
                    return acc;
                }, {});
                const allTablesInPath = property.column.split('.').slice(0, -1);
                const tablesToJoin = allTablesInPath.map((table, idx) => {
                    if (idx === 0) {
                        return table;
                    }
                    return [...allTablesInPath.slice(0, idx), table].join('.');
                });
                tablesToJoin.forEach((table) => {
                    const pathSplit = table.split('.');
                    const fullPath = pathSplit.length === 1
                        ? ''
                        : `_${pathSplit
                            .slice(0, -1)
                            .map((p) => p + '_rel')
                            .join('_')}`;
                    const tableName = pathSplit[pathSplit.length - 1];
                    const tableAliasWithProperty = `${queryBuilder.alias}${fullPath}.${tableName}`;
                    const joinTableAlias = `${queryBuilder.alias}${fullPath}_${tableName}_rel`;
                    const baseTableAlias = allJoinedTables[joinTableAlias];
                    if (baseTableAlias) {
                        return;
                    }
                    else {
                        queryBuilder.leftJoin(tableAliasWithProperty, joinTableAlias);
                    }
                });
                return whereClause;
            }
        }
    });
}
function fixCursorValue(value) {
    if ((0, helper_1.isISODate)(value)) {
        return new Date(value);
    }
    return value;
}
async function paginate(query, repo, config) {
    var _a, _b, _c;
    const dbType = ((0, helper_1.isRepository)(repo) ? repo.manager : repo).connection.options.type;
    const isMySqlOrMariaDb = ['mysql', 'mariadb'].includes(dbType);
    const metadata = (0, helper_1.isRepository)(repo)
        ? repo.metadata
        : repo.expressionMap.mainAlias
            ? repo.expressionMap.mainAlias.metadata
            : repo.expressionMap.aliases && repo.expressionMap.aliases.length
                ? repo.expressionMap.aliases[0].metadata
                : (() => {
                    throw new Error('Could not determine metadata: QueryBuilder has no main alias');
                })();
    const page = (0, helper_1.positiveNumberOrDefault)(query.page, 1, 1);
    const defaultLimit = config.defaultLimit || global_config_1.default.defaultLimit;
    const maxLimit = config.maxLimit || global_config_1.default.defaultMaxLimit;
    const isPaginated = !(query.limit === PaginationLimit.COUNTER_ONLY ||
        (query.limit === PaginationLimit.NO_PAGINATION && maxLimit === PaginationLimit.NO_PAGINATION));
    const limit = query.limit === PaginationLimit.COUNTER_ONLY
        ? PaginationLimit.COUNTER_ONLY
        : isPaginated === true
            ? maxLimit === PaginationLimit.NO_PAGINATION
                ? ((_a = query.limit) !== null && _a !== void 0 ? _a : defaultLimit)
                : query.limit === PaginationLimit.NO_PAGINATION
                    ? defaultLimit
                    : Math.min((_b = query.limit) !== null && _b !== void 0 ? _b : defaultLimit, maxLimit)
            : defaultLimit;
    const generateNullCursor = () => {
        return 'A' + '0'.repeat(15); // null values ​​should be looked up last, so use the smallest prefix
    };
    const generateDateCursor = (value, direction) => {
        if (direction === 'ASC' && value === 0) {
            return 'X' + '0'.repeat(15);
        }
        const finalValue = direction === 'ASC' ? Math.pow(10, 15) - value : value;
        return 'V' + String(finalValue).padStart(15, '0');
    };
    const generateNumberCursor = (value, direction) => {
        const integerLength = 11;
        const decimalLength = 4; // sorting is not possible if the decimal point exceeds 4 digits
        const maxIntegerDigit = Math.pow(10, integerLength);
        const fixedScale = Math.pow(10, decimalLength);
        const absValue = Math.abs(value);
        const scaledValue = Math.round(absValue * fixedScale);
        const integerPart = Math.floor(scaledValue / fixedScale);
        const decimalPart = scaledValue % fixedScale;
        let integerPrefix;
        let decimalPrefix;
        let finalInteger;
        let finalDecimal;
        if (direction === 'ASC') {
            if (value < 0) {
                integerPrefix = 'Y';
                decimalPrefix = 'V';
                finalInteger = integerPart;
                finalDecimal = decimalPart;
            }
            else if (value === 0) {
                integerPrefix = 'X';
                decimalPrefix = 'X';
                finalInteger = 0;
                finalDecimal = 0;
            }
            else {
                integerPrefix = integerPart === 0 ? 'X' : 'V'; // X > V
                decimalPrefix = decimalPart === 0 ? 'X' : 'V'; // X > V
                finalInteger = integerPart === 0 ? 0 : maxIntegerDigit - integerPart;
                finalDecimal = decimalPart === 0 ? 0 : fixedScale - decimalPart;
            }
        }
        else {
            // DESC
            if (value < 0) {
                integerPrefix = integerPart === 0 ? 'N' : 'M'; // N > M
                decimalPrefix = decimalPart === 0 ? 'X' : 'V'; // X > V
                finalInteger = integerPart === 0 ? 0 : maxIntegerDigit - integerPart;
                finalDecimal = decimalPart === 0 ? 0 : fixedScale - decimalPart;
            }
            else if (value === 0) {
                integerPrefix = 'N';
                decimalPrefix = 'X';
                finalInteger = 0;
                finalDecimal = 0;
            }
            else {
                integerPrefix = 'V';
                decimalPrefix = 'V';
                finalInteger = integerPart;
                finalDecimal = decimalPart;
            }
        }
        return (integerPrefix +
            String(finalInteger).padStart(integerLength, '0') +
            decimalPrefix +
            String(finalDecimal).padStart(decimalLength, '0'));
    };
    const generateCursor = (item, sortBy, linkType = 'next') => {
        return sortBy
            .map(([column, direction]) => {
            const columnProperties = (0, helper_1.getPropertiesByColumnName)(String(column));
            let propertyPath = [];
            if (columnProperties.isNested) {
                if (columnProperties.propertyPath) {
                    propertyPath.push(columnProperties.propertyPath);
                }
                propertyPath = propertyPath.concat(columnProperties.propertyName.split('.'));
            }
            else if (columnProperties.propertyPath) {
                propertyPath = [columnProperties.propertyPath, columnProperties.propertyName];
            }
            else {
                propertyPath = [columnProperties.propertyName];
            }
            // Extract value from nested object
            let value = item;
            for (let i = 0; i < propertyPath.length; i++) {
                const key = propertyPath[i];
                if (value === null || value === undefined) {
                    value = null;
                    break;
                }
                // Handle case where value is an array
                if (Array.isArray(value[key])) {
                    const arrayValues = value[key]
                        .map((item) => {
                        let nestedValue = item;
                        for (let j = i + 1; j < propertyPath.length; j++) {
                            if (nestedValue === null || nestedValue === undefined) {
                                return null;
                            }
                            // Handle embedded properties
                            if (propertyPath[j].includes('.')) {
                                const nestedProperties = propertyPath[j].split('.');
                                for (const nestedProperty of nestedProperties) {
                                    nestedValue = nestedValue[nestedProperty];
                                }
                            }
                            else {
                                nestedValue = nestedValue[propertyPath[j]];
                            }
                        }
                        return nestedValue;
                    })
                        .filter((v) => v !== null && v !== undefined);
                    if (arrayValues.length === 0) {
                        value = null;
                    }
                    else {
                        // Select min or max value based on sort direction and linkType (XOR)
                        value = ((direction === 'ASC') !== (linkType === 'previous')
                            ? Math.min(...arrayValues)
                            : Math.max(...arrayValues));
                    }
                    break;
                }
                else {
                    value = value[key];
                }
            }
            value = fixCursorValue(value);
            // Find column metadata
            let columnMeta = null;
            if (propertyPath.length === 1) {
                // For regular column
                columnMeta = metadata.columns.find((col) => col.propertyName === columnProperties.propertyName);
            }
            else {
                // For relation column
                let currentMetadata = metadata;
                let currentPath = '';
                // Traverse the relation path except for the last part
                for (let i = 0; i < propertyPath.length - 1; i++) {
                    const relationName = propertyPath[i];
                    currentPath = currentPath ? `${currentPath}.${relationName}` : relationName;
                    const relation = currentMetadata.findRelationWithPropertyPath(relationName);
                    if (relation) {
                        currentMetadata = relation.inverseEntityMetadata;
                    }
                    else {
                        break;
                    }
                }
                // Find column by the last property name
                const propertyName = propertyPath[propertyPath.length - 1];
                columnMeta = currentMetadata.columns.find((col) => col.propertyName === propertyName);
            }
            const isDateColumn = columnMeta && (0, helper_1.isDateColumnType)(columnMeta.type);
            if (value === null || value === undefined) {
                return generateNullCursor();
            }
            if (isDateColumn) {
                return generateDateCursor(value.getTime(), direction);
            }
            else {
                const numericValue = Number(value);
                return generateNumberCursor(numericValue, direction);
            }
        })
            .join('');
    };
    const getDateColumnExpression = (alias, dbType) => {
        switch (dbType) {
            case 'mysql':
            case 'mariadb':
                return `UNIX_TIMESTAMP(${alias}) * 1000`;
            case 'postgres':
                return `EXTRACT(EPOCH FROM ${alias}) * 1000`;
            case 'sqlite':
                return `(STRFTIME('%s', ${alias}) + (STRFTIME('%f', ${alias}) - STRFTIME('%S', ${alias}))) * 1000`;
            default:
                return alias;
        }
    };
    const logAndThrowException = (msg) => {
        logger.debug(msg);
        throw new common_1.ServiceUnavailableException(msg);
    };
    if (config.sortableColumns.length < 1) {
        logAndThrowException("Missing required 'sortableColumns' config.");
    }
    const sortBy = [];
    if (query.sortBy) {
        for (const order of query.sortBy) {
            const [column, direction] = order;
            if (!['ASC', 'DESC'].includes(direction)) {
                continue;
            }
            // A polymorphic group (e.g. `colA~colB`) is valid only when every
            // column in the group is sortable.
            if (Array.isArray(column)) {
                if (column.length > 0 && column.every((c) => (0, helper_1.isEntityKey)(config.sortableColumns, c))) {
                    sortBy.push(order);
                }
            }
            else if ((0, helper_1.isEntityKey)(config.sortableColumns, column)) {
                sortBy.push(order);
            }
        }
    }
    if (!sortBy.length) {
        sortBy.push(...(config.defaultSortBy || [[config.sortableColumns[0], 'ASC']]));
    }
    // Polymorphic sort groups rely on a COALESCE expression in the SELECT/ORDER BY,
    // which cannot be encoded into a cursor token. Reject the combination explicitly
    // rather than producing silently-wrong cursors.
    if (config.paginationType === PaginationType.CURSOR && sortBy.some(([column]) => Array.isArray(column))) {
        logAndThrowException('Polymorphic sort groups (using "~") are not supported with cursor pagination.');
    }
    const searchBy = [];
    let [items, totalItems] = [[], 0];
    const queryBuilder = (0, helper_1.isRepository)(repo) ? repo.createQueryBuilder('__root') : repo;
    if ((0, helper_1.isRepository)(repo) && !config.relations && config.loadEagerRelations === true) {
        if (!config.relations) {
            typeorm_1.FindOptionsUtils.joinEagerRelations(queryBuilder, queryBuilder.alias, repo.metadata);
        }
    }
    if (isPaginated) {
        config.paginationType = config.paginationType || PaginationType.TAKE_AND_SKIP;
        // Allow user to choose between limit/offset and take/skip, or cursor-based pagination.
        // However, using limit/offset can cause problems when joining one-to-many etc.
        if (config.paginationType === PaginationType.LIMIT_AND_OFFSET) {
            queryBuilder.limit(limit).offset((page - 1) * limit);
        }
        else if (config.paginationType === PaginationType.TAKE_AND_SKIP) {
            queryBuilder.take(limit).skip((page - 1) * limit);
        }
        else if (config.paginationType === PaginationType.CURSOR) {
            queryBuilder.take(limit);
            const padLength = 15;
            const integerLength = 11;
            const decimalLength = 4;
            const fixedScale = Math.pow(10, 4);
            const maxIntegerDigit = Math.pow(10, 11);
            const concat = (parts) => isMySqlOrMariaDb ? `CONCAT(${parts.join(', ')})` : parts.join(' || ');
            const generateNullCursorExpr = () => {
                const zeroPaddedExpr = (0, helper_1.getPaddedExpr)('0', padLength, dbType);
                const prefix = 'A';
                return isMySqlOrMariaDb ? `CONCAT('${prefix}', ${zeroPaddedExpr})` : `'${prefix}' || ${zeroPaddedExpr}`;
            };
            const generateDateCursorExpr = (columnExpr, direction) => {
                const safeExpr = `COALESCE(${columnExpr}, 0)`;
                const sqlExpr = direction === 'ASC' ? `POW(10, ${padLength}) - ${safeExpr}` : safeExpr;
                const paddedExpr = (0, helper_1.getPaddedExpr)(sqlExpr, padLength, dbType);
                const zeroPaddedExpr = (0, helper_1.getPaddedExpr)('0', padLength, dbType);
                const prefixNull = "'A'";
                const prefixValue = "'V'";
                const prefixZero = "'X'";
                if (direction === 'ASC') {
                    return `CASE
                        WHEN ${columnExpr} IS NULL THEN ${concat([prefixNull, zeroPaddedExpr])}
                        WHEN ${columnExpr} = 0 THEN ${concat([prefixZero, zeroPaddedExpr])}
                        ELSE ${concat([prefixValue, paddedExpr])}
                    END`;
                }
                else {
                    return `CASE
                        WHEN ${columnExpr} IS NULL THEN ${concat([prefixNull, zeroPaddedExpr])}
                        ELSE ${concat([prefixValue, paddedExpr])}
                    END`;
                }
            };
            const generateNumberCursorExpr = (columnExpr, direction) => {
                const safeExpr = `COALESCE(${columnExpr}, 0)`;
                const absSafeExpr = `ABS(${safeExpr})`;
                const scaledExpr = `ROUND(${absSafeExpr} * ${fixedScale}, 0)`;
                const intExpr = `FLOOR(${scaledExpr} / ${fixedScale})`;
                const decExpr = `(${scaledExpr} % ${fixedScale})`;
                const reversedIntExpr = `(${maxIntegerDigit} - ${intExpr})`;
                const reversedDecExpr = `(${fixedScale} - ${decExpr})`;
                const paddedIntExpr = (0, helper_1.getPaddedExpr)(intExpr, integerLength, dbType);
                const paddedDecExpr = (0, helper_1.getPaddedExpr)(decExpr, decimalLength, dbType);
                const reversedIntPaddedExpr = (0, helper_1.getPaddedExpr)(reversedIntExpr, integerLength, dbType);
                const reversedDecPaddedExpr = (0, helper_1.getPaddedExpr)(reversedDecExpr, decimalLength, dbType);
                const zeroPaddedIntExpr = (0, helper_1.getPaddedExpr)('0', integerLength, dbType);
                const zeroPaddedDecExpr = (0, helper_1.getPaddedExpr)('0', decimalLength, dbType);
                if (direction === 'ASC') {
                    return `CASE
                        WHEN ${columnExpr} IS NULL THEN ${generateNullCursorExpr()}
                        WHEN ${columnExpr} < 0 THEN ${concat(["'Y'", paddedIntExpr, "'V'", paddedDecExpr])}
                        WHEN ${columnExpr} = 0 THEN ${concat(["'X'", zeroPaddedIntExpr, "'X'", zeroPaddedDecExpr])}
                        WHEN ${columnExpr} > 0 AND ${intExpr} = 0 AND ${decExpr} > 0 THEN ${concat([
                        "'X'",
                        zeroPaddedIntExpr,
                        "'V'",
                        reversedDecPaddedExpr,
                    ])}
                        WHEN ${columnExpr} > 0 AND ${intExpr} > 0 AND ${decExpr} = 0 THEN ${concat([
                        "'V'",
                        reversedIntPaddedExpr,
                        "'X'",
                        zeroPaddedDecExpr,
                    ])}
                        WHEN ${columnExpr} > 0 AND ${intExpr} > 0 AND ${decExpr} > 0 THEN ${concat([
                        "'V'",
                        reversedIntPaddedExpr,
                        "'V'",
                        reversedDecPaddedExpr,
                    ])}
                    END`;
                }
                else {
                    return `CASE
                        WHEN ${columnExpr} IS NULL THEN ${generateNullCursorExpr()}
                        WHEN ${columnExpr} < 0 AND ${intExpr} > 0 AND ${decExpr} > 0 THEN ${concat([
                        "'M'",
                        reversedIntPaddedExpr,
                        "'V'",
                        reversedDecPaddedExpr,
                    ])}
                        WHEN ${columnExpr} < 0 AND ${intExpr} > 0 AND ${decExpr} = 0 THEN ${concat([
                        "'M'",
                        reversedIntPaddedExpr,
                        "'X'",
                        zeroPaddedDecExpr,
                    ])}
                        WHEN ${columnExpr} < 0 AND ${intExpr} = 0 AND ${decExpr} > 0 THEN ${concat([
                        "'N'",
                        zeroPaddedIntExpr,
                        "'V'",
                        reversedDecPaddedExpr,
                    ])}
                        WHEN ${columnExpr} = 0 THEN ${concat(["'N'", zeroPaddedIntExpr, "'X'", zeroPaddedDecExpr])}
                        WHEN ${columnExpr} > 0 THEN ${concat(["'V'", paddedIntExpr, "'V'", paddedDecExpr])}
                    END`;
                }
            };
            const cursorExpressions = sortBy.map(([column, direction]) => {
                var _a, _b;
                // Polymorphic sort groups are rejected for cursor pagination above,
                // so every column here is a plain string.
                const columnProperties = (0, helper_1.getPropertiesByColumnName)(column);
                const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(queryBuilder, columnProperties);
                const isRelation = (0, helper_1.checkIsRelation)(queryBuilder, (_a = columnProperties.propertyPath) !== null && _a !== void 0 ? _a : '');
                const isEmbedded = (0, helper_1.checkIsEmbedded)(queryBuilder, (_b = columnProperties.propertyPath) !== null && _b !== void 0 ? _b : '');
                const alias = (0, helper_1.fixColumnAlias)(columnProperties, queryBuilder.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, queryBuilder);
                // Find column metadata to determine type for proper cursor handling
                let columnMeta = metadata.columns.find((col) => col.propertyName === columnProperties.propertyName);
                // If it's a relation column, we need to find the target column metadata
                if (isRelation) {
                    // Find the relation by path and get the target entity metadata
                    const relationPath = columnProperties.column.split('.');
                    // The base entity is the starting point
                    let currentMetadata = metadata;
                    // Traverse the relation path to find the target metadata
                    for (let i = 0; i < relationPath.length - 1; i++) {
                        const relationName = relationPath[i];
                        const relation = currentMetadata.findRelationWithPropertyPath(relationName);
                        if (relation) {
                            // Update the metadata to the target entity metadata for the next iteration
                            currentMetadata = relation.inverseEntityMetadata;
                        }
                        else {
                            break;
                        }
                    }
                    // Now get the property from the target entity
                    const propertyName = relationPath[relationPath.length - 1];
                    columnMeta = currentMetadata.columns.find((col) => col.propertyName === propertyName);
                }
                // Determine whether it's a date column
                const isDateColumn = columnMeta && (0, helper_1.isDateColumnType)(columnMeta.type);
                const columnExpr = isDateColumn ? getDateColumnExpression(alias, dbType) : alias;
                return isDateColumn
                    ? generateDateCursorExpr(columnExpr, direction)
                    : generateNumberCursorExpr(columnExpr, direction);
            });
            const cursorExpression = cursorExpressions.length > 1
                ? isMySqlOrMariaDb
                    ? `CONCAT(${cursorExpressions.join(', ')})`
                    : cursorExpressions.join(' || ')
                : cursorExpressions[0];
            queryBuilder.addSelect(cursorExpression, 'cursor');
            if (query.cursor) {
                queryBuilder.andWhere(`${cursorExpression} < :cursor`, { cursor: query.cursor });
            }
            isMySqlOrMariaDb ? queryBuilder.orderBy('`cursor`', 'DESC') : queryBuilder.orderBy('cursor', 'DESC'); // since cursor is a reserved word in mysql, wrap it in backticks to recognize it as an alias
        }
    }
    if (config.withDeleted || (config.allowWithDeletedInQuery && query.withDeleted)) {
        queryBuilder.withDeleted();
    }
    let filterJoinMethods = {};
    if (query.filter) {
        filterJoinMethods = (0, filter_1.addFilter)(queryBuilder, query, config.filterableColumns, {
            maxAndValues: config.maxAndValues,
        }, config.throwOnInvalidFilter);
    }
    const joinMethods = Object.assign(Object.assign({}, filterJoinMethods), config.joinMethods);
    // Add the relations specified by the config, or used in the currently
    // filtered filterable columns.
    if (config.relations || Object.keys(filterJoinMethods).length) {
        const relationsSchema = (0, helper_1.mergeRelationSchema)((0, helper_1.createRelationSchema)(config.relations), (0, helper_1.createRelationSchema)(Object.keys(joinMethods)));
        addRelationsFromSchema(queryBuilder, relationsSchema, joinMethods, config.defaultJoinMethod);
    }
    if (config.paginationType !== PaginationType.CURSOR) {
        let nullSort;
        if (config.nullSort) {
            if (isMySqlOrMariaDb) {
                nullSort = config.nullSort === 'last' ? 'IS NULL' : 'IS NOT NULL';
            }
            else {
                nullSort = config.nullSort === 'last' ? 'NULLS LAST' : 'NULLS FIRST';
            }
        }
        for (const order of sortBy) {
            const [sortColumn, sortDirection] = order;
            // Polymorphic sort: `colA~colB` sorts by COALESCE(colA, colB) — the first
            // non-null value per row. The grouped columns must be type-compatible.
            if (Array.isArray(sortColumn)) {
                const escape = (identifier) => queryBuilder.connection.driver.escape(identifier);
                const coalesceExpr = `COALESCE(${sortColumn
                    .map((column) => {
                    const props = (0, helper_1.getPropertiesByColumnName)(column);
                    const { isVirtualProperty } = (0, helper_1.extractVirtualProperty)(queryBuilder, props);
                    const isEmbedded = (0, helper_1.checkIsEmbedded)(queryBuilder, props.propertyPath);
                    if (isVirtualProperty || isEmbedded || (0, helper_1.resolveJsonbPath)(queryBuilder, props.column).isJsonb) {
                        logAndThrowException(`Polymorphic sort groups (using "~") support only plain and relation columns, not "${column}".`);
                    }
                    const isRelation = (0, helper_1.checkIsRelation)(queryBuilder, props.propertyPath);
                    // For plain and relation columns fixColumnAlias returns `<alias>.<column>`
                    // with a single dot. Escape each identifier so camel-cased columns work
                    // on case-folding drivers (e.g. Postgres), since this raw expression is
                    // added to the SELECT list and is not escaped by the query builder.
                    const ref = (0, helper_1.fixColumnAlias)(props, queryBuilder.alias, isRelation, false, false, undefined, queryBuilder);
                    const separator = ref.indexOf('.');
                    return `${escape(ref.slice(0, separator))}.${escape(ref.slice(separator + 1))}`;
                })
                    .join(', ')})`;
                const polymorphAlias = `_polymorph_${sortColumn.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`.toLowerCase();
                queryBuilder.addSelect(coalesceExpr, polymorphAlias);
                if (isMySqlOrMariaDb) {
                    if (nullSort) {
                        const selectionAliasName = `${polymorphAlias}IsNull`;
                        queryBuilder.addSelect(`${coalesceExpr} ${nullSort}`, selectionAliasName);
                        queryBuilder.addOrderBy(selectionAliasName);
                    }
                    queryBuilder.addOrderBy(polymorphAlias, sortDirection);
                }
                else {
                    queryBuilder.addOrderBy(polymorphAlias, sortDirection, nullSort);
                }
                continue;
            }
            const columnProperties = (0, helper_1.getPropertiesByColumnName)(sortColumn);
            const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(queryBuilder, columnProperties);
            const isRelation = (0, helper_1.checkIsRelation)(queryBuilder, columnProperties.propertyPath);
            const isEmbedded = (0, helper_1.checkIsEmbedded)(queryBuilder, columnProperties.propertyPath);
            const jsonbResolution = (0, helper_1.resolveJsonbPath)(queryBuilder, columnProperties.column);
            const isJsonbPath = jsonbResolution.isJsonb && jsonbResolution.jsonPath.length > 0;
            let alias = (0, helper_1.fixColumnAlias)(columnProperties, queryBuilder.alias, isRelation, isVirtualProperty, isEmbedded, undefined, queryBuilder);
            if ((isVirtualProperty && virtualQuery && !isMySqlOrMariaDb) || isJsonbPath) {
                const subqueryExpr = isJsonbPath
                    ? alias // fixColumnAlias already returns the extraction expression
                    : (0, helper_1.fixColumnAlias)(columnProperties, queryBuilder.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, queryBuilder);
                const vcSortAlias = isJsonbPath
                    ? `${queryBuilder.alias}_jsonb_${columnProperties.column.replace(/[^a-zA-Z0-9]/g, '_')}_sort`.toLowerCase()
                    : `${alias}_vc_sort`.toLowerCase();
                queryBuilder.addSelect(subqueryExpr, vcSortAlias);
                alias = vcSortAlias;
            }
            else if (isVirtualProperty) {
                alias = (0, helper_1.quoteColumn)(alias, isMySqlOrMariaDb);
            }
            if (isMySqlOrMariaDb) {
                if (nullSort) {
                    const selectionAliasName = `${alias.replace(/\./g, '_')}IsNull`;
                    queryBuilder.addSelect(`${alias} ${nullSort}`, selectionAliasName);
                    queryBuilder.addOrderBy(selectionAliasName);
                }
                queryBuilder.addOrderBy(alias, order[1]);
            }
            else {
                queryBuilder.addOrderBy(alias, order[1], nullSort);
            }
        }
    }
    /**
     * Expands select parameters containing wildcards (*) into actual column lists
     *
     * @returns Array of expanded column names
     */
    const expandWildcardSelect = (selectParams, queryBuilder) => {
        const expandedParams = [];
        const mainAlias = queryBuilder.expressionMap.mainAlias;
        const mainMetadata = mainAlias.metadata;
        /**
         * Internal function to expand wildcards
         *
         * @returns Array of expanded column names
         */
        const _expandWidcard = (entityPath, metadata) => {
            const expanded = [];
            // Add all columns from the relation entity
            expanded.push(...metadata.columns
                .filter((col) => !metadata.embeddeds
                .map((embedded) => embedded.columns.map((embeddedCol) => embeddedCol.propertyName))
                .flat()
                .includes(col.propertyName))
                .map((col) => (entityPath ? `${entityPath}.${col.propertyName}` : col.propertyName)));
            // Add columns from embedded entities in the relation
            metadata.embeddeds.forEach((embedded) => {
                expanded.push(...embedded.columns.map((col) => `${entityPath}.(${embedded.propertyName}.${col.propertyName})`));
            });
            return expanded;
        };
        for (const param of selectParams) {
            if (param === '*') {
                expandedParams.push(..._expandWidcard('', mainMetadata));
            }
            else if (param.endsWith('.*')) {
                // Handle relation entity wildcards (e.g. 'user.*', 'user.profile.*')
                const parts = param.slice(0, -2).split('.');
                let currentPath = '';
                let currentMetadata = mainMetadata;
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    currentPath = currentPath ? `${currentPath}.${part}` : part;
                    const relation = currentMetadata.findRelationWithPropertyPath(part);
                    if (relation) {
                        currentMetadata = relation.inverseEntityMetadata;
                        if (i === parts.length - 1) {
                            // Expand wildcard at the last part
                            expandedParams.push(..._expandWidcard(currentPath, currentMetadata));
                        }
                    }
                    else {
                        break;
                    }
                }
            }
            else {
                // Add regular columns as is
                expandedParams.push(param);
            }
        }
        // Remove duplicates while preserving order
        return [...new Set(expandedParams)];
    };
    const selectParams = (() => {
        // Expand wildcards in config.select if it exists
        const expandedConfigSelect = config.select ? expandWildcardSelect(config.select, queryBuilder) : undefined;
        // Expand wildcards in query.select if it exists
        const expandedQuerySelect = query.select ? expandWildcardSelect(query.select, queryBuilder) : undefined;
        // Filter config.select with expanded query.select if both exist and ignoreSelectInQueryParam is false
        if (expandedConfigSelect && expandedQuerySelect && !config.ignoreSelectInQueryParam) {
            return expandedConfigSelect.filter((column) => expandedQuerySelect.includes(column));
        }
        return expandedConfigSelect;
    })();
    if ((selectParams === null || selectParams === void 0 ? void 0 : selectParams.length) > 0) {
        let cols = selectParams.reduce((cols, currentCol) => {
            const columnProperties = (0, helper_1.getPropertiesByColumnName)(currentCol);
            const isRelation = (0, helper_1.checkIsRelation)(queryBuilder, columnProperties.propertyPath);
            cols.push((0, helper_1.fixColumnAlias)(columnProperties, queryBuilder.alias, isRelation, false, false, undefined, queryBuilder));
            return cols;
        }, []);
        const missingPrimaryKeys = (0, helper_1.getMissingPrimaryKeyColumns)(queryBuilder, cols);
        if (missingPrimaryKeys.length > 0) {
            cols = cols.concat(missingPrimaryKeys);
        }
        queryBuilder.select(cols);
    }
    if (config.where && (0, helper_1.isRepository)(repo)) {
        const baseWhereStr = generateWhereStatement(queryBuilder, config.where);
        queryBuilder.andWhere(`(${baseWhereStr})`);
    }
    if (config.searchableColumns) {
        if (query.searchBy && !config.ignoreSearchByInQueryParam) {
            for (const column of query.searchBy) {
                if ((0, helper_1.isEntityKey)(config.searchableColumns, column)) {
                    searchBy.push(column);
                }
            }
        }
        else {
            searchBy.push(...config.searchableColumns);
        }
    }
    if (query.search && searchBy.length) {
        queryBuilder.andWhere(new typeorm_1.Brackets((qb) => {
            var _a;
            // Explicitly handle the default case - multiWordSearch defaults to false
            const useMultiWordSearch = (_a = config.multiWordSearch) !== null && _a !== void 0 ? _a : false;
            if (!useMultiWordSearch) {
                // Strict search mode (default behavior)
                for (const column of searchBy) {
                    const property = (0, helper_1.getPropertiesByColumnName)(column);
                    const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(qb, property);
                    const isRelation = (0, helper_1.checkIsRelation)(qb, property.propertyPath);
                    const isEmbedded = (0, helper_1.checkIsEmbedded)(qb, property.propertyPath);
                    const alias = (0, helper_1.fixColumnAlias)(property, qb.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, qb);
                    const condition = {
                        operator: 'ilike',
                        parameters: [alias, `:${property.column}`],
                    };
                    if (['postgres', 'cockroachdb'].includes(queryBuilder.connection.options.type)) {
                        condition.parameters[0] = `CAST(${condition.parameters[0]} AS text)`;
                    }
                    qb.orWhere(qb['createWhereConditionExpression'](condition), {
                        [property.column]: `%${query.search}%`,
                    });
                }
            }
            else {
                // Multi-word search mode
                const searchWords = query.search.split(' ').filter((word) => word.length > 0);
                searchWords.forEach((searchWord, index) => {
                    qb.andWhere(new typeorm_1.Brackets((subQb) => {
                        for (const column of searchBy) {
                            const property = (0, helper_1.getPropertiesByColumnName)(column);
                            const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(subQb, property);
                            const isRelation = (0, helper_1.checkIsRelation)(subQb, property.propertyPath);
                            const isEmbedded = (0, helper_1.checkIsEmbedded)(subQb, property.propertyPath);
                            const alias = (0, helper_1.fixColumnAlias)(property, subQb.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, subQb);
                            const condition = {
                                operator: 'ilike',
                                parameters: [alias, `:${property.column}_${index}`],
                            };
                            if (['postgres', 'cockroachdb'].includes(queryBuilder.connection.options.type)) {
                                condition.parameters[0] = `CAST(${condition.parameters[0]} AS text)`;
                            }
                            subQb.orWhere(subQb['createWhereConditionExpression'](condition), {
                                [`${property.column}_${index}`]: `%${searchWord}%`,
                            });
                        }
                    }));
                });
            }
        }));
    }
    if (query.limit === PaginationLimit.COUNTER_ONLY) {
        totalItems = await queryBuilder.getCount();
    }
    else if (isPaginated && config.paginationType !== PaginationType.CURSOR) {
        if (config.buildCountQuery) {
            items = await queryBuilder.getMany();
            totalItems = await config.buildCountQuery(queryBuilder.clone()).getCount();
        }
        else {
            ;
            [items, totalItems] = await queryBuilder.getManyAndCount();
        }
    }
    else {
        items = await queryBuilder.getMany();
    }
    const sortByQuery = sortBy.map((order) => `&sortBy=${order.join(':')}`).join('');
    const searchQuery = query.search ? `&search=${query.search}` : '';
    const searchByQuery = query.searchBy && searchBy.length && !config.ignoreSearchByInQueryParam
        ? searchBy.map((column) => `&searchBy=${column}`).join('')
        : '';
    // Only expose select in meta data if query select differs from config select
    const isQuerySelected = (selectParams === null || selectParams === void 0 ? void 0 : selectParams.length) !== ((_c = config.select) === null || _c === void 0 ? void 0 : _c.length);
    const selectQuery = isQuerySelected ? `&select=${selectParams.join(',')}` : '';
    const filterQuery = query.filter
        ? '&' +
            (0, querystring_1.stringify)((0, lodash_1.mapKeys)(query.filter, (_param, name) => 'filter.' + name), '&', '=', { encodeURIComponent: (str) => str })
        : '';
    const options = `&limit=${limit}${sortByQuery}${searchQuery}${searchByQuery}${selectQuery}${filterQuery}`;
    let path = null;
    if (query.path !== null) {
        // `query.path` does not exist in RPC/WS requests and is set to null then.
        const { queryOrigin, queryPath } = (0, helper_1.getQueryUrlComponents)(query.path);
        if (config.relativePath) {
            path = queryPath;
        }
        else if ((0, helper_1.isNotNil)(config.origin)) {
            path = config.origin + queryPath;
        }
        else {
            path = ((0, helper_1.isNil)(global_config_1.default.defaultOrigin) ? queryOrigin : global_config_1.default.defaultOrigin) + queryPath;
        }
    }
    const buildLink = (p) => path + '?page=' + p + options;
    const reversedSortBy = sortBy.map(([col, dir]) => [col, dir === 'ASC' ? 'DESC' : 'ASC']);
    const buildLinkForCursor = (cursor, isReversed = false) => {
        let adjustedOptions = options;
        if (isReversed && sortBy.length > 0) {
            adjustedOptions = `&limit=${limit}${reversedSortBy
                .map((order) => `&sortBy=${order.join(':')}`)
                .join('')}${searchQuery}${searchByQuery}${selectQuery}${filterQuery}`;
        }
        return path + adjustedOptions.replace(/^./, '?') + (cursor ? `&cursor=${cursor}` : '');
    };
    const itemsPerPage = limit === PaginationLimit.COUNTER_ONLY ? totalItems : isPaginated ? limit : items.length;
    const totalItemsForMeta = limit === PaginationLimit.COUNTER_ONLY || isPaginated ? totalItems : items.length;
    const totalPages = isPaginated ? Math.ceil(totalItems / limit) : 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const results = {
        data: items,
        meta: {
            itemsPerPage: config.paginationType === PaginationType.CURSOR ? items.length : itemsPerPage,
            totalItems: config.paginationType === PaginationType.CURSOR ? undefined : totalItemsForMeta,
            currentPage: config.paginationType === PaginationType.CURSOR ? undefined : currentPage,
            totalPages: config.paginationType === PaginationType.CURSOR ? undefined : totalPages,
            sortBy,
            search: query.search,
            searchBy: query.search ? searchBy : undefined,
            select: isQuerySelected ? selectParams : undefined,
            filter: query.filter,
            cursor: config.paginationType === PaginationType.CURSOR ? query.cursor : undefined,
        },
        // If there is no `path`, don't build links.
        links: path !== null
            ? config.paginationType === PaginationType.CURSOR
                ? {
                    previous: items.length
                        ? buildLinkForCursor(generateCursor(items[0], reversedSortBy, 'previous'), true)
                        : undefined,
                    current: buildLinkForCursor(query.cursor),
                    next: items.length
                        ? buildLinkForCursor(generateCursor(items[items.length - 1], sortBy))
                        : undefined,
                }
                : {
                    first: currentPage == 1 ? undefined : buildLink(1),
                    previous: currentPage - 1 < 1 ? undefined : buildLink(currentPage - 1),
                    current: buildLink(currentPage),
                    next: currentPage + 1 > totalPages ? undefined : buildLink(currentPage + 1),
                    last: currentPage == totalPages || !totalItems ? undefined : buildLink(totalPages),
                }
            : {},
    };
    return Object.assign(new Paginated(), results);
}
function addRelationsFromSchema(queryBuilder, schema, joinMethods, defaultJoinMethod = 'leftJoinAndSelect') {
    const createQueryBuilderRelations = (prefix, relations, alias, parentRelation) => {
        Object.keys(relations).forEach((relationName) => {
            var _a;
            const joinMethod = (_a = joinMethods[parentRelation ? `${parentRelation}.${relationName}` : relationName]) !== null && _a !== void 0 ? _a : defaultJoinMethod;
            queryBuilder[joinMethod](`${alias !== null && alias !== void 0 ? alias : prefix}.${relationName}`, `${alias !== null && alias !== void 0 ? alias : prefix}_${relationName}_rel`);
            // Check whether this is a non-terminal node with a relation schema to load
            const relationSchema = relations[relationName];
            if (typeof relationSchema === 'object' &&
                relationSchema !== null &&
                Object.keys(relationSchema).length > 0) {
                createQueryBuilderRelations(relationName, relationSchema, `${alias !== null && alias !== void 0 ? alias : prefix}_${relationName}_rel`, parentRelation ? `${parentRelation}.${relationName}` : relationName);
            }
        });
    };
    createQueryBuilderRelations(queryBuilder.alias, schema);
}
//# sourceMappingURL=paginate.js.map