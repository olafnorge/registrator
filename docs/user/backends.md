# Backend Reference

Registrator supports only Consul backing registry. Below is the Registry URI to
use for Consul and documentation specific to its features.

## Consul

	<address>:<port>

If no address and port is specified, it will default to `127.0.0.1:8500`.

Consul supports tags but no arbitrary service attributes.

### Consul HTTP Check

This feature is only available when using Consul 0.5 or newer. Containers
specifying these extra metadata in environment will be used to
register an HTTP health check with the service.

```bash
SERVICE_80_CHECK_HTTP=/health/endpoint/path
SERVICE_80_CHECK_INTERVAL=15s
SERVICE_80_CHECK_TIMEOUT=1s		# optional, Consul default used otherwise
```

It works for services on any port, not just 80. If its the only service,
you can also use `SERVICE_CHECK_HTTP`.

### Consul HTTPS Check

This feature is only available when using Consul 0.5 or newer. Containers
specifying these extra metadata in environment will be used to
register an HTTPS health check with the service.

```bash
SERVICE_443_CHECK_HTTPS=/health/endpoint/path
SERVICE_443_CHECK_INTERVAL=15s
SERVICE_443_CHECK_TIMEOUT=1s		# optional, Consul default used otherwise
```

### Consul TCP Check

This feature is only available when using Consul 0.6 or newer. Containers
specifying these extra metadata in environment will be used to
register an TCP health check with the service.

```bash
SERVICE_443_CHECK_TCP=true
SERVICE_443_CHECK_INTERVAL=15s
SERVICE_443_CHECK_TIMEOUT=3s		# optional, Consul default used otherwise
```

### Consul Script Check

This feature is tricky because it lets you specify a script check to run from
Consul. If running Consul in a container, you're limited to what you can run
from that container. For example, curl must be installed for this to work:

```bash
SERVICE_CHECK_SCRIPT=curl --silent --fail example.com
```

The default interval for any non-TTL check is 10s, but you can set it with
`_CHECK_INTERVAL`. The check command will be interpolated with the `$SERVICE_IP`
and `$SERVICE_PORT` placeholders:

```bash
SERVICE_CHECK_SCRIPT=nc $SERVICE_IP $SERVICE_PORT | grep OK
```

### Consul TTL Check

You can also register a TTL check with Consul. Keep in mind, this means Consul
will expect a regular heartbeat ping to its API to keep the service marked
healthy.

```bash
SERVICE_CHECK_TTL=30s
```

### Consul Initial Health Check Status

By default when a service is registered against Consul, the state is set to "critical". You can specify the initial health check status.

```bash
SERVICE_CHECK_INITIALSTATUS=passing
```
