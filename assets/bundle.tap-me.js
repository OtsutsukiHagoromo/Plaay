/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["tap-me"],{

/***/ "./src/js/modules/tap-me.js":
/*!**********************************!*\
  !*** ./src/js/modules/tap-me.js ***!
  \**********************************/
/***/ (() => {

eval("class TapMe extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    const tapMe = (() => {\r\n      const elements = {\r\n        tap_me_buttons: document.querySelectorAll(\".tap_me_button\")\r\n      };\r\n      const init = () => {\r\n        addEventListeners();\r\n      };\r\n      const addEventListeners = () => {\r\n        elements.tap_me_buttons.forEach(tap_me_button => {\r\n          const additional_information = tap_me_button.closest(\".review_slide\");\r\n          tap_me_button.addEventListener(\"click\", () => {\r\n            toggleReview(additional_information);\r\n          });\r\n          tap_me_button.nextElementSibling.addEventListener(\"click\", () => {\r\n            toggleReview(additional_information);\r\n          });\r\n        });\r\n      };\r\n      const toggleReview = (additional_information) => {\r\n        if(additional_information.classList.contains(\"active\")){\r\n          setTimeout(() => {\r\n            additional_information.classList.remove(\"active\");\r\n          }, 200);\r\n        } else {\r\n          setTimeout(() => {\r\n            additional_information.classList.add(\"active\");\r\n          }, 200);\r\n        }\r\n      };\r\n      return { init };\r\n    })();\r\n    tapMe.init();\r\n  };\r\n};\r\ncustomElements.define('tap-me', TapMe);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/tap-me.js?");

/***/ })

}]);