/* 
 *  Helperbit: a p2p donation platform (snapcrawler)
 *  Copyright (C) 2016-2021  Helperbit team
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>
 */

const config = require('./config.json');
const Promise = require('bluebird');
const fs = require('fs');
const shell = require('shelljs');
const request = require('request-promise-native');
var exec = require('sync-exec');

let processed = [];
let urimap = {};
let waiting = [];
const disableJS = false;

const getPaginated = async (uri, field, modifier, q) => {
	let i = 0;
	let count = 25;
	let list = [];
	while (i * 24 < count) {
		q['page'] = i;
		let data = null;
		try {
			data = (await request.post({ url: 'https://api/api/v1/' + uri, body: q, json: true }));
		} catch (err) {
			return [];
		}
		list = list.concat(data[field].map(modifier));
		count = data.count;
		i += 1;
	}

	list.forEach(u => {
		urimap[u] = {
			'en': u,
			'es': u + '?lang=es', // '/es' + u,
			'it': u + '?lang=it' //'/it' + u
		};
	});

	return list;
};

const injectPages = async () => {
	waiting = waiting.concat(await getPaginated('organizations/list', 'organizations', e => `/user/${e.username}`, { "page": 0, "sort": "desc", "orderby": "received", "limit": 24 }));
	waiting = waiting.concat(await getPaginated('donations', 'donations', e => `/donation/${e.txid}`, { "page": 0, "sort": "desc", "orderby": "time", "limit": 24 }));
	waiting = waiting.concat(await getPaginated('projects/list', 'projects', e => `/project/${e._id}`, { "page": 0, "sort": "desc", "orderby": "start", "limit": 24 }));
	waiting = waiting.concat(await getPaginated('events/list', 'events', e => `/event/${e._id}`, { "page": 0, "sort": "desc", "orderby": "earthquakes.date", "limit": 24 }));
	console.log(waiting.length);
};


const saveImageSitemap = (dest) => {
	let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';


	Object.keys(urimap).forEach(uri => {
		if (!('images' in urimap[uri]) || urimap[uri].images.length == 0)
			return;

		urien = config.base + urimap[uri].en;
		sitemap += `\t<url>\n\t\t<loc>${urien}</loc>\n`;

		urimap[uri].images.forEach(im => {
			if (im.src.indexOf('http') == -1)
				im.src = config.base + im.src;

			sitemap += `\t\t<image:image>\n\t\t\t<image:loc>${im.src}</image:loc>\n`;
			if ('alt' in im && im.alt) {
				sitemap += `\t\t\t<image:caption>${im.alt}</image:caption>\n`;
				sitemap += `\t\t\t<image:title>${im.alt}</image:title>\n`;
			}

			sitemap += '\t\t</image:image>\n';
		});

		sitemap += `\t</url>\n`;
	});

	sitemap += '</urlset>';

	fs.writeFile(dest, sitemap, function (err) {
		console.log(`-> Saved images ${dest}`);
	});
};

const saveSitemap = (dest) => {
	const priorityOfPage = function (uri) {
		for (let i = 0; i < config.priorities.length; i++) {
			let p = config.priorities[i];

			if (typeof (p.path) == 'string') {
				if (uri.en == p.path) {
					return p;
				}
			} else {
				let m = true;

				for (let j = 0; j < p.path.length; j++)
					m = m && (uri.en.indexOf(p.path[j]) != -1);

				if (m)
					return p;
			}
		}

		return {
			priority: 0.5,
			changefreq: 'monthly'
		};
	};

	let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
	let linksmap = [];

	let lastmod = new Date().toISOString();
	Object.keys(urimap).forEach(uri => {
		uri = {
			'en': config.base + urimap[uri].en,
			'es': config.base + urimap[uri].es,
			'it': config.base + urimap[uri].it
		};

		let p = priorityOfPage(uri);

		if (uri.en.indexOf('javascript:void(0)') != -1)
			return;

		sitemap += `\t<url>\n`
			+ `\t\t<loc>${uri.en}</loc>\n`
			+ `\t\t<xhtml:link rel="alternate" hreflang="en" href="${uri.en}"/>\n`
			+ `\t\t<xhtml:link rel="alternate" hreflang="it" href="${uri.it}"/>\n`
			+ `\t\t<xhtml:link rel="alternate" hreflang="es" href="${uri.es}"/>\n`
			+ `\t\t<lastmod>${lastmod}</lastmod>\n`
			+ `\t\t<changefreq>${p.changefreq}</changefreq>\n`
			+ `\t\t<priority>${p.priority}</priority>\n\t</url>\n`;
	});

	sitemap += '</urlset>';

	fs.writeFile(dest, sitemap, function (err) {
		console.log(`-> Saved ${dest}`);
	});
};


