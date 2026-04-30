/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["custom-quantity"],{

/***/ "./src/js/modules/custom-quantity.js":
/*!*******************************************!*\
  !*** ./src/js/modules/custom-quantity.js ***!
  \*******************************************/
/***/ (() => {

eval("class CustomQuantity extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    \r\n    const quantity = (() => {\r\n      const elements = {\r\n        quantity_container: document.querySelectorAll(\".qtyBtn\")\r\n      };\r\n      const init = () => {\r\n        addEventListeners();\r\n      };\r\n      const addEventListeners = () => {\r\n        elements.quantity_container.forEach(quantity => {\r\n          const input = quantity.querySelector(\"input\");\r\n          const minus = quantity.querySelector(\"[data-quantity-subtract]\");\r\n          const plus = quantity.querySelector(\"[data-quantity-add]\");\r\n  \r\n          plus.addEventListener(\"click\", () => {\r\n            input.value = (parseInt(input.value) + 1).toString();\r\n            input.setAttribute(\"value\", (parseInt(input.value)).toString());\r\n          });\r\n          minus.addEventListener(\"click\", () => {\r\n            const value = (parseInt(input.value) -1).toString();\r\n            input.value = value <= input.min ? input.min : value;\r\n            input.setAttribute(\"value\", value <= input.min ? input.min : value);\r\n          });\r\n        });\r\n      };\r\n      return { init };\r\n    })();\r\n    quantity.init();  \r\n  }\r\n};\r\ncustomElements.define('custom-quantity', CustomQuantity);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/custom-quantity.js?");

/***/ })

}]);