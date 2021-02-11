(function () {
	"use strict";
	var doT = {
		name: "doT",
		version: "1.1.1",
		templateSettings: {
			evaluate:    /\<\?js([\s\S]+?)\?\>/g, // <?js ?>
			interpolate: /\<\?js=([\s\S]+?)\?\>/g, // <?js= it.html ?>
			encode:      /\<\?js!([\s\S]+?)\?\>/g, // <?js! it.html ?>
			use:         /\<\?js-\s*([\s\S]+?)\s*\?\>/g, // <?js- ?>
			useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
			define:      /(?:\<\?js|\{\{)#\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)(?:;\s*\?\>|\}\})/g, // <?js# ;?> || {{# }}
			defineParams:/^\s*([\w$]+):([\s\S]+)/,
			varname:	'$this',
			strip:		true
		},
		template: undefined, //fn, compile template
		compile:  undefined, //fn, for express
		log: true
	}, _globals;
	doT.encodeHTMLSource = function() {
		var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;", "/": "&#47;" },
			matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
		return function(code) {
			return code ? code.toString().replace(matchHTML, function(m) {
				return encodeHTMLRules[m] || m;
			}) : "";
		};
	};
	_globals = (function(){
		return this || (0,eval)("this");
	}());

	/* istanbul ignore else */
	if (typeof module !== "undefined" && module.exports) {
		module.exports = doT;
	} else if (typeof define === "function" && define.amd) {
		define(function(){return doT;});
	} else {
		_globals.doT = doT;
	}

	var cse = {
			start: "'+(",
			end: ")+'",
			startencode: "'+encodeHTML("
		},
		skip = /$^/;

	function resolveDefs(c, block, def) {
		return ((typeof block === "string") ? block : block.toString())
			// .replace(new RegExp('<!--\\?js', 'g'), '<\?js').replace(new RegExp('\\?-->', 'g'), '\?>').replace(/<!--(.*?)-->/gs, '')
			.replace(c.define || skip, function(m, code, assign, value) {
				if (code.indexOf("def.") === 0)
					code = code.substring(4);
				if (!(code in def)) {
					if (assign === ":") {
						if (c.defineParams)
							value.replace(c.defineParams, function(m, param, v) {
								def[code] = {arg: param, text: v};
							});
						if (!(code in def))
							def[code]= value;
					}else
						new Function("def", "def['"+code+"']=" + value)(def);
				}
				return "";
			})
			.replace(c.use || skip, function(m, code) {
				if (c.useParams)
					code = code.replace(c.useParams, function(m, s, d, param) {
						if (def[d] && def[d].arg && param) {
							var rw = (d+":"+param).replace(/'|\\/g, "_");
							def.__exp = def.__exp || {};
							def.__exp[rw] = def[d].text.replace(new RegExp("(^|[^\\w$])" + def[d].arg + "([^\\w$])", "g"), "$1" + param + "$2");
							return s + "def.__exp['"+rw+"']";
						}
					});
				var v = new Function("def", "return " + code)(def);
				return v ? resolveDefs(c, v, def) : v;
			});
	}
	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
	}
	doT.template = function(tmpl, c, def) {
		// var str = tmpl.replace(new RegExp('<!--\\?js', 'g'), '<\?js').replace(new RegExp('\\?-->', 'g'), '\?>').replace(/<!--(.*?)-->/gs, '');
		c = c || doT.templateSettings;
		var needhtmlencode,
			sid = 0,
			indv,
			str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;
		str = (
			"var out='"+(c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g, " ").replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,"") : str)
			.replace(/'|\\/g, "\\$&")
			.replace(c.interpolate || skip, function(m, code) {
				return cse.start + unescape(code) + cse.end;
			})
			.replace(c.encode || skip, function(m, code) {
				needhtmlencode = true;
				return cse.startencode + unescape(code) + cse.end;
			})
			.replace(c.evaluate || skip, function(m, code) {
				return "';" + unescape(code) + "out+='";
			})
			+"';return out;"
		)
		.replace(/\n/g, "\\n").replace(/\t/g, '\\t').replace(/\r/g, "\\r")
		.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, "");
		//.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');
		if ((typeof module !== "undefined" && module.exports) || (typeof define === "function" && define.amd))
			str = 'var { location, navigator } = $this.global || {};'+str;
		if (needhtmlencode)
			str = "var encodeHTML = typeof _encodeHTML !== 'undefined' ? _encodeHTML : ("+doT.encodeHTMLSource.toString()+"());"+str;
		try {
			return new Function(c.varname, str);
		} catch (e) {
			if (typeof console !== "undefined")
				console.log("Could not create a template function: " + str);
			throw e;
		}
	};
	doT.compile = function(tmpl, def) {
		return doT.template(tmpl, null, def);
	};
}());
