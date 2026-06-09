"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPEORM_PARAM_REGEX = exports.OperatorSymbolToFunction = exports.FilterComparator = exports.FilterQuantifier = exports.FilterSuffix = exports.FilterOperator = void 0;
exports.isOperator = isOperator;
exports.isSuffix = isSuffix;
exports.isQuantifier = isQuantifier;
exports.isComparator = isComparator;
exports.hasExplicitAndComparator = hasExplicitAndComparator;
exports.fixQueryParam = fixQueryParam;
exports.generatePredicateCondition = generatePredicateCondition;
exports.addWhereCondition = addWhereCondition;
exports.parseFilterToken = parseFilterToken;
exports.parseFilter = parseFilter;
exports.getRelationPath = getRelationPath;
exports.addFilter = addFilter;
exports.addDirectFilters = addDirectFilters;
exports.addToManySubFilters = addToManySubFilters;
exports.createSubFilter = createSubFilter;
const common_1 = require("@nestjs/common");
const lodash_1 = require("lodash");
const typeorm_1 = require("typeorm");
const helper_1 = require("./helper");
const paginate_1 = require("./paginate");
var FilterOperator;
(function (FilterOperator) {
    FilterOperator["EQ"] = "$eq";
    FilterOperator["GT"] = "$gt";
    FilterOperator["GTE"] = "$gte";
    FilterOperator["IN"] = "$in";
    FilterOperator["NULL"] = "$null";
    FilterOperator["LT"] = "$lt";
    FilterOperator["LTE"] = "$lte";
    FilterOperator["BTW"] = "$btw";
    FilterOperator["ILIKE"] = "$ilike";
    FilterOperator["SW"] = "$sw";
    FilterOperator["CONTAINS"] = "$contains";
})(FilterOperator || (exports.FilterOperator = FilterOperator = {}));
function isOperator(value) {
    return (0, lodash_1.values)(FilterOperator).includes(value);
}
var FilterSuffix;
(function (FilterSuffix) {
    // Used to negate a filter
    FilterSuffix["NOT"] = "$not";
})(FilterSuffix || (exports.FilterSuffix = FilterSuffix = {}));
function isSuffix(value) {
    return (0, lodash_1.values)(FilterSuffix).includes(value);
}
var FilterQuantifier;
(function (FilterQuantifier) {
    FilterQuantifier["ALL"] = "$all";
    FilterQuantifier["ANY"] = "$any";
    FilterQuantifier["NONE"] = "$none";
})(FilterQuantifier || (exports.FilterQuantifier = FilterQuantifier = {}));
function isQuantifier(value) {
    return (0, lodash_1.values)(FilterQuantifier).includes(value);
}
var FilterComparator;
(function (FilterComparator) {
    FilterComparator["AND"] = "$and";
    FilterComparator["OR"] = "$or";
})(FilterComparator || (exports.FilterComparator = FilterComparator = {}));
function isComparator(value) {
    return (0, lodash_1.values)(FilterComparator).includes(value);
}
/**
 * Returns true when the raw filter string explicitly carries the `$and` comparator token.
 *
 * This is distinct from the default AND comparator that every token carries implicitly —
 * we only want to enter AND-mode when the user deliberately wrote `$and:` in the filter value.
 * Using `parseFilterToken` (rather than a naive substring split) ensures that `$and` embedded
 * inside a user value (e.g. `$eq:$and`) is not misidentified as the comparator.
 *
 * Must be called after `parseFilterToken` is defined (hoisting applies to function declarations).
 */
function hasExplicitAndComparator(raw) {
    const token = parseFilterToken(raw);
    if (!token)
        return false;
    if (token.comparator !== FilterComparator.AND)
        return false;
    // The default token comparator is AND, so we must confirm the user actually wrote `$and` as a
    // colon-delimited token segment. We reconstruct the consumed prefix (everything before the value)
    // and check whether `$and` appears in it as a discrete segment.
    // This correctly rejects `$eq:$and` (value = `$and`, prefix = `$eq:`) and accepts `$and:Ball`.
    const valueSuffix = token.value !== undefined ? `:${token.value}` : '';
    const prefix = valueSuffix ? raw.slice(0, raw.length - valueSuffix.length) : raw;
    return prefix.split(':').some((seg) => seg === FilterComparator.AND);
}
exports.OperatorSymbolToFunction = new Map([
    [FilterOperator.EQ, typeorm_1.Equal],
    [FilterOperator.GT, typeorm_1.MoreThan],
    [FilterOperator.GTE, typeorm_1.MoreThanOrEqual],
    [FilterOperator.IN, typeorm_1.In],
    [FilterOperator.NULL, typeorm_1.IsNull],
    [FilterOperator.LT, typeorm_1.LessThan],
    [FilterOperator.LTE, typeorm_1.LessThanOrEqual],
    [FilterOperator.BTW, typeorm_1.Between],
    [FilterOperator.ILIKE, typeorm_1.ILike],
    [FilterSuffix.NOT, typeorm_1.Not],
    [FilterOperator.SW, typeorm_1.ILike],
    [FilterOperator.CONTAINS, typeorm_1.ArrayContains],
]);
/**
 * Matches TypeORM named parameters (`:name` and `:...name` spread form) while skipping
 * PostgreSQL cast syntax (`::type`).
 *
 * TypeORM parameter names may contain letters, digits, underscores, and dots (the latter
 * for embedded-property paths, e.g. `size.height0`). The pattern captures the full name
 * including any embedded-path dots.
 *
 * Capture groups:
 *   1 — optional `...` spread prefix (present for IN parameters)
 *   2 — parameter name (may contain dots for embedded paths)
 *
 * Examples:
 *   `:name`          → matches, spread=undefined, name='name'
 *   `:...vals`       → matches, spread='...', name='vals'
 *   `:size.height0`  → matches, spread=undefined, name='size.height0'
 *   `col::text`      → no match (lookbehind rejects `::`)
 *   `:param::int`    → matches `:param`, skips `::int`
 */
