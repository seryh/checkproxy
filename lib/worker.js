var util = require('util'),
    async = require('async'),
    _ = require('underscore'),
    portScanner = require('portscanner');

var checkProxy = function(adress, port, callback) {
    var http = require("http");
    var req = http.get({
        host: adress,
        port: port,
        path: "http://ya.ru",
        headers: {
            Host: "ya.ru"
        }
    }, function(response) {
        var str = '';
        response.on('data', function (chunk) {
            str += chunk;
        });
        response.on('end', function () {
            var isCheck = (str.indexOf('<title>Яндекс</title>') == -1) ? false : true;
            callback(isCheck, adress, port);
        });
    });

    req.setTimeout( 3000, function( ) {
        callback(false, adress, port);
        // handle timeout here
    });

    req.on('error', function(e) {
        callback(false, adress, port);
        //console.log('%s:%s -> problem with request: %s ',adress, port, e.message);
    });

    req.end();
};

var scanRun = function(ipStringArray, cb) {

    var run = function(cbOnLoopFinish) {
            var goodList = [];
            var loop = function(index) {

                if (_.isUndefined(ipStringArray[index])) {
                    cbOnLoopFinish(goodList);
                    return false;
                }

                var ipAndPortString = ipStringArray[index],
                    ipAndPortArray = ipAndPortString.split(':');

                index = index + 1;

                if (ipAndPortArray.length != 2) return true;
                var ip = ipAndPortArray[0],
                    port = ipAndPortArray[1];
                portScanner.checkPortStatus(port, {host: ip, timeout: 3000}, function(error, status) {
                    if (status != 'closed') {
                        checkProxy(ip, port, function(isCheck, _adress, _port){
                            if (isCheck) {
                                //console.log('Good proxy: %s:%s', _adress, _port);
                                goodList.push(util.format('%s:%s', ip, port));
                            }
                            loop(index);
                            return true;
                        });
                        return true;
                    }
                    loop(index);
                    return true;
                });
            };

            loop(0);
        };

    async.parallel(
        [run],
        function(goodList) {
            cb(goodList);
        }
    );

};

if (process.argv[2] == 'runAsChild') {
    process.on('message', function(ipStringArray) {
        scanRun(ipStringArray, function(result) {
            process.send(result);
        });
    });
}

module.exports = scanRun;