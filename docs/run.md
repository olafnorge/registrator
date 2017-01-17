# Run Reference

Registrator is designed to be run once on every host. You *could* run a single
Registrator for your cluster, but you get better scaling properties and easier
configuration by ensuring Registrator runs on every host. Assuming some level of
automation, running everywhere is ironically simpler than running once somewhere.

## Running Registrator

    docker run [docker options] olafnorge/registrator[:tag] [options] <registry uri>

Registrator requires and recommends some Docker options, has its own set of options
and then requires a Registry URI. Here is a typical way to run Registrator:

    $ docker run -d \
        --name=registrator \
        --volume=/var/run/docker.sock:/var/run/docker.sock \
        --user="registrator:$(getent group docker | awk -F':' '{print $3}')" \
        --read-only \
        --security-opt=no-new-privileges \
        --pids-limit 6 \
        --cap-drop=all \
        olafnorge/registrator:latest \
        registrator --consul consul-host:8500

## Docker Options

Option                                               | Required    | Description
------                                               | --------    | -----------
`--volume=/var/run/docker.sock:/var/run/docker.sock` | yes         | Allows Registrator to access Docker API
`--net=host`                                         | recommended | Helps Registrator get host-level IP and hostname

## Registrator Options

Option                          | Required  | Description
------                          | --------  | -----------
`--consul <address>:<port>`     | yes       | Address and port of Consul
`--resync <interval>`           | no        | Tells Registrator in which interval in seconds it should resync the services
`--ownNetworkOnly <true|false>` | no        | Registrator will only register services in its own network. Default is `false`

The `-resync` options controls how often Registrator will query Docker for all
containers and reregister all services.  This allows Registrator and the service
registry to get back in sync if they fall out of sync. Use this option with caution
as it will notify all the watches you may have registered on your services, and
may rapidly flood your system (e.g. consul-template makes extensive use of watches).
