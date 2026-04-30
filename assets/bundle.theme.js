/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@shopify/theme-sections/section.js":
/*!*********************************************************!*\
  !*** ./node_modules/@shopify/theme-sections/section.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Section)\n/* harmony export */ });\nvar SECTION_ID_ATTR = 'data-section-id';\n\nfunction Section(container, properties) {\n  this.container = validateContainerElement(container);\n  this.id = container.getAttribute(SECTION_ID_ATTR);\n  this.extensions = [];\n\n  // eslint-disable-next-line es5/no-es6-static-methods\n  Object.assign(this, validatePropertiesObject(properties));\n\n  this.onLoad();\n}\n\nSection.prototype = {\n  onLoad: Function.prototype,\n  onUnload: Function.prototype,\n  onSelect: Function.prototype,\n  onDeselect: Function.prototype,\n  onBlockSelect: Function.prototype,\n  onBlockDeselect: Function.prototype,\n\n  extend: function extend(extension) {\n    this.extensions.push(extension); // Save original extension\n\n    // eslint-disable-next-line es5/no-es6-static-methods\n    var extensionClone = Object.assign({}, extension);\n    delete extensionClone.init; // Remove init function before assigning extension properties\n\n    // eslint-disable-next-line es5/no-es6-static-methods\n    Object.assign(this, extensionClone);\n\n    if (typeof extension.init === 'function') {\n      extension.init.apply(this);\n    }\n  }\n};\n\nfunction validateContainerElement(container) {\n  if (!(container instanceof Element)) {\n    throw new TypeError(\n      'Theme Sections: Attempted to load section. The section container provided is not a DOM element.'\n    );\n  }\n  if (container.getAttribute(SECTION_ID_ATTR) === null) {\n    throw new Error(\n      'Theme Sections: The section container provided does not have an id assigned to the ' +\n        SECTION_ID_ATTR +\n        ' attribute.'\n    );\n  }\n\n  return container;\n}\n\nfunction validatePropertiesObject(value) {\n  if (\n    (typeof value !== 'undefined' && typeof value !== 'object') ||\n    value === null\n  ) {\n    throw new TypeError(\n      'Theme Sections: The properties object provided is not a valid'\n    );\n  }\n\n  return value;\n}\n\n// Object.assign() polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill\nif (typeof Object.assign != 'function') {\n  // Must be writable: true, enumerable: false, configurable: true\n  Object.defineProperty(Object, 'assign', {\n    value: function assign(target) {\n      // .length of function is 2\n      'use strict';\n      if (target == null) {\n        // TypeError if undefined or null\n        throw new TypeError('Cannot convert undefined or null to object');\n      }\n\n      var to = Object(target);\n\n      for (var index = 1; index < arguments.length; index++) {\n        var nextSource = arguments[index];\n\n        if (nextSource != null) {\n          // Skip over if undefined or null\n          for (var nextKey in nextSource) {\n            // Avoid bugs when hasOwnProperty is shadowed\n            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {\n              to[nextKey] = nextSource[nextKey];\n            }\n          }\n        }\n      }\n      return to;\n    },\n    writable: true,\n    configurable: true\n  });\n}\n\n\n//# sourceURL=webpack://shopify-theme-starter/./node_modules/@shopify/theme-sections/section.js?");

/***/ }),

/***/ "./node_modules/@shopify/theme-sections/theme-sections.js":
/*!****************************************************************!*\
  !*** ./node_modules/@shopify/theme-sections/theme-sections.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"extend\": () => (/* binding */ extend),\n/* harmony export */   \"getInstanceById\": () => (/* binding */ getInstanceById),\n/* harmony export */   \"getInstances\": () => (/* binding */ getInstances),\n/* harmony export */   \"instances\": () => (/* binding */ instances),\n/* harmony export */   \"isInstance\": () => (/* binding */ isInstance),\n/* harmony export */   \"load\": () => (/* binding */ load),\n/* harmony export */   \"register\": () => (/* binding */ register),\n/* harmony export */   \"registered\": () => (/* binding */ registered),\n/* harmony export */   \"unload\": () => (/* binding */ unload),\n/* harmony export */   \"unregister\": () => (/* binding */ unregister)\n/* harmony export */ });\n/* harmony import */ var _section__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./section */ \"./node_modules/@shopify/theme-sections/section.js\");\n/*\n * @shopify/theme-sections\n * -----------------------------------------------------------------------------\n *\n * A framework to provide structure to your Shopify sections and a load and unload\n * lifecycle. The lifecycle is automatically connected to theme editor events so\n * that your sections load and unload as the editor changes the content and\n * settings of your sections.\n */\n\n\n\nvar SECTION_TYPE_ATTR = 'data-section-type';\nvar SECTION_ID_ATTR = 'data-section-id';\n\nwindow.Shopify = window.Shopify || {};\nwindow.Shopify.theme = window.Shopify.theme || {};\nwindow.Shopify.theme.sections = window.Shopify.theme.sections || {};\n\nvar registered = (window.Shopify.theme.sections.registered =\n  window.Shopify.theme.sections.registered || {});\nvar instances = (window.Shopify.theme.sections.instances =\n  window.Shopify.theme.sections.instances || []);\n\nfunction register(type, properties) {\n  if (typeof type !== 'string') {\n    throw new TypeError(\n      'Theme Sections: The first argument for .register must be a string that specifies the type of the section being registered'\n    );\n  }\n\n  if (typeof registered[type] !== 'undefined') {\n    throw new Error(\n      'Theme Sections: A section of type \"' +\n        type +\n        '\" has already been registered. You cannot register the same section type twice'\n    );\n  }\n\n  function TypedSection(container) {\n    _section__WEBPACK_IMPORTED_MODULE_0__[\"default\"].call(this, container, properties);\n  }\n\n  TypedSection.constructor = _section__WEBPACK_IMPORTED_MODULE_0__[\"default\"];\n  TypedSection.prototype = Object.create(_section__WEBPACK_IMPORTED_MODULE_0__[\"default\"].prototype);\n  TypedSection.prototype.type = type;\n\n  return (registered[type] = TypedSection);\n}\n\nfunction unregister(types) {\n  types = normalizeType(types);\n\n  types.forEach(function(type) {\n    delete registered[type];\n  });\n}\n\nfunction load(types, containers) {\n  types = normalizeType(types);\n\n  if (typeof containers === 'undefined') {\n    containers = document.querySelectorAll('[' + SECTION_TYPE_ATTR + ']');\n  }\n\n  containers = normalizeContainers(containers);\n\n  types.forEach(function(type) {\n    var TypedSection = registered[type];\n\n    if (typeof TypedSection === 'undefined') {\n      return;\n    }\n\n    containers = containers.filter(function(container) {\n      // Filter from list of containers because container already has an instance loaded\n      if (isInstance(container)) {\n        return false;\n      }\n\n      // Filter from list of containers because container doesn't have data-section-type attribute\n      if (container.getAttribute(SECTION_TYPE_ATTR) === null) {\n        return false;\n      }\n\n      // Keep in list of containers because current type doesn't match\n      if (container.getAttribute(SECTION_TYPE_ATTR) !== type) {\n        return true;\n      }\n\n      instances.push(new TypedSection(container));\n\n      // Filter from list of containers because container now has an instance loaded\n      return false;\n    });\n  });\n}\n\nfunction unload(selector) {\n  var instancesToUnload = getInstances(selector);\n\n  instancesToUnload.forEach(function(instance) {\n    var index = instances\n      .map(function(e) {\n        return e.id;\n      })\n      .indexOf(instance.id);\n    instances.splice(index, 1);\n    instance.onUnload();\n  });\n}\n\nfunction extend(selector, extension) {\n  var instancesToExtend = getInstances(selector);\n\n  instancesToExtend.forEach(function(instance) {\n    instance.extend(extension);\n  });\n}\n\nfunction getInstances(selector) {\n  var filteredInstances = [];\n\n  // Fetch first element if its an array\n  if (NodeList.prototype.isPrototypeOf(selector) || Array.isArray(selector)) {\n    var firstElement = selector[0];\n  }\n\n  // If selector element is DOM element\n  if (selector instanceof Element || firstElement instanceof Element) {\n    var containers = normalizeContainers(selector);\n\n    containers.forEach(function(container) {\n      filteredInstances = filteredInstances.concat(\n        instances.filter(function(instance) {\n          return instance.container === container;\n        })\n      );\n    });\n\n    // If select is type string\n  } else if (typeof selector === 'string' || typeof firstElement === 'string') {\n    var types = normalizeType(selector);\n\n    types.forEach(function(type) {\n      filteredInstances = filteredInstances.concat(\n        instances.filter(function(instance) {\n          return instance.type === type;\n        })\n      );\n    });\n  }\n\n  return filteredInstances;\n}\n\nfunction getInstanceById(id) {\n  var instance;\n\n  for (var i = 0; i < instances.length; i++) {\n    if (instances[i].id === id) {\n      instance = instances[i];\n      break;\n    }\n  }\n  return instance;\n}\n\nfunction isInstance(selector) {\n  return getInstances(selector).length > 0;\n}\n\nfunction normalizeType(types) {\n  // If '*' then fetch all registered section types\n  if (types === '*') {\n    types = Object.keys(registered);\n\n    // If a single section type string is passed, put it in an array\n  } else if (typeof types === 'string') {\n    types = [types];\n\n    // If single section constructor is passed, transform to array with section\n    // type string\n  } else if (types.constructor === _section__WEBPACK_IMPORTED_MODULE_0__[\"default\"]) {\n    types = [types.prototype.type];\n\n    // If array of typed section constructors is passed, transform the array to\n    // type strings\n  } else if (Array.isArray(types) && types[0].constructor === _section__WEBPACK_IMPORTED_MODULE_0__[\"default\"]) {\n    types = types.map(function(TypedSection) {\n      return TypedSection.prototype.type;\n    });\n  }\n\n  types = types.map(function(type) {\n    return type.toLowerCase();\n  });\n\n  return types;\n}\n\nfunction normalizeContainers(containers) {\n  // Nodelist with entries\n  if (NodeList.prototype.isPrototypeOf(containers) && containers.length > 0) {\n    containers = Array.prototype.slice.call(containers);\n\n    // Empty Nodelist\n  } else if (\n    NodeList.prototype.isPrototypeOf(containers) &&\n    containers.length === 0\n  ) {\n    containers = [];\n\n    // Handle null (document.querySelector() returns null with no match)\n  } else if (containers === null) {\n    containers = [];\n\n    // Single DOM element\n  } else if (!Array.isArray(containers) && containers instanceof Element) {\n    containers = [containers];\n  }\n\n  return containers;\n}\n\nif (window.Shopify.designMode) {\n  document.addEventListener('shopify:section:load', function(event) {\n    var id = event.detail.sectionId;\n    var container = event.target.querySelector(\n      '[' + SECTION_ID_ATTR + '=\"' + id + '\"]'\n    );\n\n    if (container !== null) {\n      load(container.getAttribute(SECTION_TYPE_ATTR), container);\n    }\n  });\n\n  document.addEventListener('shopify:section:unload', function(event) {\n    var id = event.detail.sectionId;\n    var container = event.target.querySelector(\n      '[' + SECTION_ID_ATTR + '=\"' + id + '\"]'\n    );\n    var instance = getInstances(container)[0];\n\n    if (typeof instance === 'object') {\n      unload(container);\n    }\n  });\n\n  document.addEventListener('shopify:section:select', function(event) {\n    var instance = getInstanceById(event.detail.sectionId);\n\n    if (typeof instance === 'object') {\n      instance.onSelect(event);\n    }\n  });\n\n  document.addEventListener('shopify:section:deselect', function(event) {\n    var instance = getInstanceById(event.detail.sectionId);\n\n    if (typeof instance === 'object') {\n      instance.onDeselect(event);\n    }\n  });\n\n  document.addEventListener('shopify:block:select', function(event) {\n    var instance = getInstanceById(event.detail.sectionId);\n\n    if (typeof instance === 'object') {\n      instance.onBlockSelect(event);\n    }\n  });\n\n  document.addEventListener('shopify:block:deselect', function(event) {\n    var instance = getInstanceById(event.detail.sectionId);\n\n    if (typeof instance === 'object') {\n      instance.onBlockDeselect(event);\n    }\n  });\n}\n\n\n//# sourceURL=webpack://shopify-theme-starter/./node_modules/@shopify/theme-sections/theme-sections.js?");

