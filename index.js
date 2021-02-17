const fs = require('fs');
const doT = module.exports = require('./doT');

doT.process = function(options) {
	return new InstallDots(options).compileAll();
};

function InstallDots(o) {
	this.__path = o.path || "./";
	if (this.__path[this.__path.length-1] !== '/')
		this.__path += '/';
	this.__destination	= o.destination || this.__path;
	if (this.__destination[this.__destination.length-1] !== '/')
		this.__destination += '/';
	this.__global = o.global || "window.render";
	this.__rendermodule = o.rendermodule || {};
	this.__settings = Object.prototype.hasOwnProperty.call(o, 'config') ? copy(o.config, copy(doT.config)) : undefined;
	this.__includes = {};
}

InstallDots.prototype.compileToFile = function(path, template, def) {
	def = def || {};
	var modulename = path.substring(path.lastIndexOf('/')+1, path.lastIndexOf('.')),
		defs = copy(this.__includes, copy(def)),
		settings = this.__settings || doT.config,
		compileoptions = copy(settings),
		defaultcompiled = doT.template(template, settings, defs),
		exports = [],
		compiled = '',
		fn;
	for (var property in defs) {
		if (defs[property] !== def[property] && defs[property] !== this.__includes[property]) {
			fn = undefined;
			if (typeof defs[property] === 'string')
				fn = doT.template(defs[property], settings, defs);
			else if (typeof defs[property] === 'function')
				fn = defs[property];
			else if (defs[property].arg) {
				compileoptions.varname = defs[property].arg;
				fn = doT.template(defs[property].text, compileoptions, defs);
			}
			if (fn) {
				compiled += fn.toString().replace('anonymous', property);
				exports.push(property);
			}
		}
	}
	compiled += defaultcompiled.toString().replace('anonymous', modulename);
	fs.writeFileSync(path, '(function(){'+compiled
	+ 'var itself='+modulename+', _encodeHTML=('+doT.encodeHTMLSource.toString()+'('+(settings.doNotSkipEncoded || '')+'));'
	+ addexports(exports)
	+ "if(typeof module!=='undefined' && module.exports) module.exports=itself;else if(typeof define==='function')define(function(){return itself;});else {"
	+ this.__global+'='+this.__global+'||{};'+this.__global+"['"+modulename+"']=itself;}}());");
};

function addexports(exports) {
	var ret = '';
	for (var i=0; i< exports.length; i++) {
		ret += 'itself.'+exports[i]+'='+exports[i]+';';
	}
	return ret;
}

function copy(o, to) {
	to = to || {};
	for (var property in o) {
		to[property] = o[property];
	}
	return to;
}

function readdata(path) {
	var data = fs.readFileSync(path);
	if (data)
		return data.toString();
	console.log('problems with '+path);
}

InstallDots.prototype.compilePath = function(path) {
	var data = readdata(path);
	if (data)
		return doT.template(data, this.__settings || doT.config, copy(this.__includes));
};

InstallDots.prototype.compileAll = function() {
	console.log('Compiling all doT templates...');
	var defFolder = this.__path,
		sources = fs.readdirSync(defFolder),
		k, l, name;
	for (k = 0, l = sources.length; k < l; k++) {
		name = sources[k];
		if (/\.def(\.dot|\.jst|\.html)?$/.test(name)) {
			console.log('Loaded def '+name);
			this.__includes[name.substring(0, name.indexOf('.'))] = readdata(defFolder+name);
		}
	}
	for (k = 0, l = sources.length; k < l; k++) {
		name = sources[k];
		if (/\.dot(\.def|\.jst|\.html)?$/.test(name)) {
			console.log('Compiling '+name+' to function');
			this.__rendermodule[name.substring(0, name.indexOf('.'))] = this.compilePath(defFolder+name);
		}
		if (/\.jst(\.dot|\.def)?$/.test(name)) {
			console.log('Compiling '+name+' to file');
			this.compileToFile(this.__destination + name.substring(0, name.indexOf('.'))+'.js',
			readdata(defFolder+name));
		}
	}
	return this.__rendermodule;
};
