import { Module, Global } from '@nestjs/common';
import { TSValidationOb1Service } from './services/ts-validation-ob1.service';

@Global()
@Module({
  providers: [TSValidationOb1Service],
  exports: [TSValidationOb1Service],
})
export class TSValidationOb1Module {}