/***/ }),

/***/ "./node_modules/lazysizes/lazysizes.js":
/*!*********************************************!*\
  !*** ./node_modules/lazysizes/lazysizes.js ***!
  \*********************************************/
/***/ ((module) => {

eval("(function(window, factory) {\n\tvar lazySizes = factory(window, window.document, Date);\n\twindow.lazySizes = lazySizes;\n\tif( true && module.exports){\n\t\tmodule.exports = lazySizes;\n\t}\n}(typeof window != 'undefined' ?\n      window : {}, \n/**\n * import(\"./types/global\")\n * @typedef { import(\"./types/lazysizes-config\").LazySizesConfigPartial } LazySizesConfigPartial\n */\nfunction l(window, document, Date) { // Pass in the window Date function also for SSR because the Date class can be lost\n\t'use strict';\n\t/*jshint eqnull:true */\n\n\tvar lazysizes,\n\t\t/**\n\t\t * @type { LazySizesConfigPartial }\n\t\t */\n\t\tlazySizesCfg;\n\n\t(function(){\n\t\tvar prop;\n\n\t\tvar lazySizesDefaults = {\n\t\t\tlazyClass: 'lazyload',\n\t\t\tloadedClass: 'lazyloaded',\n\t\t\tloadingClass: 'lazyloading',\n\t\t\tpreloadClass: 'lazypreload',\n\t\t\terrorClass: 'lazyerror',\n\t\t\t//strictClass: 'lazystrict',\n\t\t\tautosizesClass: 'lazyautosizes',\n\t\t\tfastLoadedClass: 'ls-is-cached',\n\t\t\tiframeLoadMode: 0,\n\t\t\tsrcAttr: 'data-src',\n\t\t\tsrcsetAttr: 'data-srcset',\n\t\t\tsizesAttr: 'data-sizes',\n\t\t\t//preloadAfterLoad: false,\n\t\t\tminSize: 40,\n\t\t\tcustomMedia: {},\n\t\t\tinit: true,\n\t\t\texpFactor: 1.5,\n\t\t\thFac: 0.8,\n\t\t\tloadMode: 2,\n\t\t\tloadHidden: true,\n\t\t\tricTimeout: 0,\n\t\t\tthrottleDelay: 125,\n\t\t};\n\n\t\tlazySizesCfg = window.lazySizesConfig || window.lazysizesConfig || {};\n\n\t\tfor(prop in lazySizesDefaults){\n\t\t\tif(!(prop in lazySizesCfg)){\n\t\t\t\tlazySizesCfg[prop] = lazySizesDefaults[prop];\n\t\t\t}\n\t\t}\n\t})();\n\n\tif (!document || !document.getElementsByClassName) {\n\t\treturn {\n\t\t\tinit: function () {},\n\t\t\t/**\n\t\t\t * @type { LazySizesConfigPartial }\n\t\t\t */\n\t\t\tcfg: lazySizesCfg,\n\t\t\t/**\n\t\t\t * @type { true }\n\t\t\t */\n\t\t\tnoSupport: true,\n\t\t};\n\t}\n\n\tvar docElem = document.documentElement;\n\n\tvar supportPicture = window.HTMLPictureElement;\n\n\tvar _addEventListener = 'addEventListener';\n\n\tvar _getAttribute = 'getAttribute';\n\n\t/**\n\t * Update to bind to window because 'this' becomes null during SSR\n\t * builds.\n\t */\n\tvar addEventListener = window[_addEventListener].bind(window);\n\n\tvar setTimeout = window.setTimeout;\n\n\tvar requestAnimationFrame = window.requestAnimationFrame || setTimeout;\n\n\tvar requestIdleCallback = window.requestIdleCallback;\n\n\tvar regPicture = /^picture$/i;\n\n\tvar loadEvents = ['load', 'error', 'lazyincluded', '_lazyloaded'];\n\n\tvar regClassCache = {};\n\n\tvar forEach = Array.prototype.forEach;\n\n\t/**\n\t * @param ele {Element}\n\t * @param cls {string}\n\t */\n\tvar hasClass = function(ele, cls) {\n\t\tif(!regClassCache[cls]){\n\t\t\tregClassCache[cls] = new RegExp('(\\\\s|^)'+cls+'(\\\\s|$)');\n\t\t}\n\t\treturn regClassCache[cls].test(ele[_getAttribute]('class') || '') && regClassCache[cls];\n\t};\n\n\t/**\n\t * @param ele {Element}\n\t * @param cls {string}\n\t */\n\tvar addClass = function(ele, cls) {\n\t\tif (!hasClass(ele, cls)){\n\t\t\tele.setAttribute('class', (ele[_getAttribute]('class') || '').trim() + ' ' + cls);\n\t\t}\n\t};\n\n\t/**\n\t * @param ele {Element}\n\t * @param cls {string}\n\t */\n\tvar removeClass = function(ele, cls) {\n\t\tvar reg;\n\t\tif ((reg = hasClass(ele,cls))) {\n\t\t\tele.setAttribute('class', (ele[_getAttribute]('class') || '').replace(reg, ' '));\n\t\t}\n\t};\n\n\tvar addRemoveLoadEvents = function(dom, fn, add){\n\t\tvar action = add ? _addEventListener : 'removeEventListener';\n\t\tif(add){\n\t\t\taddRemoveLoadEvents(dom, fn);\n\t\t}\n\t\tloadEvents.forEach(function(evt){\n\t\t\tdom[action](evt, fn);\n\t\t});\n\t};\n\n\t/**\n\t * @param elem { Element }\n\t * @param name { string }\n\t * @param detail { any }\n\t * @param noBubbles { boolean }\n\t * @param noCancelable { boolean }\n\t * @returns { CustomEvent }\n\t */\n\tvar triggerEvent = function(elem, name, detail, noBubbles, noCancelable){\n\t\tvar event = document.createEvent('Event');\n\n\t\tif(!detail){\n\t\t\tdetail = {};\n\t\t}\n\n\t\tdetail.instance = lazysizes;\n\n\t\tevent.initEvent(name, !noBubbles, !noCancelable);\n\n\t\tevent.detail = detail;\n\n\t\telem.dispatchEvent(event);\n\t\treturn event;\n\t};\n\n\tvar updatePolyfill = function (el, full){\n\t\tvar polyfill;\n\t\tif( !supportPicture && ( polyfill = (window.picturefill || lazySizesCfg.pf) ) ){\n\t\t\tif(full && full.src && !el[_getAttribute]('srcset')){\n\t\t\t\tel.setAttribute('srcset', full.src);\n\t\t\t}\n\t\t\tpolyfill({reevaluate: true, elements: [el]});\n\t\t} else if(full && full.src){\n\t\t\tel.src = full.src;\n\t\t}\n\t};\n\n\tvar getCSS = function (elem, style){\n\t\treturn (getComputedStyle(elem, null) || {})[style];\n\t};\n\n\t/**\n\t *\n\t * @param elem { Element }\n\t * @param parent { Element }\n\t * @param [width] {number}\n\t * @returns {number}\n\t */\n\tvar getWidth = function(elem, parent, width){\n\t\twidth = width || elem.offsetWidth;\n\n\t\twhile(width < lazySizesCfg.minSize && parent && !elem._lazysizesWidth){\n\t\t\twidth =  parent.offsetWidth;\n\t\t\tparent = parent.parentNode;\n\t\t}\n\n\t\treturn width;\n\t};\n\n\tvar rAF = (function(){\n\t\tvar running, waiting;\n\t\tvar firstFns = [];\n\t\tvar secondFns = [];\n\t\tvar fns = firstFns;\n\n\t\tvar run = function(){\n\t\t\tvar runFns = fns;\n\n\t\t\tfns = firstFns.length ? secondFns : firstFns;\n\n\t\t\trunning = true;\n\t\t\twaiting = false;\n\n\t\t\twhile(runFns.length){\n\t\t\t\trunFns.shift()();\n\t\t\t}\n\n\t\t\trunning = false;\n\t\t};\n\n\t\tvar rafBatch = function(fn, queue){\n\t\t\tif(running && !queue){\n\t\t\t\tfn.apply(this, arguments);\n\t\t\t} else {\n\t\t\t\tfns.push(fn);\n\n\t\t\t\tif(!waiting){\n\t\t\t\t\twaiting = true;\n\t\t\t\t\t(document.hidden ? setTimeout : requestAnimationFrame)(run);\n\t\t\t\t}\n\t\t\t}\n\t\t};\n\n\t\trafBatch._lsFlush = run;\n\n\t\treturn rafBatch;\n\t})();\n\n\tvar rAFIt = function(fn, simple){\n\t\treturn simple ?\n\t\t\tfunction() {\n\t\t\t\trAF(fn);\n\t\t\t} :\n\t\t\tfunction(){\n\t\t\t\tvar that = this;\n\t\t\t\tvar args = arguments;\n\t\t\t\trAF(function(){\n\t\t\t\t\tfn.apply(that, args);\n\t\t\t\t});\n\t\t\t}\n\t\t;\n\t};\n\n\tvar throttle = function(fn){\n\t\tvar running;\n\t\tvar lastTime = 0;\n\t\tvar gDelay = lazySizesCfg.throttleDelay;\n\t\tvar rICTimeout = lazySizesCfg.ricTimeout;\n\t\tvar run = function(){\n\t\t\trunning = false;\n\t\t\tlastTime = Date.now();\n\t\t\tfn();\n\t\t};\n\t\tvar idleCallback = requestIdleCallback && rICTimeout > 49 ?\n\t\t\tfunction(){\n\t\t\t\trequestIdleCallback(run, {timeout: rICTimeout});\n\n\t\t\t\tif(rICTimeout !== lazySizesCfg.ricTimeout){\n\t\t\t\t\trICTimeout = lazySizesCfg.ricTimeout;\n\t\t\t\t}\n\t\t\t} :\n\t\t\trAFIt(function(){\n\t\t\t\tsetTimeout(run);\n\t\t\t}, true)\n\t\t;\n\n\t\treturn function(isPriority){\n\t\t\tvar delay;\n\n\t\t\tif((isPriority = isPriority === true)){\n\t\t\t\trICTimeout = 33;\n\t\t\t}\n\n\t\t\tif(running){\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\trunning =  true;\n\n\t\t\tdelay = gDelay - (Date.now() - lastTime);\n\n\t\t\tif(delay < 0){\n\t\t\t\tdelay = 0;\n\t\t\t}\n\n\t\t\tif(isPriority || delay < 9){\n\t\t\t\tidleCallback();\n\t\t\t} else {\n\t\t\t\tsetTimeout(idleCallback, delay);\n\t\t\t}\n\t\t};\n\t};\n\n\t//based on http://modernjavascript.blogspot.de/2013/08/building-better-debounce.html\n\tvar debounce = function(func) {\n\t\tvar timeout, timestamp;\n\t\tvar wait = 99;\n\t\tvar run = function(){\n\t\t\ttimeout = null;\n\t\t\tfunc();\n\t\t};\n\t\tvar later = function() {\n\t\t\tvar last = Date.now() - timestamp;\n\n\t\t\tif (last < wait) {\n\t\t\t\tsetTimeout(later, wait - last);\n\t\t\t} else {\n\t\t\t\t(requestIdleCallback || run)(run);\n\t\t\t}\n\t\t};\n\n\t\treturn function() {\n\t\t\ttimestamp = Date.now();\n\n\t\t\tif (!timeout) {\n\t\t\t\ttimeout = setTimeout(later, wait);\n\t\t\t}\n\t\t};\n\t};\n\n\tvar loader = (function(){\n\t\tvar preloadElems, isCompleted, resetPreloadingTimer, loadMode, started;\n\n\t\tvar eLvW, elvH, eLtop, eLleft, eLright, eLbottom, isBodyHidden;\n\n\t\tvar regImg = /^img$/i;\n\t\tvar regIframe = /^iframe$/i;\n\n\t\tvar supportScroll = ('onscroll' in window) && !(/(gle|ing)bot/.test(navigator.userAgent));\n\n\t\tvar shrinkExpand = 0;\n\t\tvar currentExpand = 0;\n\n\t\tvar isLoading = 0;\n\t\tvar lowRuns = -1;\n\n\t\tvar resetPreloading = function(e){\n\t\t\tisLoading--;\n\t\t\tif(!e || isLoading < 0 || !e.target){\n\t\t\t\tisLoading = 0;\n\t\t\t}\n\t\t};\n\n\t\tvar isVisible = function (elem) {\n\t\t\tif (isBodyHidden == null) {\n\t\t\t\tisBodyHidden = getCSS(document.body, 'visibility') == 'hidden';\n\t\t\t}\n\n\t\t\treturn isBodyHidden || !(getCSS(elem.parentNode, 'visibility') == 'hidden' && getCSS(elem, 'visibility') == 'hidden');\n\t\t};\n\n\t\tvar isNestedVisible = function(elem, elemExpand){\n\t\t\tvar outerRect;\n\t\t\tvar parent = elem;\n\t\t\tvar visible = isVisible(elem);\n\n\t\t\teLtop -= elemExpand;\n\t\t\teLbottom += elemExpand;\n\t\t\teLleft -= elemExpand;\n\t\t\teLright += elemExpand;\n\n\t\t\twhile(visible && (parent = parent.offsetParent) && parent != document.body && parent != docElem){\n\t\t\t\tvisible = ((getCSS(parent, 'opacity') || 1) > 0);\n\n\t\t\t\tif(visible && getCSS(parent, 'overflow') != 'visible'){\n\t\t\t\t\touterRect = parent.getBoundingClientRect();\n\t\t\t\t\tvisible = eLright > outerRect.left &&\n\t\t\t\t\t\teLleft < outerRect.right &&\n\t\t\t\t\t\teLbottom > outerRect.top - 1 &&\n\t\t\t\t\t\teLtop < outerRect.bottom + 1\n\t\t\t\t\t;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\treturn visible;\n\t\t};\n\n\t\tvar checkElements = function() {\n\t\t\tvar eLlen, i, rect, autoLoadElem, loadedSomething, elemExpand, elemNegativeExpand, elemExpandVal,\n\t\t\t\tbeforeExpandVal, defaultExpand, preloadExpand, hFac;\n\t\t\tvar lazyloadElems = lazysizes.elements;\n\n\t\t\tif((loadMode = lazySizesCfg.loadMode) && isLoading < 8 && (eLlen = lazyloadElems.length)){\n\n\t\t\t\ti = 0;\n\n\t\t\t\tlowRuns++;\n\n\t\t\t\tfor(; i < eLlen; i++){\n\n\t\t\t\t\tif(!lazyloadElems[i] || lazyloadElems[i]._lazyRace){continue;}\n\n\t\t\t\t\tif(!supportScroll || (lazysizes.prematureUnveil && lazysizes.prematureUnveil(lazyloadElems[i]))){unveilElement(lazyloadElems[i]);continue;}\n\n\t\t\t\t\tif(!(elemExpandVal = lazyloadElems[i][_getAttribute]('data-expand')) || !(elemExpand = elemExpandVal * 1)){\n\t\t\t\t\t\telemExpand = currentExpand;\n\t\t\t\t\t}\n\n\t\t\t\t\tif (!defaultExpand) {\n\t\t\t\t\t\tdefaultExpand = (!lazySizesCfg.expand || lazySizesCfg.expand < 1) ?\n\t\t\t\t\t\t\tdocElem.clientHeight > 500 && docElem.clientWidth > 500 ? 500 : 370 :\n\t\t\t\t\t\t\tlazySizesCfg.expand;\n\n\t\t\t\t\t\tlazysizes._defEx = defaultExpand;\n\n\t\t\t\t\t\tpreloadExpand = defaultExpand * lazySizesCfg.expFactor;\n\t\t\t\t\t\thFac = lazySizesCfg.hFac;\n\t\t\t\t\t\tisBodyHidden = null;\n\n\t\t\t\t\t\tif(currentExpand < preloadExpand && isLoading < 1 && lowRuns > 2 && loadMode > 2 && !document.hidden){\n\t\t\t\t\t\t\tcurrentExpand = preloadExpand;\n\t\t\t\t\t\t\tlowRuns = 0;\n\t\t\t\t\t\t} else if(loadMode > 1 && lowRuns > 1 && isLoading < 6){\n\t\t\t\t\t\t\tcurrentExpand = defaultExpand;\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tcurrentExpand = shrinkExpand;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\n\t\t\t\t\tif(beforeExpandVal !== elemExpand){\n\t\t\t\t\t\teLvW = innerWidth + (elemExpand * hFac);\n\t\t\t\t\t\telvH = innerHeight + elemExpand;\n\t\t\t\t\t\telemNegativeExpand = elemExpand * -1;\n\t\t\t\t\t\tbeforeExpandVal = elemExpand;\n\t\t\t\t\t}\n\n\t\t\t\t\trect = lazyloadElems[i].getBoundingClientRect();\n\n\t\t\t\t\tif ((eLbottom = rect.bottom) >= elemNegativeExpand &&\n\t\t\t\t\t\t(eLtop = rect.top) <= elvH &&\n\t\t\t\t\t\t(eLright = rect.right) >= elemNegativeExpand * hFac &&\n\t\t\t\t\t\t(eLleft = rect.left) <= eLvW &&\n\t\t\t\t\t\t(eLbottom || eLright || eLleft || eLtop) &&\n\t\t\t\t\t\t(lazySizesCfg.loadHidden || isVisible(lazyloadElems[i])) &&\n\t\t\t\t\t\t((isCompleted && isLoading < 3 && !elemExpandVal && (loadMode < 3 || lowRuns < 4)) || isNestedVisible(lazyloadElems[i], elemExpand))){\n\t\t\t\t\t\tunveilElement(lazyloadElems[i]);\n\t\t\t\t\t\tloadedSomething = true;\n\t\t\t\t\t\tif(isLoading > 9){break;}\n\t\t\t\t\t} else if(!loadedSomething && isCompleted && !autoLoadElem &&\n\t\t\t\t\t\tisLoading < 4 && lowRuns < 4 && loadMode > 2 &&\n\t\t\t\t\t\t(preloadElems[0] || lazySizesCfg.preloadAfterLoad) &&\n\t\t\t\t\t\t(preloadElems[0] || (!elemExpandVal && ((eLbottom || eLright || eLleft || eLtop) || lazyloadElems[i][_getAttribute](lazySizesCfg.sizesAttr) != 'auto')))){\n\t\t\t\t\t\tautoLoadElem = preloadElems[0] || lazyloadElems[i];\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\tif(autoLoadElem && !loadedSomething){\n\t\t\t\t\tunveilElement(autoLoadElem);\n\t\t\t\t}\n\t\t\t}\n\t\t};\n\n\t\tvar throttledCheckElements = throttle(checkElements);\n\n\t\tvar switchLoadingClass = function(e){\n\t\t\tvar elem = e.target;\n\n\t\t\tif (elem._lazyCache) {\n\t\t\t\tdelete elem._lazyCache;\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tresetPreloading(e);\n\t\t\taddClass(elem, lazySizesCfg.loadedClass);\n\t\t\tremoveClass(elem, lazySizesCfg.loadingClass);\n\t\t\taddRemoveLoadEvents(elem, rafSwitchLoadingClass);\n\t\t\ttriggerEvent(elem, 'lazyloaded');\n\t\t};\n\t\tvar rafedSwitchLoadingClass = rAFIt(switchLoadingClass);\n\t\tvar rafSwitchLoadingClass = function(e){\n\t\t\trafedSwitchLoadingClass({target: e.target});\n\t\t};\n\n\t\tvar changeIframeSrc = function(elem, src){\n\t\t\tvar loadMode = elem.getAttribute('data-load-mode') || lazySizesCfg.iframeLoadMode;\n\n\t\t\t// loadMode can be also a string!\n\t\t\tif (loadMode == 0) {\n\t\t\t\telem.contentWindow.location.replace(src);\n\t\t\t} else if (loadMode == 1) {\n\t\t\t\telem.src = src;\n\t\t\t}\n\t\t};\n\n\t\tvar handleSources = function(source){\n\t\t\tvar customMedia;\n\n\t\t\tvar sourceSrcset = source[_getAttribute](lazySizesCfg.srcsetAttr);\n\n\t\t\tif( (customMedia = lazySizesCfg.customMedia[source[_getAttribute]('data-media') || source[_getAttribute]('media')]) ){\n\t\t\t\tsource.setAttribute('media', customMedia);\n\t\t\t}\n\n\t\t\tif(sourceSrcset){\n\t\t\t\tsource.setAttribute('srcset', sourceSrcset);\n\t\t\t}\n\t\t};\n\n\t\tvar lazyUnveil = rAFIt(function (elem, detail, isAuto, sizes, isImg){\n\t\t\tvar src, srcset, parent, isPicture, event, firesLoad;\n\n\t\t\tif(!(event = triggerEvent(elem, 'lazybeforeunveil', detail)).defaultPrevented){\n\n\t\t\t\tif(sizes){\n\t\t\t\t\tif(isAuto){\n\t\t\t\t\t\taddClass(elem, lazySizesCfg.autosizesClass);\n\t\t\t\t\t} else {\n\t\t\t\t\t\telem.setAttribute('sizes', sizes);\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\tsrcset = elem[_getAttribute](lazySizesCfg.srcsetAttr);\n\t\t\t\tsrc = elem[_getAttribute](lazySizesCfg.srcAttr);\n\n\t\t\t\tif(isImg) {\n\t\t\t\t\tparent = elem.parentNode;\n\t\t\t\t\tisPicture = parent && regPicture.test(parent.nodeName || '');\n\t\t\t\t}\n\n\t\t\t\tfiresLoad = detail.firesLoad || (('src' in elem) && (srcset || src || isPicture));\n\n\t\t\t\tevent = {target: elem};\n\n\t\t\t\taddClass(elem, lazySizesCfg.loadingClass);\n\n\t\t\t\tif(firesLoad){\n\t\t\t\t\tclearTimeout(resetPreloadingTimer);\n\t\t\t\t\tresetPreloadingTimer = setTimeout(resetPreloading, 2500);\n\t\t\t\t\taddRemoveLoadEvents(elem, rafSwitchLoadingClass, true);\n\t\t\t\t}\n\n\t\t\t\tif(isPicture){\n\t\t\t\t\tforEach.call(parent.getElementsByTagName('source'), handleSources);\n\t\t\t\t}\n\n\t\t\t\tif(srcset){\n\t\t\t\t\telem.setAttribute('srcset', srcset);\n\t\t\t\t} else if(src && !isPicture){\n\t\t\t\t\tif(regIframe.test(elem.nodeName)){\n\t\t\t\t\t\tchangeIframeSrc(elem, src);\n\t\t\t\t\t} else {\n\t\t\t\t\t\telem.src = src;\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\tif(isImg && (srcset || isPicture)){\n\t\t\t\t\tupdatePolyfill(elem, {src: src});\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif(elem._lazyRace){\n\t\t\t\tdelete elem._lazyRace;\n\t\t\t}\n\t\t\tremoveClass(elem, lazySizesCfg.lazyClass);\n\n\t\t\trAF(function(){\n\t\t\t\t// Part of this can be removed as soon as this fix is older: https://bugs.chromium.org/p/chromium/issues/detail?id=7731 (2015)\n\t\t\t\tvar isLoaded = elem.complete && elem.naturalWidth > 1;\n\n\t\t\t\tif( !firesLoad || isLoaded){\n\t\t\t\t\tif (isLoaded) {\n\t\t\t\t\t\taddClass(elem, lazySizesCfg.fastLoadedClass);\n\t\t\t\t\t}\n\t\t\t\t\tswitchLoadingClass(event);\n\t\t\t\t\telem._lazyCache = true;\n\t\t\t\t\tsetTimeout(function(){\n\t\t\t\t\t\tif ('_lazyCache' in elem) {\n\t\t\t\t\t\t\tdelete elem._lazyCache;\n\t\t\t\t\t\t}\n\t\t\t\t\t}, 9);\n\t\t\t\t}\n\t\t\t\tif (elem.loading == 'lazy') {\n\t\t\t\t\tisLoading--;\n\t\t\t\t}\n\t\t\t}, true);\n\t\t});\n\n\t\t/**\n\t\t *\n\t\t * @param elem { Element }\n\t\t */\n\t\tvar unveilElement = function (elem){\n\t\t\tif (elem._lazyRace) {return;}\n\t\t\tvar detail;\n\n\t\t\tvar isImg = regImg.test(elem.nodeName);\n\n\t\t\t//allow using sizes=\"auto\", but don't use. it's invalid. Use data-sizes=\"auto\" or a valid value for sizes instead (i.e.: sizes=\"80vw\")\n\t\t\tvar sizes = isImg && (elem[_getAttribute](lazySizesCfg.sizesAttr) || elem[_getAttribute]('sizes'));\n\t\t\tvar isAuto = sizes == 'auto';\n\n\t\t\tif( (isAuto || !isCompleted) && isImg && (elem[_getAttribute]('src') || elem.srcset) && !elem.complete && !hasClass(elem, lazySizesCfg.errorClass) && hasClass(elem, lazySizesCfg.lazyClass)){return;}\n\n\t\t\tdetail = triggerEvent(elem, 'lazyunveilread').detail;\n\n\t\t\tif(isAuto){\n\t\t\t\t autoSizer.updateElem(elem, true, elem.offsetWidth);\n\t\t\t}\n\n\t\t\telem._lazyRace = true;\n\t\t\tisLoading++;\n\n\t\t\tlazyUnveil(elem, detail, isAuto, sizes, isImg);\n\t\t};\n\n\t\tvar afterScroll = debounce(function(){\n\t\t\tlazySizesCfg.loadMode = 3;\n\t\t\tthrottledCheckElements();\n\t\t});\n\n\t\tvar altLoadmodeScrollListner = function(){\n\t\t\tif(lazySizesCfg.loadMode == 3){\n\t\t\t\tlazySizesCfg.loadMode = 2;\n\t\t\t}\n\t\t\tafterScroll();\n\t\t};\n\n\t\tvar onload = function(){\n\t\t\tif(isCompleted){return;}\n\t\t\tif(Date.now() - started < 999){\n\t\t\t\tsetTimeout(onload, 999);\n\t\t\t\treturn;\n\t\t\t}\n\n\n\t\t\tisCompleted = true;\n\n\t\t\tlazySizesCfg.loadMode = 3;\n\n\t\t\tthrottledCheckElements();\n\n\t\t\taddEventListener('scroll', altLoadmodeScrollListner, true);\n\t\t};\n\n\t\treturn {\n\t\t\t_: function(){\n\t\t\t\tstarted = Date.now();\n\n\t\t\t\tlazysizes.elements = document.getElementsByClassName(lazySizesCfg.lazyClass);\n\t\t\t\tpreloadElems = document.getElementsByClassName(lazySizesCfg.lazyClass + ' ' + lazySizesCfg.preloadClass);\n\n\t\t\t\taddEventListener('scroll', throttledCheckElements, true);\n\n\t\t\t\taddEventListener('resize', throttledCheckElements, true);\n\n\t\t\t\taddEventListener('pageshow', function (e) {\n\t\t\t\t\tif (e.persisted) {\n\t\t\t\t\t\tvar loadingElements = document.querySelectorAll('.' + lazySizesCfg.loadingClass);\n\n\t\t\t\t\t\tif (loadingElements.length && loadingElements.forEach) {\n\t\t\t\t\t\t\trequestAnimationFrame(function () {\n\t\t\t\t\t\t\t\tloadingElements.forEach( function (img) {\n\t\t\t\t\t\t\t\t\tif (img.complete) {\n\t\t\t\t\t\t\t\t\t\tunveilElement(img);\n\t\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t\t});\n\t\t\t\t\t\t\t});\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t});\n\n\t\t\t\tif(window.MutationObserver){\n\t\t\t\t\tnew MutationObserver( throttledCheckElements ).observe( docElem, {childList: true, subtree: true, attributes: true} );\n\t\t\t\t} else {\n\t\t\t\t\tdocElem[_addEventListener]('DOMNodeInserted', throttledCheckElements, true);\n\t\t\t\t\tdocElem[_addEventListener]('DOMAttrModified', throttledCheckElements, true);\n\t\t\t\t\tsetInterval(throttledCheckElements, 999);\n\t\t\t\t}\n\n\t\t\t\taddEventListener('hashchange', throttledCheckElements, true);\n\n\t\t\t\t//, 'fullscreenchange'\n\t\t\t\t['focus', 'mouseover', 'click', 'load', 'transitionend', 'animationend'].forEach(function(name){\n\t\t\t\t\tdocument[_addEventListener](name, throttledCheckElements, true);\n\t\t\t\t});\n\n\t\t\t\tif((/d$|^c/.test(document.readyState))){\n\t\t\t\t\tonload();\n\t\t\t\t} else {\n\t\t\t\t\taddEventListener('load', onload);\n\t\t\t\t\tdocument[_addEventListener]('DOMContentLoaded', throttledCheckElements);\n\t\t\t\t\tsetTimeout(onload, 20000);\n\t\t\t\t}\n\n\t\t\t\tif(lazysizes.elements.length){\n\t\t\t\t\tcheckElements();\n\t\t\t\t\trAF._lsFlush();\n\t\t\t\t} else {\n\t\t\t\t\tthrottledCheckElements();\n\t\t\t\t}\n\t\t\t},\n\t\t\tcheckElems: throttledCheckElements,\n\t\t\tunveil: unveilElement,\n\t\t\t_aLSL: altLoadmodeScrollListner,\n\t\t};\n\t})();\n\n\n\tvar autoSizer = (function(){\n\t\tvar autosizesElems;\n\n\t\tvar sizeElement = rAFIt(function(elem, parent, event, width){\n\t\t\tvar sources, i, len;\n\t\t\telem._lazysizesWidth = width;\n\t\t\twidth += 'px';\n\n\t\t\telem.setAttribute('sizes', width);\n\n\t\t\tif(regPicture.test(parent.nodeName || '')){\n\t\t\t\tsources = parent.getElementsByTagName('source');\n\t\t\t\tfor(i = 0, len = sources.length; i < len; i++){\n\t\t\t\t\tsources[i].setAttribute('sizes', width);\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif(!event.detail.dataAttr){\n\t\t\t\tupdatePolyfill(elem, event.detail);\n\t\t\t}\n\t\t});\n\t\t/**\n\t\t *\n\t\t * @param elem {Element}\n\t\t * @param dataAttr\n\t\t * @param [width] { number }\n\t\t */\n\t\tvar getSizeElement = function (elem, dataAttr, width){\n\t\t\tvar event;\n\t\t\tvar parent = elem.parentNode;\n\n\t\t\tif(parent){\n\t\t\t\twidth = getWidth(elem, parent, width);\n\t\t\t\tevent = triggerEvent(elem, 'lazybeforesizes', {width: width, dataAttr: !!dataAttr});\n\n\t\t\t\tif(!event.defaultPrevented){\n\t\t\t\t\twidth = event.detail.width;\n\n\t\t\t\t\tif(width && width !== elem._lazysizesWidth){\n\t\t\t\t\t\tsizeElement(elem, parent, event, width);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t};\n\n\t\tvar updateElementsSizes = function(){\n\t\t\tvar i;\n\t\t\tvar len = autosizesElems.length;\n\t\t\tif(len){\n\t\t\t\ti = 0;\n\n\t\t\t\tfor(; i < len; i++){\n\t\t\t\t\tgetSizeElement(autosizesElems[i]);\n\t\t\t\t}\n\t\t\t}\n\t\t};\n\n\t\tvar debouncedUpdateElementsSizes = debounce(updateElementsSizes);\n\n\t\treturn {\n\t\t\t_: function(){\n\t\t\t\tautosizesElems = document.getElementsByClassName(lazySizesCfg.autosizesClass);\n\t\t\t\taddEventListener('resize', debouncedUpdateElementsSizes);\n\t\t\t},\n\t\t\tcheckElems: debouncedUpdateElementsSizes,\n\t\t\tupdateElem: getSizeElement\n\t\t};\n\t})();\n\n\tvar init = function(){\n\t\tif(!init.i && document.getElementsByClassName){\n\t\t\tinit.i = true;\n\t\t\tautoSizer._();\n\t\t\tloader._();\n\t\t}\n\t};\n\n\tsetTimeout(function(){\n\t\tif(lazySizesCfg.init){\n\t\t\tinit();\n\t\t}\n\t});\n\n\tlazysizes = {\n\t\t/**\n\t\t * @type { LazySizesConfigPartial }\n\t\t */\n\t\tcfg: lazySizesCfg,\n\t\tautoSizer: autoSizer,\n\t\tloader: loader,\n\t\tinit: init,\n\t\tuP: updatePolyfill,\n\t\taC: addClass,\n\t\trC: removeClass,\n\t\thC: hasClass,\n\t\tfire: triggerEvent,\n\t\tgW: getWidth,\n\t\trAF: rAF,\n\t};\n\n\treturn lazysizes;\n}\n));\n\n\n//# sourceURL=webpack://shopify-theme-starter/./node_modules/lazysizes/lazysizes.js?");

/***/ }),

