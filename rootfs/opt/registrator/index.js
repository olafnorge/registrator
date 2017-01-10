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
    .usage('Usage: $0 --consul <IP|FQDN>:<port> --resync <seconds> --ownNetworkOnly <true|false>')
    .demand(['consul'])
    .default({resync: 3600, ownNetworkOnly: 'false'})
    .boolean('ownNetworkOnly')
    .check(function (argv) {
        if (argv.resync < 30) throw "Value for resyncing the services must be greater than or at least equal to 30 seconds";
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

    let shouldRegister = function (ipAddress) {
        let addresses = (function () {
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
        })();

        for (let address in addresses) {
            if (!options.ownNetworkOnly || (options.ownNetworkOnly && require("ip").subnet(address, addresses[address]).contains(ipAddress))) {
                return true;
            }
        }

        return false;
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

                switch (status) {
                    case "start":
                    case "unpause":
                        docker.getContainer(id).inspect(function (err, data) {
                            if (err) {
                                log.error('Error occurred: ' + err);
                                return;
                            }

                            let container = new Container(data, consul.agent);

                            if (shouldRegister(container.ip)) {
                                container.consulRegister(function (err, data, res, options) {
                                    if (err) {
                                        log.error('Error occurred: ' + err);
                                        log.error(data);
                                        log.error(res);
                                        log.error(options);
                                        return;
                                    }

                                    log.info("Registered " + options.id);
                                });
                            }
                        });
                        break;
                    case "die":
                    case "pause":
                        docker.getContainer(id).inspect(function (err, data) {
                            if (err) {
                                log.error('Error occurred: ' + err);
                                return;
                            }

                            let container = new Container(data, consul.agent);
                            container.consulDeregister(function (err, data, res, options) {
                                if (err) {
                                    log.error('Error occurred: ' + err);
                                    log.error(data);
                                    log.error(res);
                                    log.error(options);
                                    return;
                                }

                                log.info("Deregistered " + options.id);
                            });
                        });
                        break;
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
                    docker.getContainer(containers[index].Id).inspect(function (err, data) {
                        if (err) {
                            log.error('Error occurred: ' + err);
                            return;
                        }

                        let container = new Container(data, consul.agent);

                        if (shouldRegister(container.ip)) {
                            container.consulRegister(function (err, data, res, options) {
                                if (err) {
                                    log.error('Error occurred: ' + err);
                                    log.error(data);
                                    log.error(res);
                                    log.error(options);
                                    return;
                                }

                                log.info("Synced and registered " + options.id);
                            });
                        }
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
