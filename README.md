```sh
yum -y install podman jq container-selinux
firewall-cmd --permanent --add-port 4317/tcp --add-port 4318/tcp --add-port 9464/tcp --add-port 9090/tcp --add-port 3000/tcp --add-port 3100/tcp --add-port 3200/tcp && firewall-cmd --reload
mkdir -p /etc/otelcol /etc/prometheus /etc/tempo /var/prometheus /var/tempo /var/loki /var/grafana
chown -R 65534:65534 /var/prometheus
chown -R 10001:10001 /var/tempo
chown -R 10001:10001 /var/loki
chown -R 472:472 /var/grafana
```

```sh
cat << EOF > /etc/otelcol/config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
processors:
  batch:
exporters:
  prometheus:
    endpoint: 0.0.0.0:9464
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  debug:
    verbosity: detailed
extensions:
  health_check:
  pprof:
  zpages:
service:
  extensions: [health_check, pprof, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
EOF
cat << EOF > /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'otelcol'
    static_configs:
      - targets: ['otelcol:9464']
EOF
cat << EOF > /etc/tempo/tempo.yaml
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317 #tempo listens on 127.0.0.1:4317 if this is not specified; will not be published to host, for container network communication only
ingester:
  trace_idle_period: 10s
  max_block_duration: 5m
compactor:
  compaction:
    block_retention: 1h
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
EOF
```

```sh
podman network create o11y
podman run --name otelcol -d -p 4317-4318:4317-4318 -p 9464:9464 --network o11y -v /etc/otelcol/config.yaml:/etc/otelcol-contrib/config.yaml docker.io/otel/opentelemetry-collector-contrib:latest
podman run --name prometheus -d -p 9090:9090 --network o11y -v /etc/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml -v /var/prometheus:/prometheus:Z docker.io/prom/prometheus:latest
podman run --name tempo -d -p 3200:3200 --network o11y -v /etc/tempo/tempo.yaml:/etc/tempo.yaml -v /var/tempo:/var/tempo:Z docker.io/grafana/tempo:latest -config.file=/etc/tempo.yaml
podman run --name loki -d -p 3100:3100 --network o11y -v /var/loki:/loki:Z docker.io/grafana/loki:latest
podman run --name grafana -d -p 3000:3000 --network o11y -v /var/grafana:/var/lib/grafana:Z docker.io/grafana/grafana:latest
```

```sh
podman pull docker.io/otel/opentelemetry-collector-contrib:latest
podman pull docker.io/prom/prometheus:latest
podman pull docker.io/grafana/tempo:latest
podman pull docker.io/grafana/loki:latest
podman pull docker.io/grafana/grafana:latest
cat << EOF > /etc/containers/systemd/o11y.network
[Unit]
Description=o11y stack: network
After=network.target

[Network]
NetworkName=o11y

[Install]
WantedBy=multi-user.target
EOF
cat << EOF > /etc/containers/systemd/o11y-otelcol.container
[Unit]
Description=o11y stack: otelcol container
Requires=o11y-tempo.service
Requires=o11y-prometheus.service
Requires=o11y-loki.service
Requires=o11y-grafana.service
After=o11y-tempo.service

[Container]
ContainerName=otelcol
HostName=otelcol
Image=docker.io/otel/opentelemetry-collector-contrib:latest
Network=o11y.network
PublishPort=4317-4318:4317-4318
PublishPort=9464:9464
Volume=/etc/otelcol/config.yaml:/etc/otelcol-contrib/config.yaml

[Install]
WantedBy=multi-user.target
EOF
cat << EOF > /etc/containers/systemd/o11y-prometheus.container
[Unit]
Description=o11y stack: prometheus container
Requires=o11y-network.service
After=o11y-network.service

[Container]
ContainerName=prometheus
HostName=prometheus
Image=docker.io/prom/prometheus:latest
Network=o11y.network
PublishPort=9090:9090
Volume=/etc/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
Volume=/var/prometheus:/prometheus:Z

[Install]
WantedBy=multi-user.target
EOF
cat << EOF > /etc/containers/systemd/o11y-tempo.container
[Unit]
Description=o11y stack: tempo container
Requires=o11y-network.service
After=o11y-network.service

[Container]
ContainerName=tempo
HostName=tempo
Image=docker.io/grafana/tempo:latest
Exec=-config.file=/etc/tempo.yaml
Network=o11y.network
PublishPort=3200:3200
Volume=/etc/tempo/tempo.yaml:/etc/tempo.yaml
Volume=/var/tempo:/var/tempo:Z

[Install]
WantedBy=multi-user.target
EOF
cat << EOF > /etc/containers/systemd/o11y-loki.container
[Unit]
Description=o11y stack: loki container
Requires=o11y-network.service
After=o11y-network.service

[Container]
ContainerName=loki
HostName=loki
Image=docker.io/grafana/loki:latest
Network=o11y.network
PublishPort=3100:3100
Volume=/var/loki:/loki:Z

[Install]
WantedBy=multi-user.target
EOF
cat << EOF > /etc/containers/systemd/o11y-grafana.container
[Unit]
Description=o11y stack: grafana container
Requires=o11y-network.service
After=o11y-network.service

[Container]
ContainerName=grafana
HostName=grafana
Image=docker.io/grafana/grafana:latest
Network=o11y.network
PublishPort=3000:3000
Volume=/var/grafana:/var/lib/grafana:Z

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl start o11y-otelcol
```