/***/ "./node_modules/lazysizes/plugins/rias/ls.rias.js":
/*!********************************************************!*\
  !*** ./node_modules/lazysizes/plugins/rias/ls.rias.js ***!
  \********************************************************/
/***/ ((module, exports, __webpack_require__) => {

eval("var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function(window, factory) {\n\tvar globalInstall = function(){\n\t\tfactory(window.lazySizes);\n\t\twindow.removeEventListener('lazyunveilread', globalInstall, true);\n\t};\n\n\tfactory = factory.bind(null, window, window.document);\n\n\tif( true && module.exports){\n\t\tfactory(__webpack_require__(/*! lazysizes */ \"./node_modules/lazysizes/lazysizes.js\"));\n\t} else if (true) {\n\t\t!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(/*! lazysizes */ \"./node_modules/lazysizes/lazysizes.js\")], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),\n\t\t__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?\n\t\t(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),\n\t\t__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));\n\t} else {}\n}(window, function(window, document, lazySizes) {\n\t/*jshint eqnull:true */\n\t'use strict';\n\n\tvar config, riasCfg;\n\tvar lazySizesCfg = lazySizes.cfg;\n\tvar replaceTypes = {string: 1, number: 1};\n\tvar regNumber = /^\\-*\\+*\\d+\\.*\\d*$/;\n\tvar regPicture = /^picture$/i;\n\tvar regWidth = /\\s*\\{\\s*width\\s*\\}\\s*/i;\n\tvar regHeight = /\\s*\\{\\s*height\\s*\\}\\s*/i;\n\tvar regPlaceholder = /\\s*\\{\\s*([a-z0-9]+)\\s*\\}\\s*/ig;\n\tvar regObj = /^\\[.*\\]|\\{.*\\}$/;\n\tvar regAllowedSizes = /^(?:auto|\\d+(px)?)$/;\n\tvar anchor = document.createElement('a');\n\tvar img = document.createElement('img');\n\tvar buggySizes = ('srcset' in img) && !('sizes' in img);\n\tvar supportPicture = !!window.HTMLPictureElement && !buggySizes;\n\n\t(function(){\n\t\tvar prop;\n\t\tvar noop = function(){};\n\t\tvar riasDefaults = {\n\t\t\tprefix: '',\n\t\t\tpostfix: '',\n\t\t\tsrcAttr: 'data-src',\n\t\t\tabsUrl: false,\n\t\t\tmodifyOptions: noop,\n\t\t\twidthmap: {},\n\t\t\tratio: false,\n\t\t\ttraditionalRatio: false,\n\t\t\taspectratio: false,\n\t\t};\n\n\t\tconfig = lazySizes && lazySizes.cfg;\n\n\t\tif(!config.supportsType){\n\t\t\tconfig.supportsType = function(type/*, elem*/){\n\t\t\t\treturn !type;\n\t\t\t};\n\t\t}\n\n\t\tif(!config.rias){\n\t\t\tconfig.rias = {};\n\t\t}\n\t\triasCfg = config.rias;\n\n\t\tif(!('widths' in riasCfg)){\n\t\t\triasCfg.widths = [];\n\t\t\t(function (widths){\n\t\t\t\tvar width;\n\t\t\t\tvar i = 0;\n\t\t\t\twhile(!width || width < 3000){\n\t\t\t\t\ti += 5;\n\t\t\t\t\tif(i > 30){\n\t\t\t\t\t\ti += 1;\n\t\t\t\t\t}\n\t\t\t\t\twidth = (36 * i);\n\t\t\t\t\twidths.push(width);\n\t\t\t\t}\n\t\t\t})(riasCfg.widths);\n\t\t}\n\n\t\tfor(prop in riasDefaults){\n\t\t\tif(!(prop in riasCfg)){\n\t\t\t\triasCfg[prop] = riasDefaults[prop];\n\t\t\t}\n\t\t}\n\t})();\n\n\tfunction getElementOptions(elem, src, options){\n\t\tvar attr, parent, setOption, prop, opts;\n\t\tvar elemStyles = window.getComputedStyle(elem);\n\n\t\tif (!options) {\n\t\t\tparent = elem.parentNode;\n\n\t\t\toptions = {\n\t\t\t\tisPicture: !!(parent && regPicture.test(parent.nodeName || ''))\n\t\t\t};\n\t\t} else {\n\t\t\topts = {};\n\n\t\t\tfor (prop in options) {\n\t\t\t\topts[prop] = options[prop];\n\t\t\t}\n\n\t\t\toptions = opts;\n\t\t}\n\n\t\tsetOption = function(attr, run){\n\t\t\tvar attrVal = elem.getAttribute('data-'+ attr);\n\n\t\t\tif (!attrVal) {\n\t\t\t\t// no data- attr, get value from the CSS\n\t\t\t\tvar styles = elemStyles.getPropertyValue('--ls-' + attr);\n\t\t\t\t// at least Safari 9 returns null rather than\n\t\t\t\t// an empty string for getPropertyValue causing\n\t\t\t\t// .trim() to fail\n\t\t\t\tif (styles) {\n\t\t\t\t\tattrVal = styles.trim();\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif (attrVal) {\n\t\t\t\tif(attrVal == 'true'){\n\t\t\t\t\tattrVal = true;\n\t\t\t\t} else if(attrVal == 'false'){\n\t\t\t\t\tattrVal = false;\n\t\t\t\t} else if(regNumber.test(attrVal)){\n\t\t\t\t\tattrVal = parseFloat(attrVal);\n\t\t\t\t} else if(typeof riasCfg[attr] == 'function'){\n\t\t\t\t\tattrVal = riasCfg[attr](elem, attrVal);\n\t\t\t\t} else if(regObj.test(attrVal)){\n\t\t\t\t\ttry {\n\t\t\t\t\t\tattrVal = JSON.parse(attrVal);\n\t\t\t\t\t} catch(e){}\n\t\t\t\t}\n\t\t\t\toptions[attr] = attrVal;\n\t\t\t} else if((attr in riasCfg) && typeof riasCfg[attr] != 'function' && !options[attr]){\n\t\t\t\toptions[attr] = riasCfg[attr];\n\t\t\t} else if(run && typeof riasCfg[attr] == 'function'){\n\t\t\t\toptions[attr] = riasCfg[attr](elem, attrVal);\n\t\t\t}\n\t\t};\n\n\t\tfor(attr in riasCfg){\n\t\t\tsetOption(attr);\n\t\t}\n\t\tsrc.replace(regPlaceholder, function(full, match){\n\t\t\tif(!(match in options)){\n\t\t\t\tsetOption(match, true);\n\t\t\t}\n\t\t});\n\n\t\treturn options;\n\t}\n\n\tfunction replaceUrlProps(url, options){\n\t\tvar candidates = [];\n\t\tvar replaceFn = function(full, match){\n\t\t\treturn (replaceTypes[typeof options[match]]) ? options[match] : full;\n\t\t};\n\t\tcandidates.srcset = [];\n\n\t\tif(options.absUrl){\n\t\t\tanchor.setAttribute('href', url);\n\t\t\turl = anchor.href;\n\t\t}\n\n\t\turl = ((options.prefix || '') + url + (options.postfix || '')).replace(regPlaceholder, replaceFn);\n\n\t\toptions.widths.forEach(function(width){\n\t\t\tvar widthAlias = options.widthmap[width] || width;\n\t\t\tvar ratio = options.aspectratio || options.ratio;\n\t\t\tvar traditionalRatio = !options.aspectratio && riasCfg.traditionalRatio;\n\t\t\tvar candidate = {\n\t\t\t\tu: url.replace(regWidth, widthAlias)\n\t\t\t\t\t\t.replace(regHeight, ratio ?\n\t\t\t\t\t\t\ttraditionalRatio ?\n\t\t\t\t\t\t\t\tMath.round(width * ratio) :\n\t\t\t\t\t\t\t\tMath.round(width / ratio)\n\t\t\t\t\t\t\t: ''),\n\t\t\t\tw: width\n\t\t\t};\n\n\t\t\tcandidates.push(candidate);\n\t\t\tcandidates.srcset.push( (candidate.c = candidate.u + ' ' + width + 'w') );\n\t\t});\n\t\treturn candidates;\n\t}\n\n\tfunction setSrc(src, opts, elem){\n\t\tvar elemW = 0;\n\t\tvar elemH = 0;\n\t\tvar sizeElement = elem;\n\n\t\tif(!src){return;}\n\n\t\tif (opts.ratio === 'container') {\n\t\t\t// calculate image or parent ratio\n\t\t\telemW = sizeElement.scrollWidth;\n\t\t\telemH = sizeElement.scrollHeight;\n\n\t\t\twhile ((!elemW || !elemH) && sizeElement !== document) {\n\t\t\t\tsizeElement = sizeElement.parentNode;\n\t\t\t\telemW = sizeElement.scrollWidth;\n\t\t\t\telemH = sizeElement.scrollHeight;\n\t\t\t}\n\t\t\tif (elemW && elemH) {\n\t\t\t\topts.ratio = opts.traditionalRatio ? elemH / elemW : elemW / elemH;\n\t\t\t}\n\t\t}\n\n\t\tsrc = replaceUrlProps(src, opts);\n\n\t\tsrc.isPicture = opts.isPicture;\n\n\t\tif(buggySizes && elem.nodeName.toUpperCase() == 'IMG'){\n\t\t\telem.removeAttribute(config.srcsetAttr);\n\t\t} else {\n\t\t\telem.setAttribute(config.srcsetAttr, src.srcset.join(', '));\n\t\t}\n\n\t\tObject.defineProperty(elem, '_lazyrias', {\n\t\t\tvalue: src,\n\t\t\twritable: true\n\t\t});\n\t}\n\n\tfunction createAttrObject(elem, src){\n\t\tvar opts = getElementOptions(elem, src);\n\n\t\triasCfg.modifyOptions.call(elem, {target: elem, details: opts, detail: opts});\n\n\t\tlazySizes.fire(elem, 'lazyriasmodifyoptions', opts);\n\t\treturn opts;\n\t}\n\n\tfunction getSrc(elem){\n\t\treturn elem.getAttribute( elem.getAttribute('data-srcattr') || riasCfg.srcAttr ) || elem.getAttribute(config.srcsetAttr) || elem.getAttribute(config.srcAttr) || elem.getAttribute('data-pfsrcset') || '';\n\t}\n\n\taddEventListener('lazybeforesizes', function(e){\n\t\tif(e.detail.instance != lazySizes){return;}\n\n\t\tvar elem, src, elemOpts, sourceOpts, parent, sources, i, len, sourceSrc, sizes, detail, hasPlaceholder, modified, emptyList;\n\t\telem = e.target;\n\n\t\tif(!e.detail.dataAttr || e.defaultPrevented || riasCfg.disabled || !((sizes = elem.getAttribute(config.sizesAttr) || elem.getAttribute('sizes')) && regAllowedSizes.test(sizes))){return;}\n\n\t\tsrc = getSrc(elem);\n\n\t\telemOpts = createAttrObject(elem, src);\n\n\t\thasPlaceholder = regWidth.test(elemOpts.prefix) || regWidth.test(elemOpts.postfix);\n\n\t\tif(elemOpts.isPicture && (parent = elem.parentNode)){\n\t\t\tsources = parent.getElementsByTagName('source');\n\t\t\tfor(i = 0, len = sources.length; i < len; i++){\n\t\t\t\tif ( hasPlaceholder || regWidth.test(sourceSrc = getSrc(sources[i])) ){\n\t\t\t\t\tsourceOpts = getElementOptions(sources[i], sourceSrc, elemOpts);\n\t\t\t\t\tsetSrc(sourceSrc, sourceOpts, sources[i]);\n\t\t\t\t\tmodified = true;\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\n\t\tif ( hasPlaceholder || regWidth.test(src) ){\n\t\t\tsetSrc(src, elemOpts, elem);\n\t\t\tmodified = true;\n\t\t} else if (modified) {\n\t\t\temptyList = [];\n\t\t\temptyList.srcset = [];\n\t\t\temptyList.isPicture = true;\n\t\t\tObject.defineProperty(elem, '_lazyrias', {\n\t\t\t\tvalue: emptyList,\n\t\t\t\twritable: true\n\t\t\t});\n\t\t}\n\n\t\tif(modified){\n\t\t\tif(supportPicture){\n\t\t\t\telem.removeAttribute(config.srcAttr);\n\t\t\t} else if(sizes != 'auto') {\n\t\t\t\tdetail = {\n\t\t\t\t\twidth: parseInt(sizes, 10)\n\t\t\t\t};\n\t\t\t\tpolyfill({\n\t\t\t\t\ttarget: elem,\n\t\t\t\t\tdetail: detail\n\t\t\t\t});\n\t\t\t}\n\t\t}\n\t}, true);\n\t// partial polyfill\n\tvar polyfill = (function(){\n\t\tvar ascendingSort = function( a, b ) {\n\t\t\treturn a.w - b.w;\n\t\t};\n\n\t\tvar reduceCandidate = function (srces) {\n\t\t\tvar lowerCandidate, bonusFactor;\n\t\t\tvar len = srces.length;\n\t\t\tvar candidate = srces[len -1];\n\t\t\tvar i = 0;\n\n\t\t\tfor(i; i < len;i++){\n\t\t\t\tcandidate = srces[i];\n\t\t\t\tcandidate.d = candidate.w / srces.w;\n\t\t\t\tif(candidate.d >= srces.d){\n\t\t\t\t\tif(!candidate.cached && (lowerCandidate = srces[i - 1]) &&\n\t\t\t\t\t\tlowerCandidate.d > srces.d - (0.13 * Math.pow(srces.d, 2.2))){\n\n\t\t\t\t\t\tbonusFactor = Math.pow(lowerCandidate.d - 0.6, 1.6);\n\n\t\t\t\t\t\tif(lowerCandidate.cached) {\n\t\t\t\t\t\t\tlowerCandidate.d += 0.15 * bonusFactor;\n\t\t\t\t\t\t}\n\n\t\t\t\t\t\tif(lowerCandidate.d + ((candidate.d - srces.d) * bonusFactor) > srces.d){\n\t\t\t\t\t\t\tcandidate = lowerCandidate;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tbreak;\n\t\t\t\t}\n\t\t\t}\n\t\t\treturn candidate;\n\t\t};\n\n\t\tvar getWSet = function(elem, testPicture){\n\t\t\tvar src;\n\t\t\tif(!elem._lazyrias && lazySizes.pWS && (src = lazySizes.pWS(elem.getAttribute(config.srcsetAttr || ''))).length){\n\t\t\t\tObject.defineProperty(elem, '_lazyrias', {\n\t\t\t\t\tvalue: src,\n\t\t\t\t\twritable: true\n\t\t\t\t});\n\t\t\t\tif(testPicture && elem.parentNode){\n\t\t\t\t\tsrc.isPicture = elem.parentNode.nodeName.toUpperCase() == 'PICTURE';\n\t\t\t\t}\n\t\t\t}\n\t\t\treturn elem._lazyrias;\n\t\t};\n\n\t\tvar getX = function(elem){\n\t\t\tvar dpr = window.devicePixelRatio || 1;\n\t\t\tvar optimum = lazySizes.getX && lazySizes.getX(elem);\n\t\t\treturn Math.min(optimum || dpr, 2.4, dpr);\n\t\t};\n\n\t\tvar getCandidate = function(elem, width){\n\t\t\tvar sources, i, len, media, srces, src;\n\n\t\t\tsrces = elem._lazyrias;\n\n\t\t\tif(srces.isPicture && window.matchMedia){\n\t\t\t\tfor(i = 0, sources = elem.parentNode.getElementsByTagName('source'), len = sources.length; i < len; i++){\n\t\t\t\t\tif(getWSet(sources[i]) && !sources[i].getAttribute('type') && ( !(media = sources[i].getAttribute('media')) || ((matchMedia(media) || {}).matches))){\n\t\t\t\t\t\tsrces = sources[i]._lazyrias;\n\t\t\t\t\t\tbreak;\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif(!srces.w || srces.w < width){\n\t\t\t\tsrces.w = width;\n\t\t\t\tsrces.d = getX(elem);\n\t\t\t\tsrc = reduceCandidate(srces.sort(ascendingSort));\n\t\t\t}\n\n\t\t\treturn src;\n\t\t};\n\n\t\tvar polyfill = function(e){\n\t\t\tif(e.detail.instance != lazySizes){return;}\n\n\t\t\tvar candidate;\n\t\t\tvar elem = e.target;\n\n\t\t\tif(!buggySizes && (window.respimage || window.picturefill || lazySizesCfg.pf)){\n\t\t\t\tdocument.removeEventListener('lazybeforesizes', polyfill);\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tif(!('_lazyrias' in elem) && (!e.detail.dataAttr || !getWSet(elem, true))){\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tcandidate = getCandidate(elem, e.detail.width);\n\n\t\t\tif(candidate && candidate.u && elem._lazyrias.cur != candidate.u){\n\t\t\t\telem._lazyrias.cur = candidate.u;\n\t\t\t\tcandidate.cached = true;\n\t\t\t\tlazySizes.rAF(function(){\n\t\t\t\t\telem.setAttribute(config.srcAttr, candidate.u);\n\t\t\t\t\telem.setAttribute('src', candidate.u);\n\t\t\t\t});\n\t\t\t}\n\t\t};\n\n\t\tif(!supportPicture){\n\t\t\taddEventListener('lazybeforesizes', polyfill);\n\t\t} else {\n\t\t\tpolyfill = function(){};\n\t\t}\n\n\t\treturn polyfill;\n\n\t})();\n\n}));\n\n\n//# sourceURL=webpack://shopify-theme-starter/./node_modules/lazysizes/plugins/rias/ls.rias.js?");

/***/ }),

