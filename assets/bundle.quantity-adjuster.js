/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["quantity-adjuster"],{

/***/ "./src/js/modules/quantity-adjuster.js":
/*!*********************************************!*\
  !*** ./src/js/modules/quantity-adjuster.js ***!
  \*********************************************/
/***/ (() => {

eval("class QuantityAdjuster extends HTMLElement {\r\n  constructor() {\r\n    super();\r\n\r\n    this.input = this.querySelector('input');\r\n    this.changeEvent = new Event('change', { bubbles: true });\r\n\r\n    this.querySelectorAll('button').forEach((button) =>\r\n      button.addEventListener('click', this.onButtonClick.bind(this))\r\n    );\r\n  }\r\n\r\n  onButtonClick(e) {\r\n    e.preventDefault();\r\n  \r\n    const button = e.target.closest('button');\r\n    const previousValue = this.input.value;\r\n\r\n    button.name === 'plus' ? this.input.stepUp() : this.input.stepDown();\r\n    if (previousValue !== this.input.value) {\r\n      this.input.dispatchEvent(this.changeEvent);\r\n    }\r\n  }\r\n}\r\n\r\ncustomElements.define('quantity-adjuster', QuantityAdjuster);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/quantity-adjuster.js?");

/***/ })

}]);