To apply the [install.yaml](/install.yaml) manifest:

1. Replace `your-email@example.com` in the `ClusterIssuer` with your actual email.
2. Update the Ingress hosts (`grafana.example.com`, `prometheus.example.com`, `loki.example.com`) to match your domain.
3. Ensure your cluster has a storage class configured for PVCs.
4. Apply with: `kubectl apply -f install.yaml`
5. Configure Grafana to use Prometheus and Loki as data sources after deployment.

This setup assumes you have nginx ingress controller and cert-manager installed.

The services are exposed via Ingress with TLS, and data persists using PVCs.
