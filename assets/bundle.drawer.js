"use strict";
/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["drawer"],{

/***/ "./src/js/modules/drawer.js":
/*!**********************************!*\
  !*** ./src/js/modules/drawer.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\nclass Drawer extends HTMLElement {\r\n  constructor() {\r\n    super();\r\n\r\n    this._loading = false;\r\n    this._visibility = false;\r\n\r\n    this.drawers = document.querySelector('site-drawers');\r\n    this.drawer = this.querySelector('[data-drawer]');\r\n  }\r\n\r\n  handleCloseClick(e) {\r\n    e.preventDefault();\r\n    this.drawers.close();\r\n  }\r\n\r\n  open() {\r\n    this.visibility = true;\r\n  }\r\n\r\n  close() {\r\n    this.visibility = false;\r\n  }\r\n\r\n  get loading() {\r\n    return this._loading;\r\n  }\r\n\r\n  set loading(val) {\r\n    this._loading = val;\r\n\r\n    this.classList.toggle('loading', val);\r\n  }\r\n\r\n  get visibility() {\r\n    return this._visibility;\r\n  }\r\n\r\n  set visibility(val) {\r\n    this._visibility = val;\r\n\r\n    this.classList.toggle('active', val);\r\n\r\n    if (val) {\r\n      this.drawer\r\n        .querySelectorAll('[data-close]')\r\n        .forEach((el) =>\r\n          el.addEventListener('click', this.handleCloseClick.bind(this))\r\n        );\r\n    } else {\r\n      this.drawer\r\n        .querySelectorAll('[data-close]')\r\n        .forEach((el) =>\r\n          el.removeEventListener('click', this.handleCloseClick.bind(this))\r\n        );\r\n    }\r\n  }\r\n}\r\n\r\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Drawer);\r\n\r\ncustomElements.define('site-drawer', Drawer);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/drawer.js?");

/***/ })

}]);