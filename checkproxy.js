var util = require('util'),
    async = require('async'),
    moment = require('moment'),
    _ = require('underscore'),
    fs = require('fs');

_.str = require('underscore.string');
_.mixin(_.str.exports());
_.str.include('Underscore.string', 'string'); // => true

console.log('Worked, please wait...\n');

var config = {
  'childCount': 20
},
    file = (!_.isUndefined(process.argv[2])) ? process.argv[2] : 'proxy.txt';

var nowDateStr = moment().format("YYYY-MM-DD_HH_mm");
var goodProxyFileName = 'goodProxy_'+nowDateStr;

if (_(file).count('.') === 0 || _(file).count('.') > 1) {
    goodProxyFileName = file +'.'+ goodProxyFileName;
} else {
    var splitStr = file.split('.');
    goodProxyFileName = splitStr[0] +'_'+ goodProxyFileName + '.'+ splitStr[1];
}

function readLines(input, func, endCb) {
    var remaining = '';

    input.on('data', function(data) {
        remaining += data;
        var index = remaining.indexOf('\n');
        var last  = 0;
        while (index > -1) {
            var line = remaining.substring(last, index);
            last = index + 1;
            func(line);
            index = remaining.indexOf('\n', last);
        }

        remaining = remaining.substring(last);
    });

    input.on('end', function() {
        if (remaining.length > 0) {
            func(remaining);
        }
        endCb();
    });
}

var runRead = function(cb) {
        var fileDataArray = [];
        readLines(fs.createReadStream(file), function(line) {
            fileDataArray.push(line);
        }, function() {
            cb(fileDataArray);
        });
},  goodProxyListAll = [];

async.parallel(
    [runRead],
    function(data) {

        var lists = _.toArray(_.groupBy(data, function(element, index){
            return Math.floor(index/config.childCount);
        }));

        lists.forEach(function(ipStringArray) {
            var worker = require('child_process').fork('./lib/worker.js', ['runAsChild']);
            worker.on('message', function(goodProxyList) {
              if (goodProxyList.length) {
                  console.log('pid'+worker.pid, goodProxyList);

                  goodProxyList.forEach(function(goodIpString) {
                      goodProxyListAll.push(goodIpString);
                      fs.appendFile(goodProxyFileName, util.format('%s\n',goodIpString), function(err) {
                          if(err) console.log(err);
                      });
                  });
              }

              worker.kill('SIGHUP');
            });
            worker.send(ipStringArray);
        });
    }
);

process.on('exit', function(code) {
    if (goodProxyListAll.length) {
        console.log('\nWork finish, result in file: %s', goodProxyFileName);
    } else {
        console.log('\nWork finish, good proxy not found for file: %s', file);
    }
});


