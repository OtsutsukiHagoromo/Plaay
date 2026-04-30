/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["content-accordion"],{

/***/ "./src/js/modules/content-accordion.js":
/*!*********************************************!*\
  !*** ./src/js/modules/content-accordion.js ***!
  \*********************************************/
/***/ (() => {

eval("class ContentAccordion extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    const accordion = (() => {\r\n      const elements = {\r\n        accordion: document.querySelectorAll('[data-accordion]')\r\n      };\r\n      const addEventListeners = () => {\r\n        elements.accordion.forEach(accordion => {\r\n          accordion.addEventListener('click', () => {\r\n            if(accordion.classList.contains('active')){\r\n              setTimeout(() => {\r\n                accordion.classList.remove('active');\r\n              }, 250);\r\n            } else {\r\n              setTimeout(() => {\r\n                accordion.classList.add('active');\r\n              }, 250);\r\n            }\r\n          });\r\n        });\r\n      };\r\n      const init = () => {\r\n        addEventListeners();\r\n      };\r\n      return { init };\r\n    })();\r\n    accordion.init();\r\n  }\r\n}\r\ncustomElements.define('content-accordion', ContentAccordion);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/content-accordion.js?");

/***/ })

}]);