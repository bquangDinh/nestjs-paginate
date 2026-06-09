export interface NestjsPaginateGlobalConfig {
    defaultOrigin: string | undefined;
    defaultLimit: number;
    defaultMaxLimit: number;
}
declare const globalConfig: NestjsPaginateGlobalConfig;
export declare const updateGlobalConfig: (newConfig: Partial<NestjsPaginateGlobalConfig>) => void;
export default globalConfig;
