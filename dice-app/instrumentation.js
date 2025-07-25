// resource
const { defaultResource, resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'dice-server',
    [ATTR_SERVICE_VERSION]: '0.1.0',
  })
);

// http instrumentation
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
registerInstrumentations({
  instrumentations: [new HttpInstrumentation()]
});

// get otel collector from environment
const OTELCOL = `http://${process.env.OTELCOL}:4318/v1/`;

// trace
const { trace } = require('@opentelemetry/api');
const { BasicTracerProvider, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const tracerProvider = new BasicTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({url: OTELCOL+'traces'}))]
});
trace.setGlobalTracerProvider(tracerProvider);

// metrics
const { metrics } = require('@opentelemetry/api');
const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({url: OTELCOL+'metrics'}),
  exportIntervalMillis: 10000 //Default is 60000ms (60 seconds)
});
const meterProvider = new MeterProvider({
  resource,
  readers: [metricReader]
});
metrics.setGlobalMeterProvider(meterProvider);

// logs
const { logs } = require('@opentelemetry/api-logs');
const { LoggerProvider, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
const logRecordProcessor = new SimpleLogRecordProcessor(new OTLPLogExporter({url: OTELCOL+'logs'}));
const loggerProvider = new LoggerProvider({
  resource: resource,
  processors: [logRecordProcessor]
});
logs.setGlobalLoggerProvider(loggerProvider);