/***/ "./node_modules/@glidejs/glide/src/assets/sass/glide.core.scss":
/*!*********************************************************************!*\
  !*** ./node_modules/@glidejs/glide/src/assets/sass/glide.core.scss ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n// extracted by mini-css-extract-plugin\n\n\n//# sourceURL=webpack://shopify-theme-starter/./node_modules/@glidejs/glide/src/assets/sass/glide.core.scss?");

/***/ }),

/***/ "./src/styles/theme.scss":
/*!*******************************!*\
  !*** ./src/styles/theme.scss ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n// extracted by mini-css-extract-plugin\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/styles/theme.scss?");

/***/ }),

/***/ "./src/js/bundles/theme.js":
/*!*********************************!*\
  !*** ./src/js/bundles/theme.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var Styles_theme_scss__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! Styles/theme.scss */ \"./src/styles/theme.scss\");\n/* harmony import */ var _shopify_theme_sections__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @shopify/theme-sections */ \"./node_modules/@shopify/theme-sections/theme-sections.js\");\n/* harmony import */ var _public_path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../public-path */ \"./src/js/public-path.js\");\n/* harmony import */ var _public_path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_public_path__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _vendors__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../vendors */ \"./src/js/vendors.js\");\n\r\n\r\n\r\n\r\n\r\n/**\r\n * Vendors\r\n */\r\n\r\n\r\n/**\r\n * Modules\r\n */\r\ndocument\r\n  .querySelectorAll('[data-module]')\r\n  .forEach((el) =>\r\n    __webpack_require__(\"./src/js/modules lazy recursive ^\\\\.\\\\/.*$\")(`./${el.dataset.module}`)\r\n  );\r\n\r\n/**\r\n * Sections\r\n */\r\ndocument.querySelectorAll('[data-section-type]').forEach((el) =>\r\n  __webpack_require__(\"./src/js/sections lazy recursive ^\\\\.\\\\/.*$\")(`./${el.dataset.sectionType}`).then(() => {\r\n    (0,_shopify_theme_sections__WEBPACK_IMPORTED_MODULE_1__.load)(el.dataset.sectionType);\r\n  })\r\n);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/bundles/theme.js?");

