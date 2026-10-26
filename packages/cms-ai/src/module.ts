import { DynamicModule, Module } from "@nestjs/common";
import { createProvider } from "../../ai-core/src";
export const AI_PROVIDER = Symbol("AI_PROVIDER");
/** Reusable Nest binding; framework-agnostic provider contracts live in ai-core. */
@Module({})
export class AiProviderModule {
  static forRoot(options: unknown): DynamicModule {
    return {
      module: AiProviderModule,
      providers: [
        { provide: AI_PROVIDER, useFactory: () => createProvider(options) },
      ],
      exports: [AI_PROVIDER],
    };
  }
}
