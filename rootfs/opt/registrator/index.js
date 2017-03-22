/**
 * MIT License
 *
 * Copyright (c) [2017] [Volker Machon]
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

'use strict';

const Log = require('log');
const log = new Log('info');

// The next part is here to prevent a major exception when there
// is no internet connection. This could probable be solved better.
process.on("uncaughtException", function (err) {
    log.warning("Whoops! There was an uncaught exception...");
    log.error(err);
});

const argv = require('yargs')
    .usage('Usage: $0 --consul <IP|FQDN>:<port> --resync <seconds> --ownNetworkOnly <true|false> --servicesWithPortBindingsOnly <true|false>')
    .demand(['consul'])
    .default({resync: 3600, ownNetworkOnly: 'false', servicesWithPortBindingsOnly: 'false'})
    .boolean('ownNetworkOnly')
    .boolean('servicesWithPortBindingsOnly')
    .check(function (argv) {
        if (argv.resync < 30) throw "Value for re-syncing the services must be greater than or at least equal to 30 seconds";
        return true;
    })
    .argv;

const Registrator = function (options) {
    const consul = require('consul')({
        "host": options.consul.split(':', 2)[0],
        "port": options.consul.split(':', 2)[1]
    });
    const Docker = require('dockerode');
    const docker = new Docker();
    const Container = require("./lib/container");

    // gather facts about myself
    this.getIps = function () {
        let interfaces = require("os").networkInterfaces();
        let addresses = {};

        for (let device in interfaces) {
            for (let index in interfaces[device]) {
                let properties = interfaces[device][index];

                if (properties.family === 'IPv4' && !properties.internal) {
                    addresses[properties.address] = properties.netmask;
                }
            }
        }

        return addresses;
    };
    const registratorFacts = {
        'consul_agent': consul.agent,
        'own_network_only': options.ownNetworkOnly,
        'ips': this.getIps(),
        'services_with_port_bindings_only': options.servicesWithPortBindingsOnly
    };

    this.listen = function () {
        log.info("Listening on container events");

        docker.getEvents(null, function (err, stream) {
            if (err) {
                log.error('Error occurred: ' + err);
                return;
            }

            const onFinished = function (err, output) {
                if (err) {
                    log.error('Error occurred: ' + err);
                    log.error(output);
                    return;
                }

                log.info(output);
            };

            const onProgress = function (event) {
                let status = (typeof event.status === 'undefined' ? null : event.status);
                let id = (typeof event.id === 'undefined' ? null : event.id);

                if (status && (status === "start" || status === "unpause")) {
                    docker.getContainer(id).inspect(function (err, containerFacts) {
                        if (err) {
                            log.error('Error occurred: ' + err);
                            return;
                        }

                        let container = new Container(containerFacts, registratorFacts);
                        container.consulRegister(function (err, data, res, container) {
                            if (err) {
                                log.error('Error occurred: ' + err);
                                log.error(data);
                                log.error(res);
                                log.error(container);
                                return;
                            }

                            log.info("Registered " + container.id);
                        });
                    });
                } else if (status && (status === "die" || status === "pause")) {
                    docker.getContainer(id).inspect(function (err, containerFacts) {
                        if (err) {
                            log.error('Error occurred: ' + err);
                            return;
                        }

                        let container = new Container(containerFacts, registratorFacts);
                        container.consulDeregister(function (err, data, res, container) {
                            if (err) {
                                log.error('Error occurred: ' + err);
                                log.error(data);
                                log.error(res);
                                log.error(container);
                                return;
                            }

                            log.info("Deregistered " + container.id);
                        });
                    });
                } else if (status && status.startsWith("health_status:")) {
                    let state = status.split(":", 2)[1].trim();
                    log.info(JSON.stringify({'state': state, 'event_object': event}));
                }
            };

            docker.modem.followProgress(stream, onFinished, onProgress);
        });
    };

    this.sync = function (interval) {
        const sync = function () {
            log.info("Synchronizing services");

            // register all running containers
            docker.listContainers(function (err, containers) {
                if (err) {
                    log.error('Error occurred: ' + err);
                    return;
                }

                for (let index = 0; index < containers.length; index++) {
                    docker.getContainer(containers[index].Id).inspect(function (err, containerFacts) {
                        if (err) {
                            log.error('Error occurred: ' + err);
                            return;
                        }

                        let container = new Container(containerFacts, registratorFacts);
                        container.consulRegister(function (err, data, res, container) {
                            if (err) {
                                log.error('Error occurred: ' + err);
                                log.error(data);
                                log.error(res);
                                log.error(container);
                                return;
                            }

                            log.info("Synced and registered " + container.id);
                        });
                    });
                }
            });

            // deregister all unavailable services
            consul.agent.service.list(function (err, services) {
                if (err) {
                    log.error('Error occurred: ' + err);
                    return;
                }

                let containerIds = (function (serviceIds) {
                    let containerIds = {};

                    for (let index = 0; index < serviceIds.length; index++) {
                        let containerId = serviceIds[index].split(':', 2)[0];
                        // skip if service is consul itself
                        if (containerId === 'consul') continue;
                        // skip if service is already in the array
                        if (containerIds.hasOwnProperty(containerId) && containerIds[containerId].indexOf(serviceIds[index]) >= 0) continue;
                        // create new array if service key is not available already
                        if (!containerIds.hasOwnProperty(containerId)) containerIds[containerId] = [];
                        // add service to list of container
                        containerIds[containerId].push(serviceIds[index]);
                    }

                    return containerIds;
                })(services instanceof Object ? Object.keys(services) : []);

                for (let containerId in containerIds) {
                    if (containerIds.hasOwnProperty(containerId)) {
                        docker.getContainer(containerId).inspect(function (err, data) {
                            if (err || data.State.Status !== "running") {
                                for (let index = 0; index < containerIds[containerId].length; index++) {
                                    consul.agent.service.deregister(containerIds[containerId][index], function (err, data, res) {
                                        if (err) {
                                            log.error('Error occurred: ' + err);
                                            log.error(data);
                                            log.error(res);
                                            log.error(containerIds[containerId][index]);
                                        }

                                        log.info("Synced and deregistered " + containerIds[containerId][index]);
                                    });
                                }
                            }
                        });
                    }
                }
            });
        };

        sync();
        setInterval(sync, interval);
    };

    if (!module.parent) {
        this.listen();
        this.sync(options.resync * 1000);
    }
};

module.exports = new Registrator(argv);
