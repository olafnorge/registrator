# Registrator

Service registry bridge for Docker inspired by [gliderlabs/registrator](https://github.com/gliderlabs/registrator).
  
[![GitHub release](https://img.shields.io/github/release/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/)
[![Docker Automated buil](https://img.shields.io/docker/automated/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/)
[![Docker Stars](https://img.shields.io/docker/stars/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/)
[![Docker Pulls](https://img.shields.io/docker/pulls/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/)
[![license](https://img.shields.io/github/license/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/)

Registrator automatically registers and deregisters services for any Docker
container by inspecting containers as they come online. Registrator
supports only [Consul](http://www.consul.io/) which is the main differnece to
[gliderlabs/registrator](https://github.com/gliderlabs/registrator).

## Getting Registrator

Get the latest release, master, or any version of Registrator via [Docker Hub](https://hub.docker.com/r/olafnorge/registrator/):

	$ docker pull olafnorge/registrator:latest

Latest tag always points to the latest release. There are also version tags to pin to specific releases.

## Using Registrator

Typically, running Registrator looks like this:

    $ docker run -d \
        --name=registrator \
        --volume=/var/run/docker.sock:/var/run/docker.sock \
        olafnorge/registrator:latest \
        registrator --consul consul-host:8500

## Next Steps

There are more ways to configure Registrator and ways you can run containers to
customize the services that are extracted from them. For this, take a look at
the [Run Reference](docs/run.md) and [Service Model](docs/services.md).

## Contributing

Pull requests are welcome! We recommend getting feedback before starting by
opening a [GitHub issue](https://github.com/olafnorge/registrator/issues).

## License

[![license](https://img.shields.io/github/license/olafnorge/registrator.svg)](https://hub.docker.com/r/olafnorge/registrator/) MIT 