/***/ }),

/***/ "./src/js/modules lazy recursive ^\\.\\/.*$":
/*!*****************************************************************************!*\
  !*** ./src/js/modules/ lazy ^\.\/.*$ chunkName: [request] namespace object ***!
  \*****************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("var map = {\n\t\"./account-area\": [\n\t\t\"./src/js/modules/account-area.js\",\n\t\t7,\n\t\t\"account-area\"\n\t],\n\t\"./account-area.js\": [\n\t\t\"./src/js/modules/account-area.js\",\n\t\t7,\n\t\t\"account-area\"\n\t],\n\t\"./addresses\": [\n\t\t\"./src/js/modules/addresses.js\",\n\t\t7,\n\t\t\"addresses\"\n\t],\n\t\"./addresses.js\": [\n\t\t\"./src/js/modules/addresses.js\",\n\t\t7,\n\t\t\"addresses\"\n\t],\n\t\"./announcement-bar\": [\n\t\t\"./src/js/modules/announcement-bar.js\",\n\t\t7,\n\t\t\"announcement-bar\"\n\t],\n\t\"./announcement-bar.js\": [\n\t\t\"./src/js/modules/announcement-bar.js\",\n\t\t7,\n\t\t\"announcement-bar\"\n\t],\n\t\"./cart-drawer-items\": [\n\t\t\"./src/js/modules/cart-drawer-items.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"vendors-node_modules_canvas-confetti_dist_confetti_browser_js\",\n\t\t\"cart-items\",\n\t\t\"cart-drawer-items\"\n\t],\n\t\"./cart-drawer-items.js\": [\n\t\t\"./src/js/modules/cart-drawer-items.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"vendors-node_modules_canvas-confetti_dist_confetti_browser_js\",\n\t\t\"cart-items\",\n\t\t\"cart-drawer-items\"\n\t],\n\t\"./cart-items\": [\n\t\t\"./src/js/modules/cart-items.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"vendors-node_modules_canvas-confetti_dist_confetti_browser_js\",\n\t\t\"cart-items\"\n\t],\n\t\"./cart-items.js\": [\n\t\t\"./src/js/modules/cart-items.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"vendors-node_modules_canvas-confetti_dist_confetti_browser_js\",\n\t\t\"cart-items\"\n\t],\n\t\"./cart-page-recommendations\": [\n\t\t\"./src/js/modules/cart-page-recommendations.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"cart-page-recommendations\"\n\t],\n\t\"./cart-page-recommendations.js\": [\n\t\t\"./src/js/modules/cart-page-recommendations.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"cart-page-recommendations\"\n\t],\n\t\"./cart-recommendations\": [\n\t\t\"./src/js/modules/cart-recommendations.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"cart-recommendations\"\n\t],\n\t\"./cart-recommendations.js\": [\n\t\t\"./src/js/modules/cart-recommendations.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"cart-recommendations\"\n\t],\n\t\"./cart-remove-button\": [\n\t\t\"./src/js/modules/cart-remove-button.js\",\n\t\t7,\n\t\t\"cart-remove-button\"\n\t],\n\t\"./cart-remove-button.js\": [\n\t\t\"./src/js/modules/cart-remove-button.js\",\n\t\t7,\n\t\t\"cart-remove-button\"\n\t],\n\t\"./cart-totals\": [\n\t\t\"./src/js/modules/cart-totals.js\",\n\t\t7,\n\t\t\"cart-totals\"\n\t],\n\t\"./cart-totals.js\": [\n\t\t\"./src/js/modules/cart-totals.js\",\n\t\t7,\n\t\t\"cart-totals\"\n\t],\n\t\"./collection-page\": [\n\t\t\"./src/js/modules/collection-page.js\",\n\t\t7,\n\t\t\"collection-page\"\n\t],\n\t\"./collection-page.js\": [\n\t\t\"./src/js/modules/collection-page.js\",\n\t\t7,\n\t\t\"collection-page\"\n\t],\n\t\"./contact-faqs\": [\n\t\t\"./src/js/modules/contact-faqs.js\",\n\t\t7,\n\t\t\"contact-faqs\"\n\t],\n\t\"./contact-faqs.js\": [\n\t\t\"./src/js/modules/contact-faqs.js\",\n\t\t7,\n\t\t\"contact-faqs\"\n\t],\n\t\"./content-accordion\": [\n\t\t\"./src/js/modules/content-accordion.js\",\n\t\t7,\n\t\t\"content-accordion\"\n\t],\n\t\"./content-accordion.js\": [\n\t\t\"./src/js/modules/content-accordion.js\",\n\t\t7,\n\t\t\"content-accordion\"\n\t],\n\t\"./cookie-banner\": [\n\t\t\"./src/js/modules/cookie-banner.js\",\n\t\t9,\n\t\t\"cookie-banner\"\n\t],\n\t\"./cookie-banner.js\": [\n\t\t\"./src/js/modules/cookie-banner.js\",\n\t\t9,\n\t\t\"cookie-banner\"\n\t],\n\t\"./custom-quantity\": [\n\t\t\"./src/js/modules/custom-quantity.js\",\n\t\t7,\n\t\t\"custom-quantity\"\n\t],\n\t\"./custom-quantity.js\": [\n\t\t\"./src/js/modules/custom-quantity.js\",\n\t\t7,\n\t\t\"custom-quantity\"\n\t],\n\t\"./drawer\": [\n\t\t\"./src/js/modules/drawer.js\",\n\t\t9,\n\t\t\"drawer\"\n\t],\n\t\"./drawer-cart\": [\n\t\t\"./src/js/modules/drawer-cart.js\",\n\t\t9,\n\t\t\"drawer-cart\"\n\t],\n\t\"./drawer-cart.js\": [\n\t\t\"./src/js/modules/drawer-cart.js\",\n\t\t9,\n\t\t\"drawer-cart\"\n\t],\n\t\"./drawer.js\": [\n\t\t\"./src/js/modules/drawer.js\",\n\t\t9,\n\t\t\"drawer\"\n\t],\n\t\"./drawers\": [\n\t\t\"./src/js/modules/drawers.js\",\n\t\t7,\n\t\t\"drawers\"\n\t],\n\t\"./drawers.js\": [\n\t\t\"./src/js/modules/drawers.js\",\n\t\t7,\n\t\t\"drawers\"\n\t],\n\t\"./facet-filters-form\": [\n\t\t\"./src/js/modules/facet-filters-form.js\",\n\t\t7,\n\t\t\"facet-filters-form\"\n\t],\n\t\"./facet-filters-form.js\": [\n\t\t\"./src/js/modules/facet-filters-form.js\",\n\t\t7,\n\t\t\"facet-filters-form\"\n\t],\n\t\"./for-the-geeks-horizontal\": [\n\t\t\"./src/js/modules/for-the-geeks-horizontal.js\",\n\t\t7,\n\t\t\"for-the-geeks-horizontal\"\n\t],\n\t\"./for-the-geeks-horizontal.js\": [\n\t\t\"./src/js/modules/for-the-geeks-horizontal.js\",\n\t\t7,\n\t\t\"for-the-geeks-horizontal\"\n\t],\n\t\"./for-the-geeks-vertical\": [\n\t\t\"./src/js/modules/for-the-geeks-vertical.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_gsap_ScrollTrigger_js-node_modules_gsap_index_js-node_modules_scrollmagi-4150a5\",\n\t\t\"for-the-geeks-vertical\"\n\t],\n\t\"./for-the-geeks-vertical.js\": [\n\t\t\"./src/js/modules/for-the-geeks-vertical.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_gsap_ScrollTrigger_js-node_modules_gsap_index_js-node_modules_scrollmagi-4150a5\",\n\t\t\"for-the-geeks-vertical\"\n\t],\n\t\"./instafeed-slider\": [\n\t\t\"./src/js/modules/instafeed-slider.js\",\n\t\t7,\n\t\t\"instafeed-slider\"\n\t],\n\t\"./instafeed-slider.js\": [\n\t\t\"./src/js/modules/instafeed-slider.js\",\n\t\t7,\n\t\t\"instafeed-slider\"\n\t],\n\t\"./login-template\": [\n\t\t\"./src/js/modules/login-template.js\",\n\t\t7,\n\t\t\"login-template\"\n\t],\n\t\"./login-template.js\": [\n\t\t\"./src/js/modules/login-template.js\",\n\t\t7,\n\t\t\"login-template\"\n\t],\n\t\"./main-navigation\": [\n\t\t\"./src/js/modules/main-navigation.js\",\n\t\t7,\n\t\t\"main-navigation\"\n\t],\n\t\"./main-navigation.js\": [\n\t\t\"./src/js/modules/main-navigation.js\",\n\t\t7,\n\t\t\"main-navigation\"\n\t],\n\t\"./play-versus-them\": [\n\t\t\"./src/js/modules/play-versus-them.js\",\n\t\t7,\n\t\t\"play-versus-them\"\n\t],\n\t\"./play-versus-them.js\": [\n\t\t\"./src/js/modules/play-versus-them.js\",\n\t\t7,\n\t\t\"play-versus-them\"\n\t],\n\t\"./product-recommendations\": [\n\t\t\"./src/js/modules/product-recommendations.js\",\n\t\t7,\n\t\t\"product-recommendations\"\n\t],\n\t\"./product-recommendations.js\": [\n\t\t\"./src/js/modules/product-recommendations.js\",\n\t\t7,\n\t\t\"product-recommendations\"\n\t],\n\t\"./product-tile\": [\n\t\t\"./src/js/modules/product-tile.js\",\n\t\t7,\n\t\t\"product-tile\"\n\t],\n\t\"./product-tile.js\": [\n\t\t\"./src/js/modules/product-tile.js\",\n\t\t7,\n\t\t\"product-tile\"\n\t],\n\t\"./product-upsell-media\": [\n\t\t\"./src/js/modules/product-upsell-media.js\",\n\t\t7,\n\t\t\"product-upsell-media\"\n\t],\n\t\"./product-upsell-media.js\": [\n\t\t\"./src/js/modules/product-upsell-media.js\",\n\t\t7,\n\t\t\"product-upsell-media\"\n\t],\n\t\"./quantity-adjuster\": [\n\t\t\"./src/js/modules/quantity-adjuster.js\",\n\t\t7,\n\t\t\"quantity-adjuster\"\n\t],\n\t\"./quantity-adjuster.js\": [\n\t\t\"./src/js/modules/quantity-adjuster.js\",\n\t\t7,\n\t\t\"quantity-adjuster\"\n\t],\n\t\"./quick-add\": [\n\t\t\"./src/js/modules/quick-add.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"quick-add\"\n\t],\n\t\"./quick-add.js\": [\n\t\t\"./src/js/modules/quick-add.js\",\n\t\t9,\n\t\t\"vendors-node_modules_animejs_lib_anime_es_js\",\n\t\t\"vendors-node_modules_shopify_theme-currency_currency_js-node_modules_qs_lib_index_js\",\n\t\t\"quick-add\"\n\t],\n\t\"./scratch-sticker\": [\n\t\t\"./src/js/modules/scratch-sticker.js\",\n\t\t7,\n\t\t\"scratch-sticker\"\n\t],\n\t\"./scratch-sticker.js\": [\n\t\t\"./src/js/modules/scratch-sticker.js\",\n\t\t7,\n\t\t\"scratch-sticker\"\n\t],\n\t\"./tap-me\": [\n\t\t\"./src/js/modules/tap-me.js\",\n\t\t7,\n\t\t\"tap-me\"\n\t],\n\t\"./tap-me.js\": [\n\t\t\"./src/js/modules/tap-me.js\",\n\t\t7,\n\t\t\"tap-me\"\n\t],\n\t\"./terms-template\": [\n\t\t\"./src/js/modules/terms-template.js\",\n\t\t7,\n\t\t\"terms-template\"\n\t],\n\t\"./terms-template.js\": [\n\t\t\"./src/js/modules/terms-template.js\",\n\t\t7,\n\t\t\"terms-template\"\n\t],\n\t\"./test\": [\n\t\t\"./src/js/modules/test.js\",\n\t\t9,\n\t\t\"test\"\n\t],\n\t\"./test.js\": [\n\t\t\"./src/js/modules/test.js\",\n\t\t9,\n\t\t\"test\"\n\t],\n\t\"./video-player\": [\n\t\t\"./src/js/modules/video-player.js\",\n\t\t7,\n\t\t\"video-player\"\n\t],\n\t\"./video-player.js\": [\n\t\t\"./src/js/modules/video-player.js\",\n\t\t7,\n\t\t\"video-player\"\n\t],\n\t\"./what-were-made-of\": [\n\t\t\"./src/js/modules/what-were-made-of.js\",\n\t\t7,\n\t\t\"what-were-made-of\"\n\t],\n\t\"./what-were-made-of.js\": [\n\t\t\"./src/js/modules/what-were-made-of.js\",\n\t\t7,\n\t\t\"what-were-made-of\"\n\t]\n};\nfunction webpackAsyncContext(req) {\n\tif(!__webpack_require__.o(map, req)) {\n\t\treturn Promise.resolve().then(() => {\n\t\t\tvar e = new Error(\"Cannot find module '\" + req + \"'\");\n\t\t\te.code = 'MODULE_NOT_FOUND';\n\t\t\tthrow e;\n\t\t});\n\t}\n\n\tvar ids = map[req], id = ids[0];\n\treturn Promise.all(ids.slice(2).map(__webpack_require__.e)).then(() => {\n\t\treturn __webpack_require__.t(id, ids[1] | 16)\n\t});\n}\nwebpackAsyncContext.keys = () => (Object.keys(map));\nwebpackAsyncContext.id = \"./src/js/modules lazy recursive ^\\\\.\\\\/.*$\";\nmodule.exports = webpackAsyncContext;\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/_lazy_^\\.\\/.*$_chunkName:_%5Brequest%5D_namespace_object?");

/***/ }),

