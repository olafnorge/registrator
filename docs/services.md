# Service Object

Registrator is primarily concerned with services that would be added to a
service discovery registry. In our case, a service is anything listening on a
port. If a container listens on multiple ports, it has multiple services.

Services are created with information from the container, including user-defined
metadata on the container, into an intermediary service object. This service
object is then passed to a registry backend to try and place as much of this
object into a particular registry.

	type Service struct {
		ID    string               // unique service instance ID
		Name  string               // service name
		IP    string               // IP address service is located at
		Port  int                  // port service is listening on
		Tags  []string             // extra tags to classify service
	}

## Container Overrides

The fields `Name` and `Tags` can be overridden by user-defined
container metadata. You need to use environment variables prefixed with
`SERVICE_` or `SERVICE_x_` to set values, where `x` is the internal exposed port.
For example `SERVICE_NAME=customerdb` and `SERVICE_80_NAME=api`.

You use a port in the key name to refer to a particular service on that port.
Metadata variables without a port in the name are used as the default for all
services or can be used to conveniently refer to the single exposed service.

Since metadata is stored as environment variables, the container
author can include their own metadata defined in the Dockerfile. The operator
will still be able to override these author-defined defaults.


## Detecting Services

Registrator will look for exposed ports.
These can be implicitly set from the Dockerfile or explicitly set with `docker run
--expose=8080 ...`.

You can also tell Registrator to ignore a container by setting a
label or environment variable for `SERVICE_IGNORE`.

If you need to ignore individual service on some container, you can use 
`SERVICE_<port>_IGNORE=true`.

## Service Name

Service names are what you use in service discovery lookups. By default, the
service name is determined by this pattern:

	<base(container-name)

You can override this default name with an environment variable
`SERVICE_NAME` or `SERVICE_x_NAME`, where `x` is the internal exposed port.

## IP and Port

IP and port make up the address that the service name resolves to. Registrator will use the *exposed* port **and
Docker-assigned internal IP of the container**.

## Tags

Tags are extra metadata fields for services.

Attributes can also be used by Consul for registry specific features, not just
generic metadata. For example, Consul uses them for specifying HTTP health
checks.

## Unique ID

The ID is a cluster-wide unique identifier for this service instance. For the
most part, it's an implementation detail, as users typically use service names,
not their IDs. Registrator comes up with a human-friendly string that encodes
useful information in the ID based on this pattern:

	<container-id>:<container-name>:<exposed-port>[:udp if udp]

To identify this particular service in the container, it uses the internal
exposed port. This represents the port the service is listening on inside the
container. We use this because it likely better represents the service than the
publicly published port. A published port might be an arbitrary 54292, whereas
the exposed port might be 80, showing that it's an HTTP service.

Lastly, if the service is identified as UDP, this is included in the ID to
differentiate from a TCP service that could be listening on the same port.

## Examples

### Single service with defaults

	$ docker run -d --name redis.0 -p 10000:6379 progrium/redis

Results in `Service`:

	{
		"ID": "<container-id>:redis.0:6379",
		"Name": "redis",
		"Port": 10000,
		"IP": "192.168.1.102",
		"Tags": []
	}

### Single service with metadata

	$ docker run -d --name redis.0 -p 10000:6379 \
		-e "SERVICE_NAME=db" \
		-e "SERVICE_TAGS=master,backups" progrium/redis

Results in `Service`:

	{
		"ID": "<container-id>:redis.0:6379",
		"Name": "db",
		"Port": 10000,
		"IP": "192.168.1.102",
		"Tags": ["master", "backups"]
	}

### Multiple services with defaults

	$ docker run -d --name nginx.0 -p 4443:443 -p 8000:80 progrium/nginx

Results in two `Service` objects:

	[
		{
			"ID": "<container-id>:nginx.0:443",
			"Name": "nginx.0",
			"Port": 4443,
			"IP": "192.168.1.102",
			"Tags": []
		},
		{
			"ID": "<container-id>:nginx.0:80",
			"Name": "nginx.0",
			"Port": 8000,
			"IP": "192.168.1.102",
			"Tags": []
		}
	]

### Multiple services with metadata

	$ docker run -d --name nginx.0 -p 4443:443 -p 8000:80 \
		-e "SERVICE_443_NAME=https" \
		-e "SERVICE_80_NAME=http" \
		-e "SERVICE_TAGS=www" progrium/nginx

Results in two `Service` objects:

	[
		{
			"ID": "<container-id>.nginx.0.443",
			"Name": "https",
			"Port": 443,
			"IP": "192.168.1.102",
			"Tags": ["www"]
		},
		{
			"ID": "<container-id>:nginx.0:80",
			"Name": "http",
			"Port": 80,
			"IP": "192.168.1.102",
			"Tags": ["www"]
		}
	]