/** @internal Exported for testing only. */
exports.TYPEORM_PARAM_REGEX = /(?<!:):(\.\.\.)?([a-zA-Z0-9_.]+)/g;
// This function is used to fix the query parameters when using relation, embeded or virtual properties
// It will replace the column name with the alias name and return the new parameters
function fixQueryParam(alias, column, filter, condition, parameters) {
    const isNotOperator = condition.operator === 'not';
    const conditionFixer = (alias, column, filter, operator, parameters) => {
        let condition_params = undefined;
        let params = parameters;
        switch (operator) {
            case 'between':
                condition_params = [alias, `:${column}_from`, `:${column}_to`];
                params = {
                    [column + '_from']: filter.findOperator.value[0],
                    [column + '_to']: filter.findOperator.value[1],
                };
                break;
            case 'in':
                condition_params = [alias, `:...${column}`];
                break;
            default:
                condition_params = [alias, `:${column}`];
                break;
        }
        return { condition_params, params };
    };
    const { condition_params, params } = conditionFixer(alias, column, filter, isNotOperator ? condition['condition']['operator'] : condition.operator, parameters);
    if (isNotOperator) {
        condition['condition']['parameters'] = condition_params;
    }
    else {
        condition.parameters = condition_params;
    }
    return params;
}
function generatePredicateCondition(qb, column, filter, alias, isVirtualProperty = false) {
    return qb['getWherePredicateCondition'](isVirtualProperty ? column : alias, filter.findOperator);
}
function addWhereCondition(qb, column, filter) {
    const columnProperties = (0, helper_1.getPropertiesByColumnName)(column);
    const { isVirtualProperty, query: virtualQuery } = (0, helper_1.extractVirtualProperty)(qb, columnProperties);
    const isRelation = (0, helper_1.checkIsRelation)(qb, columnProperties.propertyPath);
    const isEmbedded = (0, helper_1.checkIsEmbedded)(qb, columnProperties.propertyPath);
    const isArray = (0, helper_1.checkIsArray)(qb, columnProperties.propertyName);
    const alias = (0, helper_1.fixColumnAlias)(columnProperties, qb.alias, isRelation, isVirtualProperty, isEmbedded, virtualQuery, qb);
    filter[column].forEach((columnFilter, index) => {
        var _a;
        const columnNamePerIteration = `${columnProperties.column}${index}`;
        const condition = generatePredicateCondition(qb, columnProperties.column, columnFilter, alias, isVirtualProperty);
        const parameters = fixQueryParam(alias, columnNamePerIteration, columnFilter, condition, {
            [columnNamePerIteration]: columnFilter.findOperator.value,
        });
        if (isArray &&
            ((_a = condition.parameters) === null || _a === void 0 ? void 0 : _a.length) &&
            !['not', 'isNull', 'arrayContains'].includes(condition.operator)) {
            condition.parameters[0] = `cardinality(${condition.parameters[0]})`;
        }
        const expression = qb['createWhereConditionExpression'](condition);
        if (columnFilter.comparator === FilterComparator.OR) {
            qb.orWhere(expression, parameters);
        }
        else {
            qb.andWhere(expression, parameters);
        }
    });
}
function parseFilterToken(raw) {
    if (raw === undefined || raw === null) {
        return null;
    }
    const token = {
        quantifier: FilterQuantifier.ANY,
        comparator: FilterComparator.AND,
        suffix: undefined,
        operator: FilterOperator.EQ,
        value: raw,
    };
    const MAX_OPERATOR = 5; // max 5 operator: $none:$and:$not:$eq:$null
    const OPERAND_SEPARATOR = ':';
    const matches = raw.split(OPERAND_SEPARATOR);
    const maxOperandCount = matches.length > MAX_OPERATOR ? MAX_OPERATOR : matches.length;
    const notValue = [];
    for (let i = 0; i < maxOperandCount; i++) {
        const match = matches[i];
        if (isQuantifier(match)) {
            token.quantifier = match;
        }
        else if (isComparator(match)) {
            token.comparator = match;
        }
        else if (isSuffix(match)) {
            token.suffix = match;
        }
        else if (isOperator(match)) {
            token.operator = match;
        }
        else {
            break;
        }
        notValue.push(match);
    }
    if (notValue.length) {
        token.value =
            !raw.includes(OPERAND_SEPARATOR) || token.operator === FilterOperator.NULL
                ? // things like `$null`, `$none`, and `$any`, have no token value
                    undefined
                : // otherwise, remove the operators and separators from the raw string to obtain the token value
                    raw.replace(`${notValue.join(OPERAND_SEPARATOR)}${OPERAND_SEPARATOR}`, '');
    }
    return token;
}
function fixColumnFilterValue(column, qb, isJsonb = false) {
    const columnProperties = (0, helper_1.getPropertiesByColumnName)(column);
    const virtualProperty = (0, helper_1.extractVirtualProperty)(qb, columnProperties);
    const columnType = virtualProperty.type;
    return (value) => {
        if (((0, helper_1.isDateColumnType)(columnType) || isJsonb) && (0, helper_1.isISODate)(value)) {
            return new Date(value);
        }
        if ((columnType === Number || columnType === 'number' || isJsonb) && !isNaN(Number(value))) {
            return Number(value);
        }
        return value;
    };
}
function parseFilter(query, filterableColumns, qb, throwOnInvalidFilter = false) {
    const filter = {};
    if (!filterableColumns || !query.filter) {
        return {};
    }
    for (const column of Object.keys(query.filter)) {
        if (!(column in filterableColumns)) {
            if (throwOnInvalidFilter) {
                throw new common_1.BadRequestException(`Column '${column}' is not filterable`);
            }
            continue;
        }
        const allowedOperators = filterableColumns[column];
        const input = query.filter[column];
        const statements = !Array.isArray(input) ? [input] : input;
        for (const raw of statements) {
            const token = parseFilterToken(raw);
            if (!token) {
                continue;
            }
            if (allowedOperators === true) {
                if (token.operator && !isOperator(token.operator)) {
                    if (throwOnInvalidFilter) {
                        throw new common_1.BadRequestException(`Invalid filter operator '${token.operator}' for column '${column}'`);
                    }
                    continue;
                }
                if (token.suffix && !isSuffix(token.suffix)) {
                    if (throwOnInvalidFilter) {
                        throw new common_1.BadRequestException(`Invalid filter suffix '${token.suffix}' for column '${column}'`);
                    }
                    continue;
                }
            }
            else {
                if (token.operator &&
                    token.operator !== FilterOperator.EQ &&
                    !allowedOperators.includes(token.operator)) {
                    if (throwOnInvalidFilter) {
                        throw new common_1.BadRequestException(`Filter operator '${token.operator}' is not allowed for column '${column}'`);
                    }
                    continue;
                }
                if (token.suffix && !allowedOperators.includes(token.suffix)) {
                    if (throwOnInvalidFilter) {
                        throw new common_1.BadRequestException(`Filter suffix '${token.suffix}' is not allowed for column '${column}'`);
                    }
                    continue;
                }
                if (token.quantifier !== FilterQuantifier.ANY && !allowedOperators.includes(token.quantifier)) {
                    continue;
                }
                // Gate the $and comparator: only allow it if explicitly listed in filterableColumns.
                // The default token comparator is AND (used for normal andWhere), so we must check
                // whether $and was explicitly present in the raw filter string, not just the token default.
                if (!allowedOperators.includes(FilterComparator.AND) && hasExplicitAndComparator(raw)) {
                    continue;
                }
            }
            const params = {
                quantifier: token.quantifier,
                comparator: token.comparator,
                findOperator: undefined,
            };
            const fixValue = fixColumnFilterValue(column, qb);
            const columnProperties = (0, helper_1.getPropertiesByColumnName)(column);
            const jsonbResolution = (0, helper_1.resolveJsonbPath)(qb, columnProperties.column);
            switch (token.operator) {
                case FilterOperator.BTW:
                    params.findOperator = exports.OperatorSymbolToFunction.get(token.operator)(...token.value.split(',').map(fixValue));
                    break;
                case FilterOperator.IN:
                case FilterOperator.CONTAINS:
                    params.findOperator = exports.OperatorSymbolToFunction.get(token.operator)(token.value.split(',').map((v) => fixValue(v.trim())));
                    break;
                case FilterOperator.ILIKE:
                    params.findOperator = exports.OperatorSymbolToFunction.get(token.operator)(`%${token.value}%`);
                    break;
                case FilterOperator.SW:
                    params.findOperator = exports.OperatorSymbolToFunction.get(token.operator)(`${token.value}%`);
                    break;
                default:
                    params.findOperator = exports.OperatorSymbolToFunction.get(token.operator)(fixValue(token.value));
            }
            if (jsonbResolution.isJsonb) {
                const supportJsonContains = [FilterOperator.EQ, FilterOperator.IN, FilterOperator.CONTAINS].includes(token.operator);
                if (supportJsonContains) {
                    const jsonFixValue = fixColumnFilterValue(column, qb, true);
                    // Use a stable filter key that preserves the relation path so that
                    // addWhereCondition can later resolve the correct JOIN alias.
                    // e.g. 'detail.referrer.source.platform' → filterKey = 'detail.referrer'
                    //      'metadata.length'                 → filterKey = 'metadata'
                    //      'underCoat.metadata.length'       → filterKey = 'underCoat.metadata'
                    const filterKey = [...jsonbResolution.relationPath, jsonbResolution.jsonbColumn].join('.');
                    // Build a JsonContains containment object for a single leaf value.
                    // e.g. jsonPath=['source','platform'], value='web' → { source: { platform: 'web' } }
                    //      jsonPath=['length'],            value=5     → { length: 5 }
                    const buildContainment = (rawValue) => {
                        const leafValue = jsonFixValue(rawValue);
                        return jsonbResolution.jsonPath.reduceRight((acc, key) => ({ [key]: acc }), leafValue);
                    };
                    if (token.operator === FilterOperator.IN) {
                        token.value.split(',').forEach((val, i) => {
                            filter[filterKey] = [
                                ...(filter[filterKey] || []),
                                {
                                    comparator: i === 0 ? params.comparator : FilterComparator.OR,
                                    findOperator: (0, typeorm_1.JsonContains)(buildContainment(val.trim())),
                                    quantifier: FilterQuantifier.ANY,
                                },
                            ];
                        });
                    }
                    else {
                        filter[filterKey] = [
                            ...(filter[filterKey] || []),
                            {
                                comparator: params.comparator,
                                findOperator: (0, typeorm_1.JsonContains)(buildContainment(token.value)),
                                quantifier: FilterQuantifier.ANY,
                            },
                        ];
                    }
                }
                else {
                    filter[column] = [...(filter[column] || []), params];
                }
            }
            else {
                filter[column] = [...(filter[column] || []), params];
            }
            // suffix ($not) is applied on the filter key used above.
            // For JSONB $in, $not must be applied to every expanded entry so that
            // NOT (col @> '{a}') AND NOT (col @> '{b}') is produced (NOT IN semantics).
            if (token.suffix) {
                const isJsonbAndSupportsJsonContains = jsonbResolution.isJsonb &&
                    [FilterOperator.EQ, FilterOperator.IN, FilterOperator.CONTAINS].includes(token.operator);
                const filterKey = isJsonbAndSupportsJsonContains
                    ? [...jsonbResolution.relationPath, jsonbResolution.jsonbColumn].join('.')
                    : column;
                const isJsonbIn = isJsonbAndSupportsJsonContains && token.operator === FilterOperator.IN;
                const applyFrom = isJsonbIn
                    ? filter[filterKey].length - token.value.split(',').length
                    : filter[filterKey].length - 1;
                for (let i = applyFrom; i < filter[filterKey].length; i++) {
                    filter[filterKey][i].findOperator = exports.OperatorSymbolToFunction.get(token.suffix)(filter[filterKey][i].findOperator);
                    // $not:$in means NOT IN — all expanded values are AND'd with NOT
                    if (isJsonbIn && i > applyFrom) {
                        filter[filterKey][i].comparator = FilterComparator.AND;
                    }
                }
            }
        }
    }
    return filter;
}
class RelationPathError extends Error {
}
/**
 * Retrieves the relation path for a given column name within the provided metadata.
 *
 * This method analyzes the column name's segments to identify corresponding relations or embedded entities
 * within the hierarchy described by the given metadata and returns a structured path.
 *
 * @param {string} columnName - The dot-delimited name of the column whose relation path is to be determined.
 * @param {EntityMetadata | EmbeddedMetadata} metadata - The metadata of the entity or embedded component
 * which holds the relations or embedded items.
 * @return {[string, RelationMetadata | EmbeddedMetadata][]} The ordered array describing the path,
 * where each element contains a field name and its corresponding relation or embedded metadata.
 * Throws an error if no matching relation or embedded metadata is found.
 */