/***/ "./src/js/public-path.js":
/*!*******************************!*\
  !*** ./src/js/public-path.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

eval("// eslint-disable-next-line no-undef,camelcase\r\n__webpack_require__.p = window.__webpack_public_path__;\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/public-path.js?");

/***/ }),

/***/ "./src/js/sections lazy recursive ^\\.\\/.*$":
/*!******************************************************************************!*\
  !*** ./src/js/sections/ lazy ^\.\/.*$ chunkName: [request] namespace object ***!
  \******************************************************************************/
/***/ ((module) => {

eval("function webpackEmptyAsyncContext(req) {\n\t// Here Promise.resolve().then() is used instead of new Promise() to prevent\n\t// uncaught exception popping up in devtools\n\treturn Promise.resolve().then(() => {\n\t\tvar e = new Error(\"Cannot find module '\" + req + \"'\");\n\t\te.code = 'MODULE_NOT_FOUND';\n\t\tthrow e;\n\t});\n}\nwebpackEmptyAsyncContext.keys = () => ([]);\nwebpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;\nwebpackEmptyAsyncContext.id = \"./src/js/sections lazy recursive ^\\\\.\\\\/.*$\";\nmodule.exports = webpackEmptyAsyncContext;\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/sections/_lazy_^\\.\\/.*$_chunkName:_%5Brequest%5D_namespace_object?");

/***/ }),

