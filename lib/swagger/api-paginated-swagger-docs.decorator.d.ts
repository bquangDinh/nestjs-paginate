import { Type } from '@nestjs/common';
import { PaginateConfig } from '../paginate';
export declare function PaginatedSwaggerDocs<DTO extends Type<unknown> | string>(dto: DTO, paginatedConfig: PaginateConfig<any>): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
