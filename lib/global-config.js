"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGlobalConfig = void 0;
const globalConfig = {
    defaultOrigin: undefined,
    defaultLimit: 20,
    defaultMaxLimit: 100,
};
const updateGlobalConfig = (newConfig) => {
    Object.assign(globalConfig, newConfig);
};
exports.updateGlobalConfig = updateGlobalConfig;
exports.default = globalConfig;
//# sourceMappingURL=global-config.js.map