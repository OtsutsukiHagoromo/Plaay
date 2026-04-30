/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["cart-remove-button"],{

/***/ "./src/js/modules/cart-remove-button.js":
/*!**********************************************!*\
  !*** ./src/js/modules/cart-remove-button.js ***!
  \**********************************************/
/***/ (() => {

eval("class CartRemoveButton extends HTMLElement {\r\n  constructor() {\r\n    super();\r\n    this.addEventListener('click', this.onClick.bind(this));\r\n  }\r\n\r\n  onClick(e) {\r\n    e.preventDefault();\r\n\r\n    const cartItems =\r\n      document.querySelector('cart-items') ||\r\n      document.querySelector('cart-drawer-items');\r\n\r\n    cartItems.remove(this.closest('[data-cart-item]').dataset.key);\r\n  }\r\n}\r\n\r\ncustomElements.define('cart-remove-button', CartRemoveButton);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/cart-remove-button.js?");

/***/ })

}]);