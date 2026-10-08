/** Explicit OTLP JSON transport for feedback-authorized Session logs. */
import { createOtlpHttpExportDelegate } from '@opentelemetry/otlp-exporter-base/node-http';
import { type OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
/**
 * Create an SDK JSON exporter without inheriting another collector's headers or TLS identity.
 * @param options - explicit endpoint, headers, agent, and SDK transport settings.
 * @returns the exporter owned by one independent log pipeline.
 */
export declare function createLogExporter(options: OTLPExporterNodeConfigBase & {
    url: string;
}): LogRecordExporter;
/**
 * Resolve collector-local headers and agents with shared SDK timeout and compression defaults.
 * @param options - explicit endpoint and SDK HTTP settings.
 * @returns resolved transport settings without ambient credentials.
 */
export declare function logTransportOptions(options: OTLPExporterNodeConfigBase & {
    url: string;
}): Parameters<typeof createOtlpHttpExportDelegate>[0];
//# sourceMappingURL=transport.d.ts.map