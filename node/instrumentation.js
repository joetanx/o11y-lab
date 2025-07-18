const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

const { metrics } = require('@opentelemetry/api');
const {
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter} = require('@opentelemetry/exporter-metrics-otlp-proto');

const { logs } = require('@opentelemetry/api-logs');
const {
  LoggerProvider,
  SimpleLogRecordProcessor
} = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter} = require('@opentelemetry/exporter-logs-otlp-proto');

const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation()
  ]
});

const {
  defaultResource,
  resourceFromAttributes,
} = require('@opentelemetry/resources');
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require('@opentelemetry/semantic-conventions');
const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'dice-server',
    [ATTR_SERVICE_VERSION]: '0.1.0',
  }),
);

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter(),
  // Default is 60000ms (60 seconds). Set to 10 seconds for demonstrative purposes only.
  exportIntervalMillis: 10000,
});
const meterProvider = new MeterProvider({
  resource: resource,
  readers: [metricReader],
});
// Set this MeterProvider to be global to the app being instrumented.
metrics.setGlobalMeterProvider(meterProvider);

const logRecordProcessor = new SimpleLogRecordProcessor(new OTLPLogExporter());
const loggerProvider = new LoggerProvider({
  resource: resource,
  processors: [logRecordProcessor]
});
logs.setGlobalLoggerProvider(loggerProvider);

const sdk = new NodeSDK({
  resource: resource,
  traceExporter: new OTLPTraceExporter()
});

sdk.start();
