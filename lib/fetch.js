var debug = require('debug')('rssreader:fetch');
var debug_error = require('debug')('rssreader:error');
var colors = require('colors');
var util = require('util');
var async = require('async');
var iconv = require('iconv-lite');

exports = module.exports = function (request, FeedParser) {
    return function (feed, callback) {
        debug('beginning fetch for feed: '.yellow + feed.name.magenta);

        var ranking = 0; // rank the articles by position in feed
        var formattedPosts = []; // formatted posts holder

        var feedparser = new FeedParser(); // create a feed parser (rss)

        var requestOptions = {
            url: feed.url,
            encoding: null,
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml'
            },
            timeout: 10000,
            pool: false
        };

        async.waterfall([
            // fetch raw feed entries
            function (callback) {
                request(requestOptions, function (error, response, body){
                    if(!error && response.statusCode == 200){
                        var streamCounter = 0; // keep count of streams
                        var data = []; // hold data (posts)

                        // handle incoming stream
                        feedparser.on('readable', function () {
                            var stream = this;
                            var item;

                            // iterate through each post (here is where we pool all posts for processing)
                            while (item = stream.read()) {
                                data.push(item);
                            }
                        });

                        // handle 'end' event for stream
                        feedparser.on('end', function () {
                            if (data.length) {
                                callback(null, data);
                            } else {
                                callback('Error: empty data');
                            }
                        }.bind(this));

                        feedparser.on('error', function () {
                            debug_error('Wrong feed'.red, feed.name.magenta, feed.url);
                        }.bind(this));

                        // convert to UTF-8 encoding if the response isn't already
                        var charset = getParams(response.headers['content-type'] || '').charset;
                        charset = charset || 'iso-8859-1'; // if no charset header, assume iso-8859-1
                        var charSetIsNotUtf = !/utf-*8/i.test(charset); // check if charset is different from UTF-8

                        if (charSetIsNotUtf && iconv.encodingExists(charset)) {
                            debug('<- charset is not utf-8, converting ->');
                            var temp = iconv.decode(body, charset);
                            body = iconv.encode(temp, 'utf-8');
                        }

                        feedparser.write(body); // write body to feedparser
                        feedparser.end(); // end stream
                    }
                    else if (error) {
                        callback(error);
                    }
                    else {
                        debug('error - status: ' + response.statusCode);
                        callback();
                    }
                }.bind(this));
            }.bind(this),
            // handle and parse feed entries
            function (entries, callback) {
                async.eachSeries(entries, function (post, callback) {
                    try {
                        var formattedPost = this.handler(post, feed, ++ranking);
                        formattedPosts.push(formattedPost);
                        callback();
                    } catch (ex) {
                        debug_error('Something wrong with entries:'.red, feed.url)
                        callback(ex.message)
                    }
                }.bind(this), function (err) {
                    callback(err, formattedPosts);
                });
            }.bind(this)
        ], function (err, result) {
            callback(err, result);
        });
    };
};

// helper function to get parameters
function getParams (str) {
    var params = str.split(';').reduce(function (params, param) {
        var parts = param.split('=').map(function (part) {
            return part.trim();
        });
        if (parts.length === 2) {
            params[parts[0]] = parts[1];
        }
        return params;
    }, {});
    return params;
}