/***/ "./src/js/vendors.js":
/*!***************************!*\
  !*** ./src/js/vendors.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var lazysizes_plugins_rias_ls_rias__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lazysizes/plugins/rias/ls.rias */ \"./node_modules/lazysizes/plugins/rias/ls.rias.js\");\n/* harmony import */ var lazysizes_plugins_rias_ls_rias__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lazysizes_plugins_rias_ls_rias__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var lazysizes__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lazysizes */ \"./node_modules/lazysizes/lazysizes.js\");\n/* harmony import */ var lazysizes__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lazysizes__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _node_modules_glidejs_glide_src_assets_sass_glide_core_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../node_modules/@glidejs/glide/src/assets/sass/glide.core.scss */ \"./node_modules/@glidejs/glide/src/assets/sass/glide.core.scss\");\n/* eslint-disable import/first */\r\n/**\r\n * Lazysizes\r\n */\r\n\r\n\r\n\r\n\r\nwindow.lazySizes.cfg.loadHidden = false;\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/vendors.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "bundle." + chunkId + ".js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get mini-css chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.miniCssF = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".css";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "shopify-theme-starter:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				script.timeout = 120;
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			};
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript)
/******/ 				scriptUrl = document.currentScript.src
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) scriptUrl = scripts[scripts.length - 1].src
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/css loading */
/******/ 	(() => {
/******/ 		if (typeof document === "undefined") return;
/******/ 		var createStylesheet = (chunkId, fullhref, oldTag, resolve, reject) => {
/******/ 			var linkTag = document.createElement("link");
/******/ 		
/******/ 			linkTag.rel = "stylesheet";
/******/ 			linkTag.type = "text/css";
/******/ 			var onLinkComplete = (event) => {
/******/ 				// avoid mem leaks.
/******/ 				linkTag.onerror = linkTag.onload = null;
/******/ 				if (event.type === 'load') {
/******/ 					resolve();
/******/ 				} else {
/******/ 					var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 					var realHref = event && event.target && event.target.href || fullhref;
/******/ 					var err = new Error("Loading CSS chunk " + chunkId + " failed.\n(" + realHref + ")");
/******/ 					err.code = "CSS_CHUNK_LOAD_FAILED";
/******/ 					err.type = errorType;
/******/ 					err.request = realHref;
/******/ 					linkTag.parentNode.removeChild(linkTag)
/******/ 					reject(err);
/******/ 				}
/******/ 			}
/******/ 			linkTag.onerror = linkTag.onload = onLinkComplete;
/******/ 			linkTag.href = fullhref;
/******/ 		
/******/ 			if (oldTag) {
/******/ 				oldTag.parentNode.insertBefore(linkTag, oldTag.nextSibling);
/******/ 			} else {
/******/ 				document.head.appendChild(linkTag);
/******/ 			}
/******/ 			return linkTag;
/******/ 		};
/******/ 		var findStylesheet = (href, fullhref) => {
/******/ 			var existingLinkTags = document.getElementsByTagName("link");
/******/ 			for(var i = 0; i < existingLinkTags.length; i++) {
/******/ 				var tag = existingLinkTags[i];
/******/ 				var dataHref = tag.getAttribute("data-href") || tag.getAttribute("href");
/******/ 				if(tag.rel === "stylesheet" && (dataHref === href || dataHref === fullhref)) return tag;
/******/ 			}
/******/ 			var existingStyleTags = document.getElementsByTagName("style");
/******/ 			for(var i = 0; i < existingStyleTags.length; i++) {
/******/ 				var tag = existingStyleTags[i];
/******/ 				var dataHref = tag.getAttribute("data-href");
/******/ 				if(dataHref === href || dataHref === fullhref) return tag;
/******/ 			}
/******/ 		};
/******/ 		var loadStylesheet = (chunkId) => {
/******/ 			return new Promise((resolve, reject) => {
/******/ 				var href = __webpack_require__.miniCssF(chunkId);
/******/ 				var fullhref = __webpack_require__.p + href;
/******/ 				if(findStylesheet(href, fullhref)) return resolve();
/******/ 				createStylesheet(chunkId, fullhref, null, resolve, reject);
/******/ 			});
/******/ 		}
/******/ 		// object to store loaded CSS chunks
/******/ 		var installedCssChunks = {
/******/ 			"theme": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.miniCss = (chunkId, promises) => {
/******/ 			var cssChunks = {"test":1};
/******/ 			if(installedCssChunks[chunkId]) promises.push(installedCssChunks[chunkId]);
/******/ 			else if(installedCssChunks[chunkId] !== 0 && cssChunks[chunkId]) {
/******/ 				promises.push(installedCssChunks[chunkId] = loadStylesheet(chunkId).then(() => {
/******/ 					installedCssChunks[chunkId] = 0;
/******/ 				}, (e) => {
/******/ 					delete installedCssChunks[chunkId];
/******/ 					throw e;
/******/ 				}));
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		// no hmr
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"theme": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						} else installedChunks[chunkId] = 0;
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/js/bundles/theme.js");
/******/ 	
/******/ })()
;