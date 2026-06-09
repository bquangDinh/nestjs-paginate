"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positiveNumberOrDefault = void 0;
exports.isEntityKey = isEntityKey;
exports.getPropertiesByColumnName = getPropertiesByColumnName;
exports.extractVirtualProperty = extractVirtualProperty;
exports.includesAllPrimaryKeyColumns = includesAllPrimaryKeyColumns;
exports.getPrimaryKeyColumns = getPrimaryKeyColumns;
exports.getMissingPrimaryKeyColumns = getMissingPrimaryKeyColumns;
exports.hasColumnWithPropertyPath = hasColumnWithPropertyPath;
exports.checkIsRelation = checkIsRelation;
exports.checkIsNestedRelation = checkIsNestedRelation;
exports.checkIsOneOfNestedPrimaryColumns = checkIsOneOfNestedPrimaryColumns;
exports.checkIsEmbedded = checkIsEmbedded;
exports.checkIsArray = checkIsArray;
exports.checkIsJsonb = checkIsJsonb;
exports.resolveJsonbPath = resolveJsonbPath;
exports.fixColumnAlias = fixColumnAlias;
exports.getQueryUrlComponents = getQueryUrlComponents;
exports.isISODate = isISODate;
exports.isRepository = isRepository;
exports.isFindOperator = isFindOperator;
exports.createRelationSchema = createRelationSchema;
exports.mergeRelationSchema = mergeRelationSchema;
exports.getPaddedExpr = getPaddedExpr;
exports.isDateColumnType = isDateColumnType;
exports.quoteColumn = quoteColumn;
exports.isNil = isNil;
exports.isNotNil = isNotNil;
exports.andWhereNoneExist = andWhereNoneExist;
exports.andWhereAllExist = andWhereAllExist;
const lodash_1 = require("lodash");
const typeorm_1 = require("typeorm");
function isEntityKey(entityColumns, column) {
    return !!entityColumns.find((c) => c === column);
}
const positiveNumberOrDefault = (value, defaultValue, minValue = 0) => value === undefined || value < minValue ? defaultValue : value;
exports.positiveNumberOrDefault = positiveNumberOrDefault;
function getPropertiesByColumnName(column) {
    const propertyPath = column.split('.');
    if (propertyPath.length > 1) {
        const propertyNamePath = propertyPath.slice(1);
        let isNested = false, propertyName = propertyNamePath.join('.');
        if (!propertyName.startsWith('(') && propertyNamePath.length > 1) {
            isNested = true;
        }
        propertyName = propertyName.replace('(', '').replace(')', '');
        return {
            propertyPath: propertyPath[0],
            propertyName, // the join is in case of an embedded entity
            isNested,
            column: `${propertyPath[0]}.${propertyName}`,
        };
    }
    else {
        return { propertyName: propertyPath[0], isNested: false, column: propertyPath[0] };
    }
}
function extractVirtualProperty(qb, columnProperties) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const metadata = columnProperties.propertyPath
        ? (_e = (_d = (_c = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.findColumnWithPropertyPath(columnProperties.propertyPath)) === null || _d === void 0 ? void 0 : _d.referencedColumn) === null || _e === void 0 ? void 0 : _e.entityMetadata // on relation
        : (_g = (_f = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _f === void 0 ? void 0 : _f.mainAlias) === null || _g === void 0 ? void 0 : _g.metadata;
    return (((_h = metadata === null || metadata === void 0 ? void 0 : metadata.columns) === null || _h === void 0 ? void 0 : _h.find((column) => column.propertyName === columnProperties.propertyName)) || {
        isVirtualProperty: false,
        query: undefined,
    });
}
function includesAllPrimaryKeyColumns(qb, propertyPath) {
    var _a, _b;
    if (!qb || !propertyPath) {
        return false;
    }
    return (_b = (_a = qb.expressionMap.mainAlias) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.primaryColumns.map((column) => column.propertyPath).every((column) => propertyPath.includes(column));
}
function getPrimaryKeyColumns(qb, entityName) {
    var _a, _b;
    return (_b = (_a = qb.expressionMap.mainAlias) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.primaryColumns.map((column) => entityName ? `${entityName}.${column.propertyName}` : column.propertyName);
}
function getMissingPrimaryKeyColumns(qb, transformedCols) {
    if (!transformedCols || transformedCols.length === 0)
        return [];
    const mainEntityPrimaryKeys = getPrimaryKeyColumns(qb);
    const missingPrimaryKeys = [];
    for (const pk of mainEntityPrimaryKeys) {
        const columnProperties = getPropertiesByColumnName(pk);
        const pkAlias = fixColumnAlias(columnProperties, qb.alias, false, false, false, undefined, qb);
        if (!transformedCols.includes(pkAlias)) {
            missingPrimaryKeys.push(pkAlias);
        }
    }
    return missingPrimaryKeys;
}
function hasColumnWithPropertyPath(qb, columnProperties) {
    var _a, _b;
    if (!qb || !columnProperties) {
        return false;
    }
    return !!((_b = (_a = qb.expressionMap.mainAlias) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.hasColumnWithPropertyPath(columnProperties.propertyName));
}
function checkIsRelation(qb, propertyPath) {
    var _a, _b, _c;
    if (!qb || !propertyPath) {
        return false;
    }
    return !!((_c = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.hasRelationWithPropertyPath(propertyPath));
}
function checkIsNestedRelation(qb, propertyPath) {
    var _a, _b;
    let metadata = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata;
    for (const relationName of propertyPath.split('.')) {
        const relation = metadata === null || metadata === void 0 ? void 0 : metadata.relations.find((relation) => relation.propertyPath === relationName);
        if (!relation) {
            return false;
        }
        metadata = relation.inverseEntityMetadata;
    }
    return true;
}
function checkIsOneOfNestedPrimaryColumns(qb, propertyPath) {
    var _a, _b;
    let metadata = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata;
    const [deepestProperty, ...subRelations] = propertyPath.split('.').reverse();
    for (const relationName of subRelations.reverse()) {
        const relation = metadata === null || metadata === void 0 ? void 0 : metadata.relations.find((relation) => relation.propertyPath === relationName);
        if (!relation) {
            return false;
        }
        metadata = relation.inverseEntityMetadata;
    }
    return !!metadata.primaryColumns.find((col) => col.propertyName === deepestProperty);
}
function checkIsEmbedded(qb, propertyPath) {
    var _a, _b, _c;
    if (!qb || !propertyPath) {
        return false;
    }
    return !!((_c = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.hasEmbeddedWithPropertyPath(propertyPath));
}
function checkIsArray(qb, propertyName) {
    var _a, _b, _c;
    if (!qb || !propertyName) {
        return false;
    }
    return !!((_c = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata.findColumnWithPropertyName(propertyName)) === null || _c === void 0 ? void 0 : _c.isArray);
}
function checkIsJsonb(qb, propertyName) {
    if (!qb || !propertyName) {
        return false;
    }
    const resolution = resolveJsonbPath(qb, propertyName);
    return resolution.isJsonb;
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
function resolveJsonbPath(qb, column) {
    var _a, _b, _c, _d, _e;
    const notJsonb = { isJsonb: false, relationPath: [], jsonbColumn: '', jsonPath: [] };
    if (!qb || !column) {
        return notJsonb;
    }
    const parts = column.split('.');
    // A plain column name without dots is not a JSONB path — callers use checkIsJsonb directly.
    if (parts.length < 2) {
        return notJsonb;
    }
    let metadata = (_b = (_a = qb === null || qb === void 0 ? void 0 : qb.expressionMap) === null || _a === void 0 ? void 0 : _a.mainAlias) === null || _b === void 0 ? void 0 : _b.metadata;
    const relationPath = [];
    for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        const relation = (_c = metadata === null || metadata === void 0 ? void 0 : metadata.relations) === null || _c === void 0 ? void 0 : _c.find((r) => r.propertyPath === segment);
        if (relation) {
            relationPath.push(segment);
            metadata = relation.inverseEntityMetadata;
        }
        else {
            // Not a relation — check whether it is a JSONB column
            const isJsonbColumn = ((_d = metadata === null || metadata === void 0 ? void 0 : metadata.findColumnWithPropertyName(segment)) === null || _d === void 0 ? void 0 : _d.type) === 'jsonb';
            if (!isJsonbColumn) {
                return notJsonb;
            }
            return {
                isJsonb: true,
                relationPath,
                jsonbColumn: segment,
                jsonPath: parts.slice(i + 1),
            };
        }
    }
    // All segments except the last were relations; the last segment must be a JSONB column.
    const lastSegment = parts[parts.length - 1];
    const isJsonbColumn = ((_e = metadata === null || metadata === void 0 ? void 0 : metadata.findColumnWithPropertyName(lastSegment)) === null || _e === void 0 ? void 0 : _e.type) === 'jsonb';
    if (isJsonbColumn) {
        return {
            isJsonb: true,
            relationPath,
            jsonbColumn: lastSegment,
            jsonPath: [],
        };
    }
    return notJsonb;
}
// This function is used to fix the column alias when using relation, embedded or virtual properties
function fixColumnAlias(properties, alias, isRelation = false, isVirtualProperty = false, isEmbedded = false, query, qb) {
    let jsonbResolution;
    if (qb) {
        jsonbResolution = resolveJsonbPath(qb, properties.column);
    }
    if (jsonbResolution && jsonbResolution.isJsonb) {
        const baseColumnProperties = getPropertiesByColumnName([...jsonbResolution.relationPath, jsonbResolution.jsonbColumn].join('.'));
        const baseAlias = fixColumnAlias(baseColumnProperties, alias, jsonbResolution.relationPath.length > 0, isVirtualProperty, isEmbedded, query);
        if (jsonbResolution.jsonPath.length === 0) {
            return baseAlias;
        }
        const dbType = qb.connection.options.type;
        if (dbType === 'postgres' || dbType === 'cockroachdb') {
            const pathLiteral = jsonbResolution.jsonPath.join(',');
            return `${baseAlias} #>> '{${pathLiteral}}'`;
        }
        else if (dbType === 'mysql' || dbType === 'mariadb') {
            const mysqlPath = jsonbResolution.jsonPath.map((p) => `"${p}"`).join('.');
            return `JSON_UNQUOTE(JSON_EXTRACT(${baseAlias}, '$.${mysqlPath}'))`;
        }
        else {
            const sqlitePath = jsonbResolution.jsonPath.map((p) => `"${p}"`).join('.');
            return `json_extract(${baseAlias}, '$.${sqlitePath}')`;
        }
    }
    if (isRelation) {
        if (isVirtualProperty && query) {
            return `(${query(`${alias}_${properties.propertyPath}_rel`)})`; // () is needed to avoid parameter conflict
        }
        else if ((isVirtualProperty && !query) || properties.isNested) {
            if (properties.propertyName.includes('.')) {
                const propertyPath = properties.propertyName.split('.');
                const nestedRelations = propertyPath
                    .slice(0, -1)
                    .map((v) => `${v}_rel`)
                    .join('_');
                const nestedCol = propertyPath[propertyPath.length - 1];
                return `${alias}_${properties.propertyPath}_rel_${nestedRelations}.${nestedCol}`;
            }
            else {
                return `${alias}_${properties.propertyPath}_rel_${properties.propertyName}`;
            }
        }
        else {
            return `${alias}_${properties.propertyPath}_rel.${properties.propertyName}`;
        }
    }
    else if (isVirtualProperty) {
        return query ? `(${query(`${alias}`)})` : `${alias}_${properties.propertyName}`;
    }
    else if (isEmbedded) {
        return `${alias}.${properties.propertyPath}.${properties.propertyName}`;
    }
    else {
        return `${alias}.${properties.propertyName}`;
    }
}
function getQueryUrlComponents(path) {
    const r = new RegExp('^(?:[a-z+]+:)?//', 'i');
    let queryOrigin = '';
    let queryPath = '';
    if (r.test(path)) {
        const url = new URL(path);
        queryOrigin = url.origin;
        queryPath = url.pathname;
    }
    else {
        queryPath = path;
    }
    return { queryOrigin, queryPath };
}
const isoDateRegExp = new RegExp(/^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/);
function isISODate(str) {
    return isoDateRegExp.test(str);
}
function isRepository(repo) {
    if (repo instanceof typeorm_1.Repository)
        return true;
    try {
        if (Object.getPrototypeOf(repo).constructor.name === 'Repository')
            return true;
        return typeof repo === 'object' && !('connection' in repo) && 'manager' in repo;
    }
    catch (_a) {
        return false;
    }
}
function isFindOperator(value) {
    if (value instanceof typeorm_1.FindOperator)
        return true;
    try {
        if (Object.getPrototypeOf(value).constructor.name === 'FindOperator')
            return true;
        return typeof value === 'object' && '_type' in value && '_value' in value;
    }
    catch (_a) {
        return false;
    }
}
function createRelationSchema(configurationRelations) {
    return Array.isArray(configurationRelations)
        ? configurationRelations.reduce((relationSchema, relationPath) => {
            relationSchema[relationPath] = true;
            return relationSchema;
        }, {})
        : configurationRelations;
}
function mergeRelationSchema(...schemas) {
    const noTrueOverride = (obj, source) => (source === true && obj !== undefined ? obj : undefined);
    return (0, lodash_1.mergeWith)({}, ...schemas, noTrueOverride);
}
function getPaddedExpr(valueExpr, length, dbType) {
    const lengthStr = String(length);
    if (dbType === 'postgres' || dbType === 'cockroachdb') {
        return `LPAD((${valueExpr})::bigint::text, ${lengthStr}, '0')`;
    }
    else if (dbType === 'mysql' || dbType === 'mariadb') {
        return `LPAD(${valueExpr}, ${lengthStr}, '0')`;
    }
    else {
        // sqlite
        const padding = '0'.repeat(length);
        return `SUBSTR('${padding}' || CAST(${valueExpr} AS INTEGER), -${lengthStr}, ${lengthStr})`;
    }
}
function isDateColumnType(type) {
    const dateTypes = [
        Date, // JavaScript Date class
        'datetime',
        'timestamp',
        'timestamptz',
    ];
    return dateTypes.includes(type);
}
function quoteColumn(columnName, isMySqlOrMariaDb) {
    return isMySqlOrMariaDb ? `\`${columnName}\`` : `"${columnName}"`;
}
function isNil(v) {
    return v === null || v === undefined;
}
function isNotNil(v) {
    return !isNil(v);
}
function andWhereNoneExist(qb, existsQb) {
    const [query, params] = qb['getExistsCondition'](existsQb);
    return qb.andWhere(`NOT ${query}`, params);
}
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
function andWhereAllExist(qb, existsQb) {
    qb = qb.andWhereExists(existsQb);
    const [query, params] = qb['getExistsCondition'](existsQb);
    // The getExistsCondition clears anything that comes after WHERE, and our joining logic does not contain WHERE,
    // so it should be safe to replace the first WHERE with WHERE NOT (...) and get a correct query.
    const existsWhereNot = query.replace('WHERE', 'WHERE NOT (') + ')';
    return qb.andWhere(`NOT ${existsWhereNot}`, params);
}
//# sourceMappingURL=helper.js.map