let crawlPage = async (uri) => {
	console.log(' <- Crawling ' + uri);

	content = await request({
		url: config.base + uri,
		headers: {
			'User-Agent': 'googlebot'
		}
	});

	//var res = exec('google-chrome-stable --headless --disable-gpu  --blink-settings=imagesEnabled=false --no-sandbox --user-agent="googlebot" --dump-dom ' + config.base + uri);
	//content = res.stdout;

	var images = content.split('<img');
	let imgs = [];
	images.forEach(i => {
		if (i.indexOf('countryflags') != -1)
			return;

		if (i.indexOf('api.helperbit') == -1 || i.indexOf('.js') != -1)
			return;

		c = { src: i.split('src="')[1].split('"')[0] };

		try {
			const a = i.split('alt="')[1].split('"')[0];
			if (a.length > 0)
				c.alt = a;
		} catch (err) { }


		imgs.push(c);
	});


	var links = content.split('href="');
	var ls = [];
	links.forEach(l => {
		ls.push(l.split('"')[0])
	});

	ls = ls.filter(function (l) {
		if (l.length > 0 && l.indexOf('javascript') == -1 && l.indexOf('http') == -1 && l.indexOf('{{') == -1 && l.indexOf('{{') == -1 && l.indexOf('.img') && l.indexOf('.css') == -1 && l.indexOf('.js') && l.indexOf('<') == -1)
			return true;
		else
			return false;
	});
	ls = ls.map(l => l.split('?')[0]);

	return { uri: uri, images: imgs, links: ls, content: content };
};


let uriToPath = (uri) => {
	let urirep = uri;
	let filename = '';

	if (urirep.length <= 2) {
		urirep = '';
		filename = 'index.html';
	} else if (urirep[urirep.length - 1] == '/') {
		urirep = urirep.split('?')[0];
		let urisplit = urirep.split('/');
		filename = 'index.html';
		urisplit.splice(urisplit.length - 1, 1);
		urirep = urisplit.join('/');
	} else {
		urirep = urirep.split('?')[0];
		let urisplit = urirep.split('/');
		filename = urisplit[urisplit.length - 1];
		urisplit.splice(urisplit.length - 1, 1);
		urirep = urisplit.join('/');
	}
	var path = './snapshots/' + urirep;
	let fpath = path + '/' + filename;

	if (fpath.indexOf('.html') == -1)
		fpath += '.html';

	return { path: path, fpath: fpath };
};



let saveContent = (uri, content) => {
	let path = uriToPath(uri);
	if (!content)
		return;

	shell.mkdir('-p', path.path);

	if (path.fpath.indexOf('.html') == -1)
		path.fpath += '.html';

	fs.writeFile(path.fpath, content, function (err) {
		if (err) {
			console.log(`  <- Fail to save: ${err}`);
		} else {
			console.log(`  <- Saved: ${path.fpath}`);
		}
	});
};

let crawlPageRecursive = async (uri, lang) => {
	if (processed.indexOf(uri) != -1)
		return null;
	if (uri.length == 0)
		return null;
	if (uri.indexOf('#') != -1)
		return null;
	if (uri.indexOf('mailto:') != -1)
		return null;
	if (lang && uri.indexOf('?lang=' + lang) == -1)
		uri = uri + '?lang=' + lang;

	let r = null;

	try {
		r = await crawlPage(uri);
	} catch (err) {
		r = null;
	}

	if (r == null) return null;

	processed.push(r.uri);

	var langurls = [];
	if (lang === undefined) {
		urimap[r.uri] = {
			'en': r.uri,
			'es': r.uri + '?lang=es', // '/es' + r.uri,
			'it': r.uri + '?lang=it', //'/it' + r.uri,
			'images': r.images
		}
		langurls = [];
		langurls = [['es', r.uri], ['it', r.uri]];
		waiting.push(r.uri + '?lang=es');
		waiting.push(r.uri + '?lang=it');
	}

	saveContent(r.uri, r.content);
	saveSitemap(config.output.sitemap + '_temp.xml');
	saveImageSitemap(config.output.sitemap + '_images_temp.xml');

	let links = r.links.filter(f => {
		if (waiting.indexOf(f) != -1) {
			return false;
		} else {
			waiting.push(f);
			return true;
		}
	})

	if (lang === undefined) {
		console.log(`  <- Found ${links.length} new links (waiting: ${waiting.length}, processed: ${processed.length})`);

		if (langurls.length > 0) {
			let res = await Promise.map(langurls, l => crawlPageRecursive('/' + l[1] + '?lang=' + l[0], l[0]), { concurrency: 21 });
			return await Promise.map(links, l => crawlPageRecursive(l), { concurrency: 1 });
			return res;
		} else {
			return await Promise.map(links, l => crawlPageRecursive(l), { concurrency: 1 });
		}
	} else {
		// TODO: remvoed??? links = links.filter(l => l.indexOf('/project/') != -1 || l.indexOf('/event/') != -1);

		if (links.length > 0) {
			return await Promise.map(links, l => crawlPageRecursive(l, lang), { concurrency: 1 });
		} else {
			return null;
		}
	}
};

let main = async () => {
	if (process.argv.length > 2) {
		await crawlPageRecursive(process.argv[2].replace('https://app', ''));
	} else {
		await injectPages();
		await Promise.map(config.include, l => crawlPageRecursive(l), { concurrency: 3 });
		await Promise.map(waiting, l => crawlPageRecursive(l), { concurrency: 3 });

		saveSitemap(config.output.sitemap + '.xml');
		saveImageSitemap(config.output.sitemap + '_images.xml');
	}
};

main();
