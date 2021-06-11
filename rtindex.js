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
const express = require('express');
var exec = require('sync-exec');
const app = express();
const port = 3123


let processed = [];
let urimap = {};
let waiting = [];


let crawlPage = (uri) => {
	var res = exec('google-chrome-stable --headless --disable-gpu --virtual-time-budget=8000 --blink-settings=imagesEnabled=false --no-sandbox --dump-dom ' + config.base + uri);
	content = res.stdout;
	return content;
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

let saveContent = async (path, content) => {
	if (!content)
		return;

	shell.mkdir('-p', path.path);
	await fs.writeFileSync(path.fpath, content);
};


let main = async () => {
	const uri = process.argv[2].replace('https://app', '');
	const path = uriToPath(uri);

	try {
		const content = fs.readFileSync(path.fpath, 'utf8');
		console.log('Content-type:text/html\r\n' + content);
	} catch (err) {
		/* Otherwise download it and save */
		let content = crawlPage(uri);
		await saveContent(path, content);
		console.log('Content-type:text/html\r\n' + content);
	}
};

let mainExpress = () => {
	app.get('*', async (req, res) => {
		const uri = req.url.replace('/https', 'https').replace('https://app', '').replace('%3f_escaped_fragment_=', '');
		const urinoargs = uri.split('%3f')[0];
		const path = uriToPath(urinoargs);

		try {
			const content = fs.readFileSync(path.fpath, 'utf8');
			console.log(`Snapcrawler - Present, returning ${urinoargs}`);
			res.send(content);
		} catch (err) {
			console.log(`Snapcrawler - Not present, getting ${urinoargs}`);
			/* Otherwise download it and save */
			let content = crawlPage(uri);
			await saveContent(path, content);
			console.log(`Snapcrawler - Created, returning ${urinoargs}`);
			res.send(content);
		}
	});

	app.listen(port, () => console.log(`Example app listening on port ${port}!`));
}

try {
	mainExpress();
} catch (err) {

}