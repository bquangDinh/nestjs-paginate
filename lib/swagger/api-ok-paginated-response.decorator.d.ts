import { Type } from '@nestjs/common';
import { PaginateConfig } from '../paginate';
export declare const ApiOkPaginatedResponse: <DTO extends Type<unknown> | string>(dataDto: DTO, paginatedConfig: PaginateConfig<any>) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
