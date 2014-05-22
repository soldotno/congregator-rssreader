var read = require('node-read');
var async = require('async');
var debug = require('debug')('rssreader:content-fetcher');
var util = require('util');
var Entities = require('html-entities').AllHtmlEntities;
var entities = new Entities();

exports = module.exports = function () {
    return function (feed, entries, callback) {
        if (!feed.body){
            callback(null, null);
            return;
        }

        if (!feed.linkref){
            callback(null, null);
            return;
        }

        var processed = [];

        // loop through each entry and get the body content
        async.each(entries, function (item, callback) {
            process.nextTick(function () {
                if (!item[feed.linkref]) return callback();

                read(item[feed.linkref], { pool: this.agent, timeout: this.timeOut }, function (err, article, res) {
                    // override when error occurs
                    if (err) {
                        debug('got error for guid: ' + item.guid + ' - ' + util.inspect(err));
                        callback();
                        return;
                    }

                    // add content to item
                    item.content = {
                        title: article.title,
                        body: entities.decode(article.content),
                        image: getMetaImage(article.dom, item[feed.linkref])
                    };

                    // add to result list
                    processed.push(item);

                    // callback
                    callback();
                }.bind(this));
            }.bind(this));
        }.bind(this),
        function (err) {
            if (err) debug(util.inspect(err));
            callback(err, processed);
        });
    };
};

function getMetaImage ($, link) {
    var meta = $('meta');
    var keys = Object.keys(meta);

    var ogImage;

    keys.forEach(function (key) {
        if (meta[key].attribs && meta[key].attribs.property && meta[key].attribs.property === 'og:image') {
            ogImage = meta[key].attribs.content;
        }
    });

    if (ogImage) ogImage = fixRelativePath(ogImage, link);

    return ogImage;
}

function fixRelativePath (link, source) {
    var pat = /^https?:\/\//i;
    return !pat.test(link) ? url.resolve(source, link) : link;
}
