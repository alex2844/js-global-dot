"use strict"

// doT.js
// 2011-2014, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.

const config = {
	evaluate: /\<\?js([\s\S]+?)\?\>/g, // <?js ?>
	interpolate: /\<\?js=([\s\S]+?)\?\>/g, // <?js= it.html ?>
	encode: /\<\?js!([\s\S]+?)\?\>/g, // <?js! it.html ?>
	use: /\<\?js-\s*([\s\S]+?)\s*\?\>/g, // <?js- ?>
	useParams: /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
	define: /(?:\<\?js|\{\{)#\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)(?:;\s*\?\>|\}\})/g, // <?js# ;?> || {{# }}
	defineParams: /^\s*([\w$]+):([\s\S]+)/,
	varname: '$this',
	strip: true
};

function encodeHTMLSource() {
	const encodeHTMLRules = {
		'&': '&#38;',
		'<': '&#60;',
		'>': '&#62;',
		'"': '&#34;',
		"'": '&#39;',
		'/': '&#47;'
	}
	const matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
	return function(s) {
		return s ? s.toString().replace(matchHTML, m => (encodeHTMLRules[m] || m)) : ''
	}
};

function resolveDefs(c, block, def) {
	return ((typeof block === 'string') ? block : block.toString())
		// .replace(new RegExp('<!--\\?js', 'g'), '<\?js').replace(new RegExp('\\?-->', 'g'), '\?>').replace(/<!--(.*?)-->/gs, '')
		.replace(c.define, (_, code, assign, value) => {
			if (code.indexOf('def.') === 0)
				code = code.substring(4);
			if (!(code in def)) {
				if (assign === ':') {
					value.replace(c.defineParams, (_, param, v) => {
						def[code] = {arg: param, text: v};
					});
					if (!(code in def))
						def[code] = value;
				}else
					new Function('def', "def['"+code+"']="+value)(def);
			}
			return '';
		})
		.replace(c.use, (_, code) => {
			code = code.replace(c.useParams, (_, s, d, param) => {
				if (def[d] && def[d].arg && param) {
					var rw = (d+":"+param).replace(/'|\\/g, "_");
					def.__exp = def.__exp || {};
					def.__exp[rw] = def[d].text.replace(new RegExp("(^|[^\\w$])"+def[d].arg+"([^\\w$])", "g"), "$1"+param+"$2");
					return s+"def.__exp['"+rw+"']";
				}
			});
			var v = new Function('def', 'return '+code)(def);
			return v ? resolveDefs(c, v, def) : v;
		});
}
function unescape(code) {
	return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
}

function template(tmpl, c, def) {
	// var str = tmpl.replace(new RegExp('<!--\\?js', 'g'), '<\?js').replace(new RegExp('\\?-->', 'g'), '\?>').replace(/<!--(.*?)-->/gs, '');
	c = c || doT.config;
	let needhtmlencode,
		sid = 0,
		indv,
		str  = resolveDefs(c, tmpl, def || {});
	str = (
		"var out='"+(c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g, " ").replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,"") : str)
		.replace(/'|\\/g, "\\$&")
		.replace(c.interpolate, (_, code) => "'+("+unescape(code)+")+'")
		.replace(c.encode, (_, code) => {
			needhtmlencode = true;
			return "'+encodeHTML("+unescape(code)+")+'";
		})
		.replace(c.evaluate, (_, code) => "';"+unescape(code)+"out+='")
		+"';return out;"
	)
	.replace(/\n/g, "\\n").replace(/\t/g, '\\t').replace(/\r/g, "\\r")
	.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, "");
	if ((typeof module !== 'undefined' && module.exports) || (typeof define === 'function' && define.amd))
		str = 'var { location, navigator } = $this.global || {};'+str;
	if (needhtmlencode)
		str = 'var encodeHTML = typeof _encodeHTML !== "undefined" ? _encodeHTML : ('+encodeHTMLSource.toString()+'());'+str;
	try {
		return new Function(c.varname, str);
	} catch (e) {
		if (typeof console !== 'undefined')
			console.log('Could not create a template function: '+str);
		throw e;
	}
}

function compile(tmpl, def) {
	return template(tmpl, null, def)
}

const doT = {
	config, template, compile
}

if (typeof(window) == 'object')
	window.doT = doT;
if (typeof(module) == 'object')
	module.exports = doT;
