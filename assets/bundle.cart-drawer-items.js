"use strict";
/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["cart-drawer-items"],{

/***/ "./src/js/modules/cart-drawer-items.js":
/*!*********************************************!*\
  !*** ./src/js/modules/cart-drawer-items.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _cart_items__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cart-items */ \"./src/js/modules/cart-items.js\");\n/* eslint-disable class-methods-use-this */\r\n\r\n\r\nclass CartDrawerItems extends _cart_items__WEBPACK_IMPORTED_MODULE_0__[\"default\"] {\r\n  render(data) {\r\n    if (window.plaayRenderCartDrawerSections) {\r\n      window.plaayRenderCartDrawerSections(data);\r\n      this.loading = false;\r\n      return;\r\n    }\r\n\r\n    super.render(data);\r\n  }\r\n\r\n  getSectionsToRender() {\r\n\r\n    return [\r\n      {\r\n        section: 'cart-drawer-content',\r\n        sectionSelector: '[data-cart-drawer-content]',\r\n        selector: '[data-cart-drawer-content]', \r\n      },\r\n      {\r\n        section: 'cart-count',\r\n        selector: '[data-cart-count]',\r\n      },\r\n    ];\r\n  }\r\n}\r\n\r\ncustomElements.define('cart-drawer-items', CartDrawerItems);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/cart-drawer-items.js?");

/***/ })

}]);
