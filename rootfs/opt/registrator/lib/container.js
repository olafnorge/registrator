const Container = function (definition, consulAgent) {
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

    this.getIsIgnored = function (env, regex) {
        let matcher = new RegExp(regex);

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                let value = env[index].split('=', 2)[1];
                return value === true || value === 1 || value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
            }
        }

        return false;
    };
    this.getName = function (env, regex, fallback) {
        let matcher = new RegExp(regex);

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                return env[index].split('=', 2)[1];
            }
        }

        return fallback;
    };
    this.getPorts = function (ports) {
        return ports instanceof Object ? Object.keys(ports) : [];
    };
    this.getTags = function (env, regex, fallback) {
        let tmp = fallback || [];
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

        return tmp.length ? tmp : fallback;
    };
    this.getIp = function (networkSettings) {
        if (!networkSettings.IPAddress) {
            for (let key in networkSettings.Networks) {
                if (networkSettings.Networks.hasOwnProperty(key)) {
                    // return first available IP address from network settings
                    if (networkSettings.Networks[key].hasOwnProperty("IPAddress") && networkSettings.Networks[key]["IPAddress"]) {
                        return networkSettings.Networks[key]["IPAddress"];
                    }
                }
            }
        }

        return networkSettings.IPAddress;
    };
    this.getChecks = function (env, regex, service, fallback) {
        let tmp = fallback || [];
        let check = {};
        let matcher = new RegExp(regex);
        let checkExists = false;

        for (let index = 0; index < env.length; index++) {
            if (matcher.test(env[index])) {
                let key = env[index].split('=', 2)[0].split('_').pop().toLowerCase().trim();
                let value = env[index].split('=', 2)[1].replace('$SERVICE_IP', service.ip).replace('$SERVICE_PORT', service.port).trim();
                check[key] = value;
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

        return tmp.length ? tmp : fallback;
    };

    this.definition = definition;
    this.name = this.getName(this.definition.Config.Env, "^SERVICE_NAME=.*$", this.definition.Name.substr(1).replace(/_\d+$/, '').replace(/_/g, '-'));
    this.ip = this.getIp(this.definition.NetworkSettings);
    this.ports = this.getPorts(this.definition.Config.ExposedPorts);
    this.tags = this.getTags(this.definition.Config.Env, "^SERVICE_TAGS=.*$", null);
    this.id = this.definition.Id;
    this.agent = consulAgent;
    this.isIgnored = this.getIsIgnored(this.definition.Config.Env, "^SERVICE_IGNORE=.*$");
    this.isRunning = this.definition.State.Status === "running";
    this.checks = this.getChecks(this.definition.Config.Env, "^SERVICE_CHECK_[A-Z]+=.*$", {
        'ip': this.ip,
        'port': null
    }, null);
};

Container.prototype.consulRegister = function (callback) {
    // do not register any service(s)
    if (this.isIgnored || !this.isRunning) return;

    if (this.ports.length) {
        for (let index = 0; index < this.ports.length; index++) {
            let port = parseInt(this.ports[index].split('/')[0]);

            // do not register service
            if (this.getIsIgnored(this.definition.Config.Env, "^SERVICE_" + port + "_IGNORE=.*$")) continue;

            // gather other facts
            let protocol = this.ports[index].split('/')[1];
            let name = this.getName(this.definition.Config.Env, "^SERVICE_" + port + "_NAME=.*$", this.name);
            let id = this.id + ":" + name + ":" + port + ":" + protocol;
            let tags = this.getTags(this.definition.Config.Env, "^SERVICE_" + port + "_TAGS=.*$", this.tags);
            let checks = this.getChecks(this.definition.Config.Env, "^SERVICE_" + port + "_CHECK_.*=.*$", {
                'ip': this.ip,
                'port': port
            }, this.checks);

            (function (options, agent) {
                agent.service.register(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({"name": name, "id": id, "tags": tags, "address": this.ip, "port": port, "checks": checks}, this.agent);
        }
    } else {
        (function (options, agent) {
            agent.service.register(options, function (err, data, res) {
                callback(err, data, res, options);
            });
        })({
            "name": this.name,
            "id": this.id + ":" + this.name,
            "tags": this.tags,
            "address": this.ip,
            "checks": this.checks
        }, this.agent);
    }
};

Container.prototype.consulDeregister = function (callback) {
    if (this.ports.length) {
        for (let index = 0; index < this.ports.length; index++) {
            let port = parseInt(this.ports[index].split('/')[0]);
            let protocol = this.ports[index].split('/')[1];
            let name = this.getName(this.definition.Config.Env, "^SERVICE_" + port + "_NAME=.*$", this.name);

            (function (options, agent) {
                agent.service.deregister(options, function (err, data, res) {
                    callback(err, data, res, options);
                });
            })({"id": this.id + ":" + name + ":" + port + ":" + protocol}, this.agent);
        }
    } else {
        (function (options, agent) {
            agent.service.deregister(options, function (err, data, res) {
                callback(err, data, res, options);
            });
        })({"id": this.id + ":" + this.name}, this.agent);
    }
};

module.exports = Container;
