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

const Container = function (containerFacts, registratorFacts) {
    // register registrator facts
    const CONSUL_AGENT = registratorFacts.consul_agent;
    const OWN_NETWORK_ONLY = registratorFacts.own_network_only;
    const REGISTRATOR_IPS = registratorFacts.ips;
    const SERVICES_WITH_PORT_BINDINGS_ONLY = registratorFacts.services_with_port_bindings_only;


    // declare getters for constants
    this.getConsulAgent = function () {
        return CONSUL_AGENT;
    };
    this.getIps = function () {
        return IPS;
    };
    this.getPortBindings = function () {
        return PORT_BINDINGS;
    };
    this.getRegisterMe = function () {
        return REGISTER_ME;
    };
    this.getServicesWithPortBindingsOnly = function () {
        return SERVICES_WITH_PORT_BINDINGS_ONLY;
    };
    this.getExposedPorts = function () {
        return EXPOSED_PORTS;
    };
    this.getContainerFacts = function () {
        return CONTAINER_FACTS;
    };
    this.getName = function () {
        return NAME;
    };
    this.getId = function () {
        return ID;
    };
    this.getTags = function () {
        return TAGS;
    };
    this.getChecks = function () {
        return CHECKS;
    };

    // declare helper functions
    let objectEquivality = function isEquivalent(a, b) {
        // Create arrays of property names
        let aProps = Object.getOwnPropertyNames(a);
        let bProps = Object.getOwnPropertyNames(b);

        // If number of properties is different,
        // objects are not equivalent
        if (aProps.length != bProps.length) {
            return false;
        }

        for (let i = 0; i < aProps.length; i++) {
            let propName = aProps[i];

            // If values of same property are not equal,
            // objects are not equivalent
            if (a[propName] !== b[propName]) {
                return false;
            }
        }

        // If we made it this far, objects
        // are considered equivalent
        return true;
    };

    // declare extractors
    this.extractIsIgnoredFromEnvironment = function (env, regex) {
        let matcher = new RegExp(regex);

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                let value = env[index].split('=', 2)[1];
                return value === true || value === 1 || value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
            }
        }

        return false;
    };
    this.extractNameFromEnvironment = function (env, regex, fallback) {
        let matcher = new RegExp(regex);

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                return env[index].split('=', 2)[1];
            }
        }

        return fallback;
    };

    this.extractTagsFromEnvironment = function (env, regex, fallback) {
        let tmp = [];
        let matcher = new RegExp(regex);

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                let tags = env[index].split('=', 2)[1].split(",");

                for (let i = 0; i < tags.length; i++) {
                    if (tmp.hasOwnProperty(tags[i])) continue;
                    tmp.push(tags[i]);
                }
            }
        }

        return tmp.length ? tmp.concat(fallback).filter(function (item) {
                return item;
            }) : fallback;
    };
    this.extractChecksFromEnvironment = function (env, regex, service, fallback) {
        let tmp = fallback || [];
        let matcher = new RegExp(regex);

        for (let ipIndex = 0; ipIndex < service.ips.length; ipIndex++) {
            let check = {};
            let checkExists = false;

            for (let index = 0; index < env.length; index++) {
                if (matcher.test(env[index])) {
                    check[env[index].split('=', 2)[0].split('_').pop().toLowerCase().trim()] = env[index].split('=', 2)[1].replace('$SERVICE_IP', service.ips[ipIndex]).replace('$SERVICE_PORT', service.port).trim();
                }
            }

            if (Object.keys(check).length) {
                for (let i = 0; i < tmp.length; i++) {
                    if (objectEquivality(tmp[i], check)) {
                        checkExists = true;
                        break;
                    }
                }

                if (!checkExists) {
                    tmp.push(check);
                }
            }
        }

        return tmp.length ? tmp : fallback;
    };


    // register container facts
    const CONTAINER_FACTS = containerFacts;
    const IS_RUNNING = this.getContainerFacts().State.Status === "running";
    const IS_IGNORED = this.extractIsIgnoredFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_IGNORE=.*$");
    const ID = this.getContainerFacts().Id;
    const EXPOSED_PORTS = (function (exposedPorts) {
        return exposedPorts instanceof Object ? Object.keys(exposedPorts) : [];
    })(this.getContainerFacts().Config.ExposedPorts);
    const PORT_BINDINGS = (function (portBindings) {
        let bindings = [];

        for (let portAndProtocol in portBindings) {
            if (portBindings.hasOwnProperty(portAndProtocol)) {
                if (portBindings[portAndProtocol] === null) continue;

                for (let index = 0; index < portBindings[portAndProtocol].length; index++) {
                    if (portBindings[portAndProtocol][index].hasOwnProperty("HostIp") && portBindings[portAndProtocol][index].hasOwnProperty("HostPort")) {
                        bindings.push({
                            'container_port': parseInt(portAndProtocol.split('/')[0]),
                            'host_ip': portBindings[portAndProtocol][index]["HostIp"],
                            'host_port': parseInt(portBindings[portAndProtocol][index]["HostPort"]),
                            'protocol': portAndProtocol.split('/')[1]
                        });
                    }
                }
            }
        }

        return bindings;
    })(this.getContainerFacts().NetworkSettings.Ports);
    const TAGS = this.extractTagsFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_TAGS=.*$", null);
    const IPS = (function (networkSettings) {
        let ips = [];

        for (let key in networkSettings.Networks) {
            if (networkSettings.Networks.hasOwnProperty(key)) {
                if (networkSettings.Networks[key].hasOwnProperty("IPAddress") && networkSettings.Networks[key]["IPAddress"]) {
                    let ip = (function (ip) {
                        for (let registratorIp in REGISTRATOR_IPS) {
                            if (!OWN_NETWORK_ONLY || (OWN_NETWORK_ONLY && require("ip").subnet(registratorIp, REGISTRATOR_IPS[registratorIp]).contains(ip))) {
                                return ip;
                            }
                        }

                        return null;
                    })(networkSettings.Networks[key]["IPAddress"]);
                    ip && ips.push(ip);
                }
            }
        }

        return ips;
    })(this.getContainerFacts().NetworkSettings);
    const REGISTER_ME = (function (self) {
        if (IS_IGNORED) return false;
        if (!IS_RUNNING) return false;
        if (SERVICES_WITH_PORT_BINDINGS_ONLY && !self.getPortBindings().length) return false;
        if (!self.getIps().length) return false;

        return true;
    })(this);
    const NAME = this.extractNameFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_NAME=.*$", this.getContainerFacts().Name.substr(1).replace(/_\d+$/, '').replace(/_/g, '-'));
    const CHECKS = this.extractChecksFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_CHECK_[A-Z]+=.*$", {
        'ips': IPS,
        'port': ''
    }, null);
};