function getRelationPath(columnName, metadata) {
    const relationSegments = columnName.split('.');
    const deeper = relationSegments.slice(1).join('.');
    const fieldName = relationSegments[0].replace(/[()]/g, '');
    try {
        // Check if there's a relation with this property name
        const relation = metadata.relations.find((r) => r.propertyName === fieldName);
        if (relation) {
            return [
                [fieldName, relation],
                ...(relationSegments.length > 1 ? getRelationPath(deeper, relation.inverseEntityMetadata) : []),
            ];
        }
        // Check if there's something embedded with this property name
        const embedded = metadata.embeddeds.find((embedded) => embedded.propertyName === fieldName);
        if (embedded) {
            return [
                [fieldName, embedded],
                ...(relationSegments.length > 1 ? getRelationPath(deeper, embedded) : []),
            ];
        }
    }
    catch (e) {
        if (e instanceof RelationPathError) {
            throw new RelationPathError(`No relation or embedded found for property path ${columnName}`);
        }
        throw e;
    }
    if (relationSegments.length > 1)
        throw new RelationPathError(`No relation or embedded found for property path ${columnName}`);
    return [];
}
/**
 * Finds the first 'to-many' relationship in a given entity metadata or embedded metadata
 * given a column name. A 'to-many' relationship can be either a one-to-many or a
 * many-to-many relationship.
 *
 * @param {string} columnName - The column name to traverse through its segments and find relationships.
 * @param {EntityMetadata | EmbeddedMetadata} metadata - The metadata of the entity or
 * embedded object in which relationships are defined.
 * @return {{ path: string[]; relation: RelationMetadata } | undefined} An object containing
 * the path to the 'to-many' relationship and the relationship metadata, or undefined if no
 * 'to-many' relationships are found.
 */
