var debug = require('debug')('rssreader:testapp');
var util = require('util');
var events = require('events');
var ipc = new events.EventEmitter();

function isActive (element) {
    return element.active;
}

var handleEntry = function (item, callback) {
    debug(util.inspect(item, { colors: true }));
    callback(null, item);
};

var getFeeds = function (options, callback) {
    var feeds = require('./template');
    callback(null, feeds.filter(isActive));
};

var markAsBroken = function (item, callback) {
    item.broken = true;
    debug('Broken source', util.inspect(item, { colors: true }));
    callback(null, item);
};

var markAsUnavailable = function (item, callback) {
    item.unavailable = true;
    debug('Unavailable source', util.inspect(item, { colors: true }));
    callback(null, item);
};


// RssReader
var RssReader = require('../lib');

// rss reader/scraper module
var rssReader = new RssReader({
    getSources: getFeeds,
    handleEntry: handleEntry,
    markAsBroken: markAsBroken,
    markAsUnavailable: markAsUnavailable,
    ipc: ipc,
    sockets: 15,
    waitTime: 10000,
    timeOut: 5000
});

console.log('running rss-reader');

rssReader.run();