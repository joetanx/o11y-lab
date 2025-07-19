const { trace, metrics } = require('@opentelemetry/api');
const tracer = trace.getTracer('dice-lib');
const meter = metrics.getMeter('dice-lib');
const counter = meter.createCounter('dice-lib.rolls.counter');

function rollOnce(i, min, max) {
  return tracer.startActiveSpan(`rollOnce:${i}`, (span) => {
    counter.add(1);
    const result = Math.floor(Math.random() * (max - min + 1) + min);

    // Add an attribute to the span
    span.setAttribute('dice-lib.result', result.toString());

    span.addEvent('child rollOnce function', {
      'log.facility': 'user',
      'log.severity': 'informational',
      'log.message': 'Execute child rollOnce function',
    });

    span.end();
    return result;
  });
}

function rollTheDice(rolls, min, max) {
  // Create a span. A span must be closed.
  return tracer.startActiveSpan(
    'rollTheDice',
    { attributes: { 'dice-lib.rolls': rolls.toString() } },
    (parentSpan) => {
      const result = [];
      for (let i = 0; i < rolls; i++) {
        result.push(rollOnce(i, min, max));
      }
      parentSpan.addEvent('parent rollTheDice function', {
        'log.facility': 'user',
        'log.severity': 'informational',
        'log.message': 'Execute parent rollTheDice function',
      });
      // Be sure to end the span!
      parentSpan.end();
      return result;
    },
  );
}

module.exports = { rollTheDice };