function findFirstToManyRelationship(columnName, metadata) {
    let relationPath;
    try {
        relationPath = getRelationPath(columnName, metadata);
    }
    catch (e) {
        if (e instanceof RelationPathError)
            return undefined;
        throw e;
    }
    const relationSegments = columnName.split('.');
    const firstToMany = relationPath.findIndex(([, relation]) => 'isOneToMany' in relation && (relation.isOneToMany || relation.isManyToMany));
    if (firstToMany > -1)
        return {
            path: relationSegments.slice(0, firstToMany + 1),
            relation: relationPath[firstToMany][1],
        };
}
function addFilter(qb, query, filterableColumns, opts = {}, throwOnInvalidFilter = false) {
    const mainMetadata = qb.expressionMap.mainAlias.metadata;
    const filter = parseFilter(query, filterableColumns, qb, throwOnInvalidFilter);
    addDirectFilters(qb, filter);
    addToManySubFilters(qb, filter, query, filterableColumns, opts);
    // Direct filters require to be joined, so pass the join information back up to the main pagination builder
    // (or the parent filter query in case of subfilters)
    const columnJoinMethods = {};
    for (const [key] of Object.entries(filter)) {
        const relationPath = getRelationPath(key, mainMetadata);
        // Skip filters that don't result in WHERE clauses and so don't need to be joined..
        if (relationPath.find(([, relation]) => 'isOneToMany' in relation && (relation.isOneToMany || relation.isManyToMany))) {
            continue;
        }
        for (let i = 0; i < relationPath.length; i++) {
            const column = relationPath
                .slice(0, i + 1)
                .map((p) => p[0])
                .join('.');
            // Skip joins on embedded entities
            if ('inverseRelation' in relationPath[i][1]) {
                columnJoinMethods[column] = 'innerJoinAndSelect';
            }
        }
    }
    return columnJoinMethods;
}
function addDirectFilters(qb, filter) {
    const filterEntries = Object.entries(filter);
    const metadata = qb.expressionMap.mainAlias.metadata;
    // Direct filters are those without toMany relationships on their path, and can be expressed as simple JOINs + WHERE clauses
    const whereFilters = filterEntries.filter(([key]) => !findFirstToManyRelationship(key, metadata));
    const orFilters = whereFilters.filter(([, value]) => value[0].comparator === '$or');
    const andFilters = whereFilters.filter(([, value]) => value[0].comparator === '$and');
    qb.andWhere(new typeorm_1.Brackets((qb) => {
        for (const [column] of orFilters) {
            addWhereCondition(qb, column, filter);
        }
    }));
    for (const [column] of andFilters) {
        qb.andWhere(new typeorm_1.Brackets((qb) => {
            addWhereCondition(qb, column, filter);
        }));
    }
}
/**
 * Adds correlated EXISTS subqueries to `qb` for all to-many relationship filters in `filter`.
 *
 * **AND-mode (`$and` comparator)**
 *
 * When a sub-column filter uses the `$and` comparator (e.g. `filter[toys.name]=$and:Ball`),
 * each distinct `$and` value produces a separate correlated EXISTS subquery, ANDed on the
 * outer query. This is the only correct way to express "entity has ALL of these related values"
 * — a single EXISTS with AND conditions on the same column is always false on a single row.
 *
 * **Performance note**: each `$and` value adds one correlated EXISTS with the full join chain
 * for that relation path. For a relation path of depth D and N `$and` values, this produces
 * N × D joins. The `maxAndValues` option (default 20) caps N to limit query complexity.
 *
 * **Restrictions**:
 * - `$and` may only be used on to-many relationship columns.
 * - `$and` values may not be mixed with non-`$and` values on the same sub-column.
 * - `$and` may not be combined with `$none` or `$all` quantifiers.
 * - `$and` may only be applied to a single sub-column per relation path at a time.
 */