Container.prototype.consulRegister = function (callback) {
    // do not register any service(s)
    if (!this.getRegisterMe()) return;

    if (this.getServicesWithPortBindingsOnly()) {
        for (let index = 0; index < this.getPortBindings().length; index++) {
            // do not register service
            if (this.extractIsIgnoredFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + this.getPortBindings()[index]['container_port'] + "_IGNORE=.*$")) continue;

            // gather other facts
            let name = this.extractNameFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + this.getPortBindings()[index]['container_port'] + "_NAME=.*$", this.getName());
            let id = this.getId() + ":" + name + ":" + this.getPortBindings()[index]['host_port'] + ":" + this.getPortBindings()[index]['protocol'];
            let tags = this.extractTagsFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + this.getPortBindings()[index]['container_port'] + "_TAGS=.*$", this.getTags());
            let checks = this.extractChecksFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + this.getPortBindings()[index]['container_port'] + "_CHECK_.*=.*$", {
                'ips': this.getIps(),
                'port': this.getPortBindings()[index]['container_port']
            }, this.getChecks());

            (function (options, agent) {
                agent.service.register(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({
                "name": name,
                "id": id,
                "tags": tags,
                "address": this.getPortBindings()[index]['host_ip'],
                "port": this.getPortBindings()[index]['host_port'],
                "checks": checks
            }, this.getConsulAgent());
        }
    } else if (this.getExposedPorts().length) {
        for (let index = 0; index < this.getExposedPorts().length; index++) {
            let port = parseInt(this.getExposedPorts()[index].split('/')[0]);

            // do not register service
            if (this.extractIsIgnoredFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + port + "_IGNORE=.*$")) continue;

            // gather other facts
            let protocol = this.getExposedPorts()[index].split('/')[1];
            let name = this.extractNameFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + port + "_NAME=.*$", this.getName());
            let id = this.getId() + ":" + name + ":" + port + ":" + protocol;
            let tags = this.extractTagsFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + port + "_TAGS=.*$", this.getTags());
            let checks = this.extractChecksFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + port + "_CHECK_.*=.*$", {
                'ips': this.getIps(),
                'port': port
            }, this.checks);

            (function (options, agent) {
                agent.service.register(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({
                "name": name,
                "id": id,
                "tags": tags,
                "address": this.getIps()[0], // always register one IP no matter how many are available
                "port": port,
                "checks": checks
            }, this.getConsulAgent());
        }
    } else {
        (function (options, agent) {
            agent.service.register(options, function (err, data, res) {
                callback(err, data, res, options);
            });
        })({
            "name": this.getName(),
            "id": this.getId() + ":" + this.getName(),
            "tags": this.getTags(),
            "address": this.getIps()[0], // always register one IP no matter how many are available
            "checks": this.getChecks()
        }, this.getConsulAgent());
    }
};

Container.prototype.consulDeregister = function (callback) {
    if (this.getServicesWithPortBindingsOnly()) {
        for (let index = 0; index < this.getPortBindings().length; index++) {
            let name = this.extractNameFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + this.getPortBindings()[index]['container_port'] + "_NAME=.*$", this.getName());

            (function (options, agent) {
                agent.service.deregister(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({"id": this.getId() + ":" + name + ":" + this.getPortBindings()[index]['host_port'] + ":" + this.getPortBindings()[index]['protocol']}, this.getConsulAgent());
        }
    } else if (this.getExposedPorts().length) {
        for (let index = 0; index < this.getExposedPorts().length; index++) {
            let port = parseInt(this.getExposedPorts()[index].split('/')[0]);
            let protocol = this.getExposedPorts()[index].split('/')[1];
            let name = this.extractNameFromEnvironment(this.getContainerFacts().Config.Env, "^SERVICE_" + port + "_NAME=.*$", this.getName());

            (function (options, agent) {
                agent.service.deregister(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({"id": this.getId() + ":" + name + ":" + port + ":" + protocol}, this.getConsulAgent());
        }
    } else {
        (function (options, agent) {
            agent.service.deregister(options, function (err, data, res) {
                callback(err, data, res, options);
            });
        })({"id": this.getId() + ":" + this.getName()}, this.getConsulAgent());
    }
};

module.exports = Container;
