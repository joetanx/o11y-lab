const { trace, metrics, SpanStatusCode } = require('@opentelemetry/api');
const express = require('express');
const { rollTheDice } = require('./functions.js');

const tracer = trace.getTracer('dice-server', '0.1.0');
const meter = metrics.getMeter('dice-server');

const winston = require('winston');
const { OpenTelemetryTransportV3 } = require('@opentelemetry/winston-transport');
const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console(),
    new OpenTelemetryTransportV3()
  ]
});

const PORT = parseInt(process.env.PORT || '8080');
const app = express();

app.get('/rolldice', (req, res) => {
  logger.debug(`${req.socket.remoteAddress}:${req.socket.remotePort} ${req.method} ${req.originalUrl} ${req.headers['user-agent']}`)
  const histogram = meter.createHistogram('task.duration');
  const startTime = new Date().getTime();

  const appSpan = tracer.startSpan('app.js');

  const rolls = req.query.rolls ? parseInt(req.query.rolls.toString()) : NaN;
  if (isNaN(rolls)) {
    const err = new Error("Request parameter 'rolls' is missing or not a number.");
    appSpan.recordException(err);
    appSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
    logger.warn("Client request without parameter 'rolls'.");
    res.status(400).send(err.message + '\n');
    appSpan.end();
    return;
  }
  res.send(JSON.stringify(rollTheDice(rolls, 1, 6)) + '\n');

  const endTime = new Date().getTime();
  const executionTime = endTime - startTime;
  // Record the duration of the task operation
  histogram.record(executionTime);
});

app.listen(PORT, () => {
  logger.info(`Listening for requests on http://localhost:${PORT}`);
});