function addToManySubFilters(qb, filter, query, filterableColumns, { maxAndValues = 20, validateAndComparator = true } = {}) {
    var _a, _b, _c;
    const dbType = qb.connection.options.type;
    const quote = (column) => (0, helper_1.quoteColumn)(column, ['mysql', 'mariadb'].includes(dbType));
    const mainMetadata = qb.expressionMap.mainAlias.metadata;
    const filterEntries = Object.entries(filter);
    // Filters with toMany relationships on their path need to be expressed as EXISTS subqueries.
    const existsFilters = filterEntries.map(([key]) => findFirstToManyRelationship(key, mainMetadata)).filter(Boolean);
    // Find all the different toMany starting paths
    const toManyPaths = [...new Set(existsFilters.map((f) => f.path.join('.')))];
    // Validate that $and is not used on scalar (non-to-many) columns — it has no meaningful
    // semantics there and would produce always-false conditions (e.g. WHERE name = 'a' AND name = 'b').
    // Skip this validation when called recursively for EXISTS subqueries (validateAndComparator = false),
    // because the sub-filter keys are already stripped of the relation prefix and the entity metadata
    // is the leaf entity, so the to-many check would incorrectly throw.
    if (validateAndComparator) {
        for (const [key, rawValues] of Object.entries((_a = query.filter) !== null && _a !== void 0 ? _a : {})) {
            const isToMany = findFirstToManyRelationship(key, mainMetadata) != null;
            if (!isToMany) {
                const values = Array.isArray(rawValues) ? rawValues : [rawValues];
                const hasAndValue = values.some((v) => hasExplicitAndComparator(v));
                if (hasAndValue) {
                    throw new Error(`The $and comparator can only be used on to-many relationship columns. ` +
                        `Column "${key}" is not a to-many relationship.`);
                }
            }
        }
    }
    const toManyRelations = toManyPaths.map((path) => [path, existsFilters.find((f) => f.path.join('.') === path).relation]);
    for (const [path, relation] of toManyRelations) {
        const mainQueryAlias = qb.alias;
        const relationPath = getRelationPath(path, mainMetadata);
        // 1. Create the EXISTS subquery, starting from the toMany entity
        const existsMetadata = relation.inverseEntityMetadata;
        // Slug used in alias/parameter suffixes to scope them to this relation path.
        // Using the path (e.g. "toys" → "toys", "cat.toys" → "cat_toys") ensures that two
        // independent to-many paths in the same outer query never share alias or parameter names,
        // even when both use existsIndex=0 (OR-mode) or overlapping sub-column names.
        const pathSlug = path.replace(/\./g, '_');
        // 2. Extract sub-filters for this path.
        // If any sub-filter entry uses the $and comparator, we must emit one correlated EXISTS
        // subquery per value — because a single EXISTS with AND conditions on the same column
        // (e.g. WHERE tag.id = A AND tag.id = B) is always false on a single row.
        // We split $and values into individual sub-queries and AND them on the outer query.
        const { subQuery, subFilterableColumns } = createSubFilter(query, filterableColumns, path);
        // Collect $and filter values per sub-column so we can split them out.
        const andValuesBySubColumn = {};
        for (const [subCol, rawValues] of Object.entries((_b = subQuery.filter) !== null && _b !== void 0 ? _b : {})) {
            const values = Array.isArray(rawValues) ? rawValues : [rawValues];
            const andValues = values.filter((v) => hasExplicitAndComparator(v));
            if (andValues.length >= 1) {
                andValuesBySubColumn[subCol] = andValues;
            }
        }
        // Determine how many EXISTS subqueries to emit for this path.
        // If there are $and values on any sub-column, we need one EXISTS per value (for those columns).
        // Other sub-columns (OR-mode) are included in every EXISTS subquery unchanged.
        const andSubColumns = Object.keys(andValuesBySubColumn);
        // Build a helper that constructs and correlates a single EXISTS subquery for this path.
        // existsIndex must be unique per EXISTS emitted for this path to avoid alias collisions
        // when multiple EXISTS subqueries are added to the same outer query (AND-mode).
        // The pathSlug is included in all aliases and parameter names so that two independent
        // to-many paths (e.g. "toys" and "friends") never collide even when both use existsIndex=0.
        const buildExistsQb = (extraSubQuery, existsIndex = 0) => {
            const relAlias = (name, depth) => `_rel_${name}_${depth}_${pathSlug}_e${existsIndex}`;
            const juncAlias = (name, depth) => `_junc_${name}_${depth}_${pathSlug}_e${existsIndex}`;
            const leafAlias = relAlias(relationPath[relationPath.length - 1][0], relationPath.length - 1);
            const existsQb = qb.connection.createQueryBuilder(existsMetadata.target, leafAlias);
            const subJoins = addFilter(existsQb, extraSubQuery, subFilterableColumns, { validateAndComparator: false });
            // Step 3: Add the sub relationship joins to the EXISTS subquery.
            const relationsSchema = (0, helper_1.mergeRelationSchema)((0, helper_1.createRelationSchema)(Object.keys(subJoins)));
            (0, paginate_1.addRelationsFromSchema)(existsQb, relationsSchema, {}, 'innerJoin');
            // Step 4: Build the chain of joins that backtracks our toMany relationship to the root.
            buildSubqueryJoinChain(existsQb, relAlias, juncAlias);
            // Step 5: Rename all parameters to include a path+index suffix, preventing collisions
            // when multiple EXISTS subqueries share the outer query's parameter namespace.
            const suffix = `_${pathSlug}_e${existsIndex}`;
            renameSubqueryParameters(existsQb, suffix);
            return existsQb;
        };
        /**
         * Adds the join chain that correlates the EXISTS subquery back to the root entity.
         * Iterates from the deepest relation segment to the root, adding INNER JOINs for
         * intermediate relations and a correlated WHERE clause for the root relation.
         */
        function buildSubqueryJoinChain(existsQb, relAlias, juncAlias) {
            for (let i = relationPath.length - 1; i >= 0; i--) {
                const [, meta] = relationPath[i];
                // --- A: Skip Embedded Entities ---
                if (meta.type === 'embedded') {
                    continue;
                }
                // --- B: Handle Table Relation (RelationMetadata) ---
                const parentMeta = meta;
                if (i !== 0) {
                    // --- Intermediate Join ---
                    const parentAlias = relAlias(relationPath[i - 1][0], i - 1);
                    const childAlias = relAlias(relationPath[i][0], i);
                    const childRelationMetadata = parentMeta.inverseRelation;
                    const joinCols = childRelationMetadata.joinColumns;
                    const onConditions = joinCols
                        .map((jc) => {
                        const fk = jc.databaseName;
                        const pk = jc.referencedColumn.databaseName;
                        return `${quote(childAlias)}.${quote(fk)} = ${quote(parentAlias)}.${quote(pk)}`;
                    })
                        .join(' AND ');
                    existsQb.innerJoin(childRelationMetadata.inverseRelation.entityMetadata.target, parentAlias, onConditions);
                }
                else {
                    correlateManyToManyOrFk(existsQb, parentMeta, relAlias, juncAlias);
                }
            }
        }
        /**
         * Adds the root correlation clause to the EXISTS subquery.
         * For ManyToMany relations, JOINs the junction table and correlates via it.
         * For OneToMany / ManyToOne relations, adds a direct FK = PK WHERE clause.
         */
        function correlateManyToManyOrFk(existsQb, parentMeta, relAlias, juncAlias) {
            var _a;
            // --- Root correlation ---
            //
            // `joinMeta` is always the owning side of the relation, regardless of which side
            // the filter is expressed from. This is because TypeORM stores join column metadata
            // (including junction table metadata for ManyToMany) only on the owning side.
            //
            // Example (ManyToMany, inverse side):
            //   Cat.friends (owning) ←→ Cat.friendOf (inverse)
            //   Filtering on "friendOf.name": parentMeta = friendOf (inverse, !isOwning)
            //   joinMeta = parentMeta.inverseRelation = friends (owning)
            //   toRelatedCols = joinMeta.joinColumns  (junction → owning entity = friendOf side)
            //   toMainCols    = joinMeta.inverseJoinColumns (junction → inverse entity = Cat being filtered)
            if (!parentMeta.isOwning && !parentMeta.inverseRelation) {
                throw new Error(`Cannot build EXISTS subquery for ManyToMany relation "${path}": ` +
                    `the relation has no inverse side defined. ` +
                    `Ensure the @ManyToMany decorator on the inverse entity references this relation.`);
            }
            const joinMeta = parentMeta.isOwning ? parentMeta : parentMeta.inverseRelation;
            if (parentMeta.isManyToMany) {
                // For ManyToMany, the FK columns live in the junction (join) table, not on the
                // related entity's table. We must JOIN the junction table into the EXISTS subquery
                // and correlate via it.
                const junctionMeta = joinMeta.junctionEntityMetadata;
                const junctionAlias = juncAlias(relationPath[0][0], 0);
                const relatedAlias = relAlias(relationPath[0][0], 0);
                // Column role mapping (always relative to `joinMeta`, which is the owning side):
                //   joinMeta.joinColumns        → junction columns pointing to the owning entity
                //   joinMeta.inverseJoinColumns → junction columns pointing to the inverse entity
                //
                // When filtering from the owning side (parentMeta.isOwning):
                //   toRelatedCols = inverseJoinColumns → junction → related entity (EXISTS root)
                //   toMainCols    = joinColumns        → junction → main query entity
                //
                // When filtering from the inverse side (!parentMeta.isOwning):
                //   joinMeta = parentMeta.inverseRelation (the owning side)
                //   toRelatedCols = joinMeta.joinColumns        → junction → owning entity (EXISTS root)
                //   toMainCols    = joinMeta.inverseJoinColumns → junction → main query entity
                const toRelatedCols = parentMeta.isOwning ? joinMeta.inverseJoinColumns : joinMeta.joinColumns;
                const toMainCols = parentMeta.isOwning ? joinMeta.joinColumns : joinMeta.inverseJoinColumns;
                const junctionToRelatedConditions = toRelatedCols
                    .map((jc) => {
                    const junctionCol = jc.databaseName;
                    const relatedPk = jc.referencedColumn.databaseName;
                    return `${quote(junctionAlias)}.${quote(junctionCol)} = ${quote(relatedAlias)}.${quote(relatedPk)}`;
                })
                    .join(' AND ');
                const junctionTarget = (_a = junctionMeta.target) !== null && _a !== void 0 ? _a : junctionMeta.tableName;
                existsQb.innerJoin(junctionTarget, junctionAlias, junctionToRelatedConditions);
                for (const joinColumn of toMainCols) {
                    const junctionCol = joinColumn.databaseName;
                    const mainPk = joinColumn.referencedColumn.databaseName;
                    existsQb.andWhere(`${quote(junctionAlias)}.${quote(junctionCol)} = ${quote(mainQueryAlias)}.${quote(mainPk)}`);
                }
            }
            else {
                for (const joinColumn of joinMeta.joinColumns) {
                    const fkColumn = joinColumn.databaseName;
                    const pkColumn = joinColumn.referencedColumn.databaseName;
                    let fkAlias;
                    let pkAlias;
                    if (parentMeta.isOwning) {
                        pkAlias = relAlias(relationPath[0][0], 0);
                        fkAlias = mainQueryAlias;
                    }
                    else {
                        fkAlias = relAlias(relationPath[0][0], 0);
                        pkAlias = mainQueryAlias;
                    }
                    existsQb.andWhere(`${quote(fkAlias)}.${quote(fkColumn)} = ${quote(pkAlias)}.${quote(pkColumn)}`);
                }
            }
        }
        /**
         * Renames all TypeORM named parameters in the EXISTS subquery by appending `suffix`.
         * This prevents parameter name collisions when multiple EXISTS subqueries share the
         * outer query's parameter namespace (AND-mode emits one EXISTS per `$and` value).
         *
         * Handles both simple parameters (`:name`) and spread parameters (`:...name` for IN),
         * and correctly skips PostgreSQL cast syntax (`::type`).
         */
        function renameSubqueryParameters(existsQb, suffix) {
            const oldParams = Object.assign({}, existsQb.expressionMap.parameters);
            existsQb.expressionMap.parameters = {};
            for (const [key, value] of Object.entries(oldParams)) {
                existsQb.expressionMap.parameters[key + suffix] = value;
            }
            // Use the module-level TYPEORM_PARAM_REGEX (handles both :name and :...name spread form,
            // skips PostgreSQL ::type cast syntax). Must reset lastIndex since the regex is stateful (flag g).
            const renameParamsInString = (s) => {
                exports.TYPEORM_PARAM_REGEX.lastIndex = 0;
                return s.replace(exports.TYPEORM_PARAM_REGEX, (_, spread, name) => `:${spread !== null && spread !== void 0 ? spread : ''}${name}${suffix}`);
            };
            const renameParamsInCondition = (condition) => {
                if (typeof condition === 'string') {
                    // Top-level string conditions are handled by the caller (the `for` loop over
                    // `existsQb.expressionMap.wheres` below). Nested string conditions that appear
                    // inside a `WhereClause.condition` object are handled by the `condition.condition`
                    // branch below. This branch is a no-op guard — TypeORM never passes a bare string
                    // here in practice, but the type allows it.
                    return;
                }
                if (Array.isArray(condition)) {
                    // Arrays cannot be mutated element-by-element for strings (immutable),
                    // so we map over the array and replace string items directly.
                    for (let i = 0; i < condition.length; i++) {
                        if (typeof condition[i] === 'string') {
                            condition[i] = renameParamsInString(condition[i]);
                        }
                        else {
                            renameParamsInCondition(condition[i]);
                        }
                    }
                    return;
                }
                if (condition && typeof condition === 'object') {
                    if (typeof condition.condition === 'string') {
                        condition.condition = renameParamsInString(condition.condition);
                    }
                    else if (condition.condition) {
                        renameParamsInCondition(condition.condition);
                    }
                    // Also rename in nested children arrays (e.g. Brackets with multiple clauses)
                    if (Array.isArray(condition.wheres)) {
                        for (const child of condition.wheres) {
                            if (typeof child.condition === 'string') {
                                child.condition = renameParamsInString(child.condition);
                            }
                            else {
                                renameParamsInCondition(child.condition);
                            }
                        }
                    }
                }
            };
            for (const where of existsQb.expressionMap.wheres) {
                if (typeof where.condition === 'string') {
                    where.condition = renameParamsInString(where.condition);
                }
                else {
                    renameParamsInCondition(where.condition);
                }
            }
        }
        // Determine the quantifier for this path (must be uniform across all sub-columns).
        const quantifiers = Object.entries(filter)
            .filter(([key]) => key.startsWith(path))
            .flatMap(([, multiFilter]) => multiFilter.map((f) => f.quantifier));
        let quantifier = FilterQuantifier.ANY;
        for (const q of quantifiers) {
            if (q !== FilterQuantifier.ANY) {
                if (quantifier !== FilterQuantifier.ANY && quantifier !== q) {
                    throw new Error(`Quantifier ${quantifier} and ${q} are not compatible for the same column ${path}`);
                }
                quantifier = q;
            }
        }
        if (andSubColumns.length > 0) {
            // AND-mode: emit one EXISTS per $and value on each sub-column, ANDed on the outer query.
            // OR-mode values on other sub-columns are included in every EXISTS subquery unchanged.
            //
            // Example: filter[tag.id]=$and:tagA&filter[tag.id]=$and:tagB produces:
            //   AND EXISTS (SELECT 1 FROM tag JOIN junction ON ... WHERE tag.id = 'tagA' AND ...)
            //   AND EXISTS (SELECT 1 FROM tag JOIN junction ON ... WHERE tag.id = 'tagB' AND ...)
            //
            // This is the only correct way to express "entity has ALL of these related values" —
            // a single EXISTS with AND conditions on the same column is always false on a single row.
            // $and comparator is incompatible with $none/$all quantifiers — the $and comparator
            // already implies AND-mode (multiple correlated EXISTS), so combining it with a
            // quantifier that changes the EXISTS semantics is a user error.
            if (quantifier !== FilterQuantifier.ANY) {
                throw new Error(`The $and comparator cannot be combined with the $${quantifier} quantifier on column ${path}. ` +
                    `Use $any (the default) with $and, or use $${quantifier} without $and.`);
            }
            // $and on multiple sub-columns produces a cartesian product of EXISTS subqueries,
            // which has surprising semantics: each EXISTS asserts a separate row exists, not a
            // single row matching all conditions. Disallow this to avoid silent incorrect results.
            if (andSubColumns.length > 1) {
                throw new Error(`The $and comparator cannot be used on multiple sub-columns of the same relation path ${path} simultaneously ` +
                    `(found: ${andSubColumns.join(', ')}). Apply $and to a single sub-column at a time.`);
            }
            // Build the base sub-query without the $and values (keeps OR-mode filters on other columns,
            // and keeps any non-$and values on the $and sub-column itself).
            //
            // Note: OR-mode values on the $and sub-column (non-$and values mixed with $and values)
            // are included in every EXISTS subquery as an additional filter. For example:
            //   filter[toys.name]=$and:Ball&filter[toys.name]=$eq:Mouse
            // produces EXISTS subqueries that each include `$eq:Mouse` as an additional condition.
            // This means each EXISTS asserts: "a related row exists where name = 'Ball' AND name = 'Mouse'"
            // (always false for a single row), which is likely not the intended behavior.
            // Users should use only $and values or only OR-mode values on a given sub-column, not both.
            const baseSubQuery = Object.assign(Object.assign({}, subQuery), { filter: Object.fromEntries(Object.entries((_c = subQuery.filter) !== null && _c !== void 0 ? _c : {}).flatMap(([col, rawValues]) => {
                    if (!andSubColumns.includes(col)) {
                        return [[col, rawValues]];
                    }
                    // Reject mixing $and values with non-$and (OR-mode) values on the same sub-column.
                    // A mixed filter would produce EXISTS subqueries with conditions like
                    // `name = 'Ball' AND name = 'Mouse'` (always false on a single row),
                    // which silently returns empty results rather than the user's intent.
                    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
                    const orValues = values.filter((v) => !hasExplicitAndComparator(v));
                    if (orValues.length > 0) {
                        throw new Error(`Cannot mix $and values with non-$and values on sub-column "${col}" of relation "${path}". ` +
                            `Use either all $and or no $and on a given sub-column.`);
                    }
                    return [];
                })) });
            // For each $and value on the (single) sub-column, emit a separate EXISTS subquery.
            // Multiple $and sub-columns are disallowed (throws above), so andSubColumns always
            // has exactly one entry here.
            const andSubCol = andSubColumns[0];
            const andValues = andValuesBySubColumn[andSubCol];
            // Validate that each $and value has an actual operand after the comparator.
            // A bare `$and` (no colon separator) produces token.value = undefined, which
            // would generate a malformed query. Require at least `$and:` with a value.
            for (const v of andValues) {
                const token = parseFilterToken(v);
                if (!token || token.value === undefined) {
                    throw new Error(`Invalid $and filter value "${v}" for column ${path}.${andSubCol}: ` +
                        `$and must be followed by a value, e.g. "$and:Ball" or "$and:$eq:Ball".`);
                }
            }
            if (andValues.length > maxAndValues) {
                throw new Error(`Too many $and filter values for column ${path}.${andSubCol}: ${andValues.length} (max ${maxAndValues}). ` +
                    `Reduce the number of $and values.`);
            }
            for (const [comboIndex, v] of andValues.entries()) {
                const singleValueSubQuery = Object.assign(Object.assign({}, baseSubQuery), { filter: Object.assign(Object.assign({}, baseSubQuery.filter), { [andSubCol]: v }) });
                const existsQb = buildExistsQb(singleValueSubQuery, comboIndex);
                qb.andWhereExists(existsQb);
            }
        }
        else {
            // OR-mode (default): one shared EXISTS subquery for all values on this path.
            const existsQb = buildExistsQb(subQuery);
            // 5. Add the EXISTS subquery to the main query
            if (quantifier === FilterQuantifier.ANY) {
                qb.andWhereExists(existsQb);
            }
            else if (quantifier === FilterQuantifier.NONE) {
                (0, helper_1.andWhereNoneExist)(qb, existsQb);
            }
            else if (quantifier === FilterQuantifier.ALL) {
                (0, helper_1.andWhereAllExist)(qb, existsQb);
            }
        }
    }
}
function createSubFilter(query, filterableColumns, column) {
    const subQuery = { filter: {} };
    for (const [subColumn, filter] of Object.entries(query.filter)) {
        if (subColumn.startsWith(column + '.')) {
            subQuery.filter[getSubColumn(column, subColumn)] = filter;
        }
    }
    const subFilterableColumns = {};
    for (const [subColumn, filter] of Object.entries(filterableColumns)) {
        if (subColumn.startsWith(column + '.')) {
            subFilterableColumns[getSubColumn(column, subColumn)] = filter;
        }
    }
    return { subQuery, subFilterableColumns };
}
function getSubColumn(column, subColumn) {
    const sliced = subColumn.slice(column.length + 1);
    if (sliced.startsWith('(') && sliced.endsWith(')')) {
        // Embedded relationships need to be unpacked from subColumn.(embedded.property) to
        // embedded.property
        return sliced.slice(1, -1);
    }
    return sliced;
}
//# sourceMappingURL=filter.